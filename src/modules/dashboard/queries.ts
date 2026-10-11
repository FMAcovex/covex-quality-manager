import "server-only";
import { prisma } from "@/lib/db";
import { getAlertPreview } from "@/modules/configuration/admin-queries";
import { getDeviationAnalytics } from "@/modules/deviations/analytics/queries";
import { getCapaAnalytics } from "@/modules/capa/analytics/queries";
import { getChangeAnalytics } from "@/modules/change-control/analytics/queries";
import { getComplaintAnalytics } from "@/modules/complaints/analytics/queries";
import { getReturnAnalytics } from "@/modules/returns/analytics/queries";
import { matchesQuickFilter, operationalDates } from "@/modules/controlled-documents/listing";
import {
  DASHBOARD_MODULES, classifyDue, countTrend, moduleCounts, uniqueSortedTasks, utcDay,
  type DashboardFilters, type DashboardTask, type DashboardModule,
} from "./domain";

const taskPageSize = 15;
const knownAlertRoutes: Record<string, DashboardModule> = {
  capa: "CAPA", changes: "CHANGE_CONTROL", complaints: "COMPLAINT", returns: "RETURN",
};

async function existingTrend(module: DashboardModule | "ALL", year: number, department: string) {
  const filters = { year: String(year), ...(department ? { department } : {}) };
  switch (module) {
    case "DEVIATION": return countTrend((await getDeviationAnalytics(filters)).trend);
    case "CAPA": return countTrend((await getCapaAnalytics(filters)).trend);
    case "CHANGE_CONTROL": return countTrend((await getChangeAnalytics(filters)).trend);
    case "COMPLAINT": return countTrend((await getComplaintAnalytics(filters)).trend);
    case "RETURN": return countTrend((await getReturnAnalytics(filters)).trend);
    default: return [];
  }
}

/** Read-only dashboard. Never reuse paginated or 300-row-limited list payloads for totals. */
export async function getDashboardData(filters: DashboardFilters) {
  const started = performance.now();
  const year = filters.year;
  const department = filters.department;
  const qms = { isActive: true, ...(year ? { year } : {}) };
  const dep = department ? { departmentId: department } : {};
  const today = utcDay(filters.asOf);
  const docWhere = {
    administrativeStatus: { not: "ANNULLED" as const },
    ...(department ? { departmentId: department } : {}),
  };

  const [
    deviations, capas, changes, complaints, returns, audits,
    departments, docs, revisionCount, alerts,
    availableCapa, availableChanges, availableComplaints, availableReturns,
    deviationDue, auditDue, trend,
  ] = await Promise.all([
    prisma.deviation.groupBy({ by: ["status"], where: { qmsRecord: qms, ...dep }, _count: { _all: true } }),
    prisma.capa.groupBy({ by: ["status"], where: { qmsRecord: qms, ...dep }, _count: { _all: true } }),
    prisma.changeControl.groupBy({ by: ["finalStatus"], where: { qmsRecord: qms, ...dep }, _count: { _all: true } }),
    prisma.complaint.groupBy({ by: ["status"], where: { qmsRecord: qms, ...dep }, _count: { _all: true } }),
    prisma.returnRecord.groupBy({ by: ["status"], where: { qmsRecord: qms, ...dep }, _count: { _all: true } }),
    prisma.audit.groupBy({ by: ["status"], where: { qmsRecord: qms, ...(department ? { departments: { some: { departmentId: department, isActive: true } } } : {}) }, _count: { _all: true } }),
    prisma.department.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    prisma.controlledDocument.findMany({
      where: docWhere,
      select: {
        id: true, baseCode: true, revisions: {
          orderBy: [{ revisionCode: "desc" }, { id: "desc" }], take: 1,
          select: {
            status: true, verificationStatus: true, effectiveFrom: true, reviewDueAt: true,
            lifecycle: { select: { effectiveFrom: true, reviewDueAt: true } },
          },
        },
      },
    }),
    prisma.controlledDocumentRevision.count({ where: { document: docWhere } }),
    getAlertPreview(filters.asOf),
    prisma.capa.findMany({ where: { qmsRecord: qms, ...dep }, select: { id: true } }),
    prisma.changeControl.findMany({ where: { qmsRecord: qms, ...dep }, select: { id: true } }),
    prisma.complaint.findMany({ where: { qmsRecord: qms, ...dep }, select: { id: true } }),
    prisma.returnRecord.findMany({ where: { qmsRecord: qms, ...dep }, select: { id: true } }),
    prisma.deviation.findMany({
      where: { qmsRecord: qms, ...dep, status: "OPEN" },
      select: {
        id: true, qmsRecord: { select: { businessCode: true } },
        followups: {
          orderBy: [{ followupDate: "desc" }, { createdAt: "desc" }], take: 1,
          select: { nextFollowupDate: true },
        },
      },
    }),
    prisma.audit.findMany({
      where: { qmsRecord: qms, status: "OPEN", ...(department ? { departments: { some: { departmentId: department, isActive: true } } } : {}) },
      select: {
        id: true, qmsRecord: { select: { businessCode: true } },
        findings: { where: { isActive: true }, select: { id: true } },
        followups: {
          orderBy: [{ followupDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
          select: { id: true, findingId: true, nextReviewDate: true },
        },
      },
    }),
    existingTrend(filters.module === "ALL" ? "DEVIATION" : filters.module, year ?? filters.asOf.getUTCFullYear(), department),
  ]);

  const raw = [
    moduleCounts("DEVIATION", deviations.map(r => ({ status: r.status, count: r._count._all })), filters.state),
    moduleCounts("CAPA", capas.map(r => ({ status: r.status, count: r._count._all })), filters.state),
    moduleCounts("CHANGE_CONTROL", changes.map(r => ({ status: r.finalStatus, count: r._count._all })), filters.state),
    moduleCounts("COMPLAINT", complaints.map(r => ({ status: r.status, count: r._count._all })), filters.state),
    moduleCounts("RETURN", returns.map(r => ({ status: r.status, count: r._count._all })), filters.state),
    moduleCounts("AUDIT", audits.map(r => ({ status: r.status, count: r._count._all })), filters.state),
  ];
  const metrics = filters.module === "ALL" ? raw : filters.module === "PNT" ? [] : raw.filter(row => row.module === filters.module);

  const allowed = new Map<DashboardModule, Set<string>>([
    ["CAPA", new Set(availableCapa.map(r => r.id))],
    ["CHANGE_CONTROL", new Set(availableChanges.map(r => r.id))],
    ["COMPLAINT", new Set(availableComplaints.map(r => r.id))],
    ["RETURN", new Set(availableReturns.map(r => r.id))],
  ]);
  const tasks: DashboardTask[] = [];
  for (const alert of alerts.items) {
    const match = /^\/(capa|changes|complaints|returns)\/([0-9a-f-]{36})(?:[/?#]|$)/i.exec(alert.href);
    if (!match) continue;
    const module = knownAlertRoutes[match[1]];
    if (!allowed.get(module)?.has(match[2])) continue;
    tasks.push({
      key: alert.key, module, code: alert.businessCode, label: alert.label,
      dueDate: utcDay(alert.dueDate), state: alert.state, href: alert.href,
      source: "Regla configurada: " + alert.ruleKey,
    });
  }
  for (const row of deviationDue) {
    const due = row.followups[0]?.nextFollowupDate;
    const state = due && classifyDue(due, today);
    if (due && state) tasks.push({
      key: "DEV-F-" + row.id, module: "DEVIATION", code: row.qmsRecord.businessCode ?? "Sin código",
      label: "Próximo seguimiento", dueDate: utcDay(due), state,
      href: "/deviations/" + row.id, source: "Último seguimiento · ventana 30 días",
    });
  }
  for (const audit of auditDue) {
    const activeFindings = new Set(audit.findings.map(f => f.id));
    const latest = new Map<string, typeof audit.followups[number]>();
    for (const followup of audit.followups) {
      if (followup.findingId && !activeFindings.has(followup.findingId)) continue;
      const scope = followup.findingId ?? "GENERAL";
      if (!latest.has(scope)) latest.set(scope, followup);
    }
    for (const [scope, followup] of latest) {
      const due = followup.nextReviewDate;
      const state = due && classifyDue(due, today);
      if (!due || !state) continue;
      tasks.push({
        key: "AUD-F-" + audit.id + "-" + scope, module: "AUDIT",
        code: audit.qmsRecord.businessCode ?? "Sin código",
        label: scope === "GENERAL" ? "Revisión de auditoría" : "Seguimiento de hallazgo",
        dueDate: utcDay(due), state, href: "/audits/" + audit.id,
        source: "Última revisión por ámbito · ventana 30 días",
      });
    }
  }

  let overdueDocs = 0, upcomingDocs = 0, missingDates = 0, unverified = 0;
  for (const doc of docs) {
    const revision = doc.revisions[0];
    if (!revision) { missingDates++; continue; }
    const dates = operationalDates(revision);
    if (matchesQuickFilter(revision, dates, "missing", today.toISOString().slice(0, 10))) missingDates++;
    if (matchesQuickFilter(revision, dates, "unverified", today.toISOString().slice(0, 10))) unverified++;
    if (matchesQuickFilter(revision, dates, "overdue", today.toISOString().slice(0, 10))) overdueDocs++;
    if (matchesQuickFilter(revision, dates, "dueSoon", today.toISOString().slice(0, 10))) upcomingDocs++;
    if (revision.status === "IN_FORCE" && dates.reviewDueAt) {
      const due = new Date(dates.reviewDueAt + "T00:00:00.000Z");
      const state = classifyDue(due, today);
      if (state) tasks.push({
        key: "PNT-R-" + doc.id, module: "PNT", code: doc.baseCode ?? "Sin código",
        label: "Revisión documental", dueDate: due, state,
        href: "/controlled-documents/" + doc.id, source: "Última revisión · ventana 30 días",
      });
    }
  }

  const sorted = uniqueSortedTasks(tasks).filter(t =>
    (filters.module === "ALL" || t.module === filters.module) &&
    (filters.taskView === "all" || t.state.toLowerCase() === filters.taskView),
  );
  const pageCount = Math.max(1, Math.ceil(sorted.length / taskPageSize));
  const page = Math.min(filters.page, pageCount);
  const taskCounts = { total: sorted.length, overdue: sorted.filter(t => t.state === "OVERDUE").length, upcoming: sorted.filter(t => t.state === "UPCOMING").length };
  return {
    asOf: today,
    metrics,
    allModules: DASHBOARD_MODULES,
    departments,
    pnt: { masters: docs.length, revisions: revisionCount, overdue: overdueDocs, upcoming: upcomingDocs, missingDates, unverified },
    tasks: sorted.slice((page - 1) * taskPageSize, page * taskPageSize),
    taskCounts, page, pageCount, trend,
    trendModule: filters.module === "ALL" ? "DEVIATION" : filters.module,
    ruleCoverage: alerts.rules.map(r => r.key),
    elapsedMs: Math.round(performance.now() - started),
  };
}
