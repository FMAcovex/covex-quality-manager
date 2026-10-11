import "server-only";
import { prisma } from "@/lib/db";
import { getAlertPreview } from "@/modules/configuration/admin-queries";
import { pendingAuditReviewDate } from "@/modules/audits/followup-review";
import { getDeviationAnalytics } from "@/modules/deviations/analytics/queries";
import { getCapaAnalytics } from "@/modules/capa/analytics/queries";
import { getChangeAnalytics } from "@/modules/change-control/analytics/queries";
import { getComplaintAnalytics } from "@/modules/complaints/analytics/queries";
import { getReturnAnalytics } from "@/modules/returns/analytics/queries";
import {
  DASHBOARD_MODULES, dayState, statusFromGroups, taskPage, trendPoints, uniqueTasks,
  utcDay, withinTaskHorizon, type DashboardFilters, type DashboardModule,
  type DashboardTask, type DashboardTrendPoint,
} from "./domain";

/** Read-only aggregates: never derive global totals from a 25/300-row listing. */
export async function dashboardStatus(department: string) {
  const scope = department ? { departmentId: department } : {};
  const active = { qmsRecord: { isActive: true } };
  const [
    deviation, capa, change, complaint, returns, audit,
    pntTotal, pntDrafts, pntRevisions, pntInForce, capaEfficacy, changeEfficacy,
  ] = await Promise.all([
    prisma.deviation.groupBy({ by: ["status"], where: { ...active, ...scope }, _count: { _all: true } }),
    prisma.capa.groupBy({ by: ["status"], where: { ...active, ...scope }, _count: { _all: true } }),
    prisma.changeControl.groupBy({ by: ["finalStatus"], where: { ...active, ...scope }, _count: { _all: true } }),
    prisma.complaint.groupBy({ by: ["status"], where: { ...active, ...scope }, _count: { _all: true } }),
    prisma.returnRecord.groupBy({ by: ["status"], where: { ...active, ...scope }, _count: { _all: true } }),
    prisma.audit.groupBy({ by: ["status"], where: {
      ...active, ...(department ? { departments: { some: { isActive: true, departmentId: department } } } : {}),
    }, _count: { _all: true } }),
    prisma.controlledDocument.count({ where: { administrativeStatus: { not: "ANNULLED" }, ...scope } }),
    prisma.controlledDocument.count({ where: { administrativeStatus: "DRAFT", ...scope } }),
    prisma.controlledDocumentRevision.count({ where: { document: { administrativeStatus: { not: "ANNULLED" }, ...scope } } }),
    prisma.controlledDocumentRevision.count({ where: { status: "IN_FORCE", document: { administrativeStatus: "ACTIVE", ...scope } } }),
    prisma.capa.count({ where: { ...active, ...scope, status: "CLOSED", effectivenessStatus: "PENDING", effectiveClosedAt: null } }),
    prisma.changeControl.count({ where: { ...active, ...scope, finalStatus: "OPEN", executionStatus: "EXECUTED", effectivenessStatus: "PENDING" } }),
  ]);
  const grouped = [
    statusFromGroups("DEVIATION", "/deviations", deviation, { draft: "DRAFT", open: "OPEN", closed: "CLOSED" }),
    statusFromGroups("CAPA", "/capa", capa, { draft: "DRAFT", open: "OPEN", closed: "CLOSED" }),
    statusFromGroups("CHANGE_CONTROL", "/changes", change.map(g => ({status:g.finalStatus,_count:g._count})), { draft: "DRAFT", open: "OPEN", closed: "CLOSED" }),
    statusFromGroups("COMPLAINT", "/complaints", complaint, { draft: "DRAFT", open: "OPEN", closed: "CLOSED" }),
    statusFromGroups("RETURN", "/returns", returns, { draft: "DRAFT", open: "OPEN", closed: "CLOSED" }),
    statusFromGroups("AUDIT", "/audits", audit, { draft: "DRAFT", open: "OPEN", closed: "CLOSED" }),
    { module: "PNT" as const, href: "/controlled-documents", openHref: "/controlled-documents?state=ACTIVE",
      open: pntTotal - pntDrafts, drafts: pntDrafts, closed: 0, other: 0, total: pntTotal },
  ];
  return { grouped, pnt: { masters: pntTotal, revisions: pntRevisions, inForce: pntInForce }, capaEfficacy, changeEfficacy };
}

function newTask(
  module: DashboardModule, id: string, code: string, label: string,
  date: Date, href: string, source: DashboardTask["source"], asOf: Date,
  category: string,
): DashboardTask {
  return { key: module + ":" + id + ":" + category, module, code, label,
    dueDate: utcDay(date), state: dayState(date, asOf), href, source };
}

/** Reuses configured rules; supplements modules not covered by that rule engine. */
export async function dashboardTasks(department: string, asOf: Date): Promise<DashboardTask[]> {
  const scope = department ? { departmentId: department } : {};
  const [preview, deviations, audits, revisions] = await Promise.all([
    getAlertPreview(asOf),
    prisma.deviation.findMany({
      where: { ...scope, status: "OPEN", qmsRecord: { isActive: true } },
      select: { id: true, qmsRecord: { select: { businessCode: true } },
        followups: { orderBy: [{ followupDate: "desc" }, { createdAt: "desc" }, { id: "desc" }], take: 1, select: { nextFollowupDate: true } } },
    }),
    prisma.audit.findMany({
      where: { status: "OPEN", qmsRecord: { isActive: true },
        ...(department ? { departments: { some: { departmentId: department, isActive: true } } } : {}) },
      select: { id: true, qmsRecord: { select: { businessCode: true } },
        findings: { where: { isActive: true }, select: { id: true } },
        followups: { orderBy: [{ followupDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
          select: { findingId: true, nextReviewDate: true } } },
    }),
    prisma.controlledDocumentRevision.findMany({
      where: { status: "IN_FORCE", document: { administrativeStatus: "ACTIVE", ...scope } },
      select: { id: true, revisionCode: true, status: true, effectiveFrom: true, reviewDueAt: true,
        lifecycle: { select: { effectiveFrom: true, reviewDueAt: true } },
        document: { select: { id: true, baseCode: true } } },
    }),
  ]);

  const tasks: DashboardTask[] = [];
  for (const d of deviations) {
    const due = d.followups[0]?.nextFollowupDate;
    if (due && withinTaskHorizon(due, asOf)) tasks.push(newTask("DEVIATION", d.id, d.qmsRecord.businessCode ?? "Sin código",
      "Seguimiento de desviación", due, "/deviations/" + d.id, "DEVIATION_FOLLOWUP", asOf, "FOLLOWUP"));
  }
  for (const a of audits) {
    const due = pendingAuditReviewDate(a.followups, new Set(a.findings.map(f => f.id)));
    if (due && withinTaskHorizon(due, asOf)) tasks.push(newTask("AUDIT", a.id, a.qmsRecord.businessCode ?? "Sin código",
      "Próxima revisión de auditoría", due, "/audits/" + a.id, "AUDIT_REVIEW", asOf, "REVIEW"));
  }
  for (const r of revisions) {
    const due = r.lifecycle ? r.lifecycle.reviewDueAt : r.reviewDueAt;
    if (due && withinTaskHorizon(due, asOf)) tasks.push(newTask("PNT", r.id,
      (r.document.baseCode ?? "Sin código") + "/" + r.revisionCode,
      "Revisión documental prevista", due, "/controlled-documents/" + r.document.id, "PNT_REVIEW", asOf, "REVIEW"));
  }

  // Alert engine can list annulled records; enforce the active/department scope
  // without changing administration rules or the existing alert preview service.
  const roots: Record<string, { module: DashboardModule; root: string }> = {
    CAPA: { module: "CAPA", root: "capa" }, CHANGE_CONTROL: { module: "CHANGE_CONTROL", root: "changes" },
    COMPLAINT: { module: "COMPLAINT", root: "complaints" }, RETURN: { module: "RETURN", root: "returns" },
  };
  const parsed = preview.items.flatMap(item => {
    const info = roots[item.module];
    const match = info && new RegExp("^/" + info.root + "/([0-9a-f-]{36})(?:[/?#]|$)", "i").exec(item.href);
    return match && info ? [{ item, id: match[1], module: info.module, root: info.root }] : [];
  });
  const ids = (module: DashboardModule) => parsed.filter(row => row.module === module).map(row => row.id);
  const [capas, changes, complaints, returns] = await Promise.all([
    prisma.capa.findMany({ where: { id: { in: ids("CAPA") }, ...scope, qmsRecord: { isActive: true } }, select: { id: true } }),
    prisma.changeControl.findMany({ where: { id: { in: ids("CHANGE_CONTROL") }, ...scope, qmsRecord: { isActive: true } }, select: { id: true } }),
    prisma.complaint.findMany({ where: { id: { in: ids("COMPLAINT") }, ...scope, qmsRecord: { isActive: true } }, select: { id: true } }),
    prisma.returnRecord.findMany({ where: { id: { in: ids("RETURN") }, ...scope, qmsRecord: { isActive: true } }, select: { id: true } }),
  ]);
  const permitted = new Set([...capas, ...changes, ...complaints, ...returns].map(x => x.id));
  for (const row of parsed) {
    if (!permitted.has(row.id) || !withinTaskHorizon(row.item.dueDate, asOf, 365)) continue;
    tasks.push(newTask(row.module, row.id, row.item.businessCode, row.item.label,
      row.item.dueDate, "/" + row.root + "/" + row.id, "RULE", asOf, row.item.ruleKey));
  }
  return uniqueTasks(tasks);
}

export async function dashboardTrend(filters: DashboardFilters): Promise<{ module: DashboardModule; trend: DashboardTrendPoint[] } | null> {
  const module = filters.module === "ALL" ? "DEVIATION" : filters.module;
  const input = { year: String(filters.year), ...(filters.department ? { department: filters.department } : {}) };
  switch (module) {
    case "DEVIATION": return { module, trend: trendPoints((await getDeviationAnalytics(input)).trend) };
    case "CAPA": return { module, trend: trendPoints((await getCapaAnalytics(input)).trend) };
    case "CHANGE_CONTROL": return { module, trend: trendPoints((await getChangeAnalytics(input)).trend) };
    case "COMPLAINT": return { module, trend: trendPoints((await getComplaintAnalytics(input)).trend) };
    case "RETURN": return { module, trend: trendPoints((await getReturnAnalytics(input)).trend) };
    case "AUDIT": case "PNT": return null;
  }
}

export async function getDashboard(filters: DashboardFilters, asOf = new Date()) {
  const started = performance.now();
  const departments = await prisma.department.findMany({
    where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" },
  });
  const safeDepartment = departments.some(d => d.id === filters.department) ? filters.department : "";
  const actualFilters = { ...filters, department: safeDepartment };
  const [status, tasks, trend] = await Promise.all([
    dashboardStatus(safeDepartment), dashboardTasks(safeDepartment, asOf), dashboardTrend(actualFilters),
  ]);
  const scoped = taskPage(tasks, actualFilters);
  return { filters: actualFilters, asOf: utcDay(asOf), departments, status, trend, tasks: scoped,
    taskCounts: { overdue: tasks.filter(t => actualFilters.module === "ALL" || t.module === actualFilters.module).filter(t => t.state === "OVERDUE").length,
      upcoming: tasks.filter(t => actualFilters.module === "ALL" || t.module === actualFilters.module).filter(t => t.state === "UPCOMING").length },
    modules: DASHBOARD_MODULES, durationMs: Math.round(performance.now() - started) };
}
