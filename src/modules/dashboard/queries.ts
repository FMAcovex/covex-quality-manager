import "server-only";
import { Prisma } from "@prisma/client";
import { dashboardTrend } from "./trend-query";
import { prisma } from "@/lib/db";
import { getAlertPreview } from "@/modules/configuration/admin-queries";
import { matchesQuickFilter, operationalDates } from "@/modules/controlled-documents/listing";
import {
  DASHBOARD_MODULES, classifyDue, moduleCounts, uniqueSortedTasks, utcDay,
  type DashboardFilters, type DashboardTask, type DashboardModule,
} from "./domain";

const taskPageSize = 15;
const knownAlertRoutes: Record<string, DashboardModule> = {
  capa: "CAPA", changes: "CHANGE_CONTROL", complaints: "COMPLAINT", returns: "RETURN",
};

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
    deviations, capas, changes, complaints, returns, audits, oos,
    departments, docs, inForceRevisions, revisionCount, alerts,
    deviationDue, auditDue, trend, capaPending, changesPending,
  ] = await Promise.all([
    prisma.deviation.groupBy({ by: ["status"], where: { qmsRecord: qms, ...dep }, _count: { _all: true } }),
    prisma.capa.groupBy({ by: ["status"], where: { qmsRecord: qms, ...dep }, _count: { _all: true } }),
    prisma.changeControl.groupBy({ by: ["finalStatus"], where: { qmsRecord: qms, ...dep }, _count: { _all: true } }),
    prisma.complaint.groupBy({ by: ["status"], where: { qmsRecord: qms, ...dep }, _count: { _all: true } }),
    prisma.returnRecord.groupBy({ by: ["status"], where: { qmsRecord: qms, ...dep }, _count: { _all: true } }),
    prisma.audit.groupBy({ by: ["status"], where: { qmsRecord: qms, ...(department ? { departments: { some: { departmentId: department, isActive: true } } } : {}) }, _count: { _all: true } }),
    prisma.oosRecord.groupBy({ by: ["status"], where: { qmsRecord: qms, ...dep }, _count: { _all: true } }),
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
    prisma.controlledDocumentRevision.findMany({
      where: { status: "IN_FORCE", document: docWhere },
      orderBy: [{ revisionCode: "desc" }, { id: "desc" }],
      select: {
        documentId: true, status: true, verificationStatus: true, effectiveFrom: true, reviewDueAt: true,
        lifecycle: { select: { effectiveFrom: true, reviewDueAt: true } },
      },
    }),
    prisma.controlledDocumentRevision.count({ where: { document: docWhere } }),
    getAlertPreview(filters.asOf, { year, department, module: filters.module }),
    (filters.module === "ALL" || filters.module === "DEVIATION") ? prisma.$queryRaw<Array<{ id: string; businessCode: string | null; due: Date }>>(Prisma.sql`
      SELECT r.id, q."businessCode", f."nextFollowupDate" AS due
      FROM "Deviation" r JOIN "QmsRecord" q ON q.id = r."qmsRecordId"
      JOIN LATERAL (SELECT f."nextFollowupDate" FROM "DeviationFollowup" f WHERE f."deviationId" = r.id
        ORDER BY f."followupDate" DESC, f."createdAt" DESC LIMIT 1) f ON true
      WHERE q."isActive" = true AND r.status = 'OPEN'
        ${year ? Prisma.sql`AND q.year = ${year}` : Prisma.empty}
        ${department ? Prisma.sql`AND r."departmentId" = ${department}` : Prisma.empty}
        AND f."nextFollowupDate" < ${new Date(today.getTime() + 31 * 86400000)}
    `) : [],
    (filters.module === "ALL" || filters.module === "AUDIT") ? prisma.$queryRaw<Array<{ id: string; businessCode: string | null; findingId: string | null; due: Date }>>(Prisma.sql`
      SELECT a.id, q."businessCode", f."findingId", f."nextReviewDate" AS due
      FROM "Audit" a JOIN "QmsRecord" q ON q.id = a."qmsRecordId"
      JOIN LATERAL (
        SELECT DISTINCT ON (f."findingId") f."findingId", f."nextReviewDate"
        FROM "AuditFollowup" f WHERE f."auditId" = a.id
          AND (f."findingId" IS NULL OR EXISTS (SELECT 1 FROM "AuditFinding" n WHERE n.id = f."findingId" AND n."auditId" = a.id AND n."isActive" = true))
        ORDER BY f."findingId", f."followupDate" DESC, f."createdAt" DESC, f.id DESC
      ) f ON true
      WHERE q."isActive" = true AND a.status = 'OPEN'
        ${year ? Prisma.sql`AND q.year = ${year}` : Prisma.empty}
        ${department ? Prisma.sql`AND EXISTS (SELECT 1 FROM "AuditDepartment" d WHERE d."auditId" = a.id AND d."departmentId" = ${department} AND d."isActive" = true)` : Prisma.empty}
        AND f."nextReviewDate" < ${new Date(today.getTime() + 31 * 86400000)}
    `) : [],
    dashboardTrend(filters.module === "ALL" ? "DEVIATION" : filters.module, year ?? filters.asOf.getUTCFullYear(), department),
    prisma.capa.count({ where: { qmsRecord: qms, ...dep, status: "CLOSED", effectivenessStatus: "PENDING", effectiveClosedAt: null } }),
    prisma.changeControl.count({ where: { qmsRecord: qms, ...dep, finalStatus: "OPEN", executionStatus: "EXECUTED", effectivenessStatus: "PENDING" } }),
  ]);

  const raw = [
    moduleCounts("DEVIATION", deviations.map(r => ({ status: r.status, count: r._count._all })), filters.state),
    moduleCounts("CAPA", capas.map(r => ({ status: r.status, count: r._count._all })), filters.state),
    moduleCounts("CHANGE_CONTROL", changes.map(r => ({ status: r.finalStatus, count: r._count._all })), filters.state),
    moduleCounts("COMPLAINT", complaints.map(r => ({ status: r.status, count: r._count._all })), filters.state),
    moduleCounts("RETURN", returns.map(r => ({ status: r.status, count: r._count._all })), filters.state),
    moduleCounts("AUDIT", audits.map(r => ({ status: r.status, count: r._count._all })), filters.state),
    moduleCounts("OOS", oos.map(r => ({ status: r.status, count: r._count._all })), filters.state),
  ];
  const metrics = filters.module === "ALL" ? raw : filters.module === "PNT" ? [] : raw.filter(row => row.module === filters.module);

  const tasks: DashboardTask[] = [];
  for (const alert of alerts.items) {
    const match = /^\/(capa|changes|complaints|returns)\/([0-9a-f-]{36})(?:[/?#]|$)/i.exec(alert.href);
    if (!match) continue;
    const alertModule = knownAlertRoutes[match[1]];
    tasks.push({
      key: alert.key, module: alertModule, code: alert.businessCode, label: alert.label,
      dueDate: utcDay(alert.dueDate), state: alert.state, href: alert.href,
      source: "Regla configurada: " + alert.ruleKey,
    });
  }
  for (const row of deviationDue) {
    const due = row.due;
    const state = due && classifyDue(due, today);
    if (due && state) tasks.push({
      key: "DEV-F-" + row.id, module: "DEVIATION", code: row.businessCode ?? "Sin código",
      label: "Próximo seguimiento", dueDate: utcDay(due), state,
      href: "/deviations/" + row.id, source: "Último seguimiento · ventana 30 días",
    });
  }
  for (const audit of auditDue) {
    const scope = audit.findingId ?? "GENERAL";
    const due = audit.due;
    const state = classifyDue(due, today);
    if (!state) continue;
    tasks.push({
      key: "AUD-F-" + audit.id + "-" + scope, module: "AUDIT",
      code: audit.businessCode ?? "Sin código",
      label: scope === "GENERAL" ? "Revisión de auditoría" : "Seguimiento de hallazgo",
      dueDate: utcDay(due), state, href: "/audits/" + audit.id,
      source: "Última revisión por ámbito · ventana 30 días",
    });
  }

  // A newer draft must not conceal the still-effective PNT review deadline.
  const inForceByMaster = new Map<string, typeof inForceRevisions[number]>();
  for (const revision of inForceRevisions) {
    if (!inForceByMaster.has(revision.documentId)) inForceByMaster.set(revision.documentId, revision);
  }
  let overdueDocs = 0, upcomingDocs = 0, missingDates = 0, unverified = 0;
  const dayText = today.toISOString().slice(0, 10);
  for (const doc of docs) {
    const revision = doc.revisions[0];
    if (!revision) { missingDates++; continue; }
    const dates = operationalDates(revision);
    if (matchesQuickFilter(revision, dates, "missing", dayText)) missingDates++;
    if (matchesQuickFilter(revision, dates, "unverified", dayText)) unverified++;
    const activeRevision = inForceByMaster.get(doc.id);
    if (!activeRevision) continue;
    const activeDates = operationalDates(activeRevision);
    if (matchesQuickFilter(activeRevision, activeDates, "overdue", dayText)) overdueDocs++;
    if (matchesQuickFilter(activeRevision, activeDates, "dueSoon", dayText)) upcomingDocs++;
    if (activeDates.reviewDueAt) {
      const due = new Date(activeDates.reviewDueAt + "T00:00:00.000Z");
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
    pendingEffectiveness: { capa: capaPending, changes: changesPending, total: capaPending + changesPending },
    trendModule: filters.module === "ALL" ? "DEVIATION" : filters.module,
    ruleCoverage: alerts.rules.map(r => r.key),
    elapsedMs: Math.round(performance.now() - started),
  };
}
