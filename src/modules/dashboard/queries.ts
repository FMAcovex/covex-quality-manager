import "server-only";
import { prisma } from "@/lib/db";
import { getAlertPreview } from "@/modules/configuration/admin-queries";
import { getDeviationAnalytics } from "@/modules/deviations/analytics/queries";
import { getCapaAnalytics } from "@/modules/capa/analytics/queries";
import { getChangeAnalytics } from "@/modules/change-control/analytics/queries";
import { getComplaintAnalytics } from "@/modules/complaints/analytics/queries";
import { getReturnAnalytics } from "@/modules/returns/analytics/queries";
import { pendingAuditReviewDate } from "@/modules/audits/followup-review";
import { operationalDates } from "@/modules/controlled-documents/listing";
import { DASHBOARD_MODULES, splitTasks, summarizeStatuses, trendPoints, type DashboardFilters, type DashboardModule, type DashboardTask, type DashboardTrend } from "./domain";

const DAY = 86400000;
const todayUtc = (at: Date) => new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
function toTask(module: DashboardModule, key: string, href: string, businessCode: string | null, label: string, date: Date, detail: string, today: Date): DashboardTask {
  return { module, key, href, businessCode: businessCode || "Sin código", label, dueDate: date, detail, state: todayUtc(date) < today ? "OVERDUE" : "UPCOMING" };
}
function asRows<R extends string>(grouped: readonly { status: R; _count: { _all: number } }[]) {
  return grouped.map(x => ({ status: x.status, count: x._count._all }));
}
function yearMetricUrl(module: DashboardModule, year: number, department?: string) {
  const found = DASHBOARD_MODULES.find(m => m.key === module);
  if (!found?.indicators) return null;
  const q = new URLSearchParams({ year: String(year) });
  if (department) q.set("department", department);
  return found.indicators + "?" + q.toString();
}
async function getTrend(module: DashboardModule, year: number, department?: string): Promise<DashboardTrend> {
  const filters = { year: String(year), ...(department ? { department } : {}) };
  const analytics = module === "DEVIATION" ? await getDeviationAnalytics(filters)
    : module === "CAPA" ? await getCapaAnalytics(filters)
    : module === "CHANGE_CONTROL" ? await getChangeAnalytics(filters)
    : module === "COMPLAINT" ? await getComplaintAnalytics(filters)
    : module === "RETURN" ? await getReturnAnalytics(filters) : null;
  if (!analytics) return null;
  return { module, year: analytics.selectedYear, points: trendPoints(analytics.trend), indicatorHref: yearMetricUrl(module, year, department)! };
}

export async function getDashboardData(filters: DashboardFilters, referenceDate = new Date()) {
  const dep = filters.departmentId;
  const byDepartment = dep ? { departmentId: dep } : {};
  const activeWhere = { qmsRecord: { isActive: true, ...(filters.year ? { year: filters.year } : {}) }, ...byDepartment };
  const auditWhere = { qmsRecord: { isActive: true, ...(filters.year ? { year: filters.year } : {}) }, ...(dep ? { departments: { some: { isActive: true, departmentId: dep } } } : {}) };
  const documentWhere = { administrativeStatus: "ACTIVE" as const, ...byDepartment };
  const today = todayUtc(referenceDate);
  const upcomingLimit = new Date(today.getTime() + 30 * DAY);

  // Group by the actual module status: never count 1:N relations or displayed table rows.
  const [deviations, capas, changes, complaints, returns, audits, masters, revisions, departments, alerts, deviationDue, auditDue, availableYears] = await Promise.all([
    prisma.deviation.groupBy({ by: ["status"], where: activeWhere, _count: { _all: true } }),
    prisma.capa.groupBy({ by: ["status"], where: activeWhere, _count: { _all: true } }),
    prisma.changeControl.groupBy({ by: ["finalStatus"], where: activeWhere, _count: { _all: true } }),
    prisma.complaint.groupBy({ by: ["status"], where: activeWhere, _count: { _all: true } }),
    prisma.returnRecord.groupBy({ by: ["status"], where: activeWhere, _count: { _all: true } }),
    prisma.audit.groupBy({ by: ["status"], where: auditWhere, _count: { _all: true } }),
    prisma.controlledDocument.count({ where: documentWhere }),
    prisma.controlledDocumentRevision.findMany({
      where: { status: "IN_FORCE", document: documentWhere },
      select: { id: true, documentId: true, revisionCode: true, status: true, verificationStatus: true,
        effectiveFrom: true, reviewDueAt: true, lifecycle: { select: { effectiveFrom: true, reviewDueAt: true } },
        document: { select: { baseCode: true } } },
      orderBy: [{ revisionCode: "desc" }, { id: "desc" }],
    }),
    prisma.department.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    getAlertPreview(referenceDate),
    prisma.deviation.findMany({ where: { ...activeWhere, status: "OPEN" },
      select: { id: true, qmsRecord: { select: { businessCode: true } }, followups: { orderBy: [{ followupDate: "desc" }, { createdAt: "desc" }], take: 1, select: { nextFollowupDate: true } } } }),
    prisma.audit.findMany({ where: { ...auditWhere, status: "OPEN" },
      select: { id: true, qmsRecord: { select: { businessCode: true } },
        findings: { where: { isActive: true }, select: { id: true } },
        followups: { orderBy: [{ followupDate: "desc" }, { createdAt: "desc" }, { id: "desc" }], select: { findingId: true, nextReviewDate: true } } } }),
    prisma.qmsRecord.findMany({ where: { isActive: true, year: { not: null } }, select: { year: true }, distinct: ["year"], orderBy: { year: "desc" } }),
  ]);

  const make = (module: DashboardModule, rows: { status: string; count: number }[]) =>
    summarizeStatuses(module, rows, DASHBOARD_MODULES.find(m => m.key === module)!.href);
  const distinctPnt = new Map<string, typeof revisions[number]>();
  for (const r of revisions) if (!distinctPnt.has(r.documentId)) distinctPnt.set(r.documentId, r);
  const pntDue = [...distinctPnt.values()].filter(r => {
    const due = operationalDates(r).reviewDueAt;
    return Boolean(due && due < today.toISOString().slice(0, 10));
  }).length;
  const cards = [
    make("DEVIATION", asRows(deviations)),
    make("CAPA", asRows(capas)),
    make("CHANGE_CONTROL", changes.map(x => ({ status: x.finalStatus, count: x._count._all }))),
    make("COMPLAINT", asRows(complaints)),
    make("RETURN", asRows(returns)),
    make("AUDIT", asRows(audits)),
    { module: "PNT" as const, href: "/controlled-documents", total: masters, open: pntDue, draft: 0, closed: 0, other: masters - pntDue },
  ];
  const tasks: DashboardTask[] = [];
  // Alert preview is authoritative for *configured* alert sources. Verify actual active
  // records before displaying them: the original preview does not filter administrative annulments.
  const alertModules = [
    { module: "CAPA" as const, path: "/capa/", ids: [] as string[] },
    { module: "CHANGE_CONTROL" as const, path: "/changes/", ids: [] as string[] },
    { module: "COMPLAINT" as const, path: "/complaints/", ids: [] as string[] },
    { module: "RETURN" as const, path: "/returns/", ids: [] as string[] },
  ];
  for (const i of alerts.items) {
    const group = alertModules.find(m => m.module === i.module && i.href.startsWith(m.path));
    const id = group && i.href.slice(group.path.length).split(/[/?#]/)[0];
    if (group && id && /^[0-9a-f-]{36}$/i.test(id)) group.ids.push(id);
  }
  const [eligibleCapas, eligibleChanges, eligibleComplaints, eligibleReturns] = await Promise.all([
    prisma.capa.findMany({ where: { ...activeWhere, id: { in: alertModules[0].ids } }, select: { id: true } }),
    prisma.changeControl.findMany({ where: { ...activeWhere, id: { in: alertModules[1].ids } }, select: { id: true } }),
    prisma.complaint.findMany({ where: { ...activeWhere, id: { in: alertModules[2].ids } }, select: { id: true } }),
    prisma.returnRecord.findMany({ where: { ...activeWhere, id: { in: alertModules[3].ids } }, select: { id: true } }),
  ]);
  const eligible = new Map<DashboardModule, Set<string>>([
    ["CAPA", new Set(eligibleCapas.map(x => x.id))],
    ["CHANGE_CONTROL", new Set(eligibleChanges.map(x => x.id))],
    ["COMPLAINT", new Set(eligibleComplaints.map(x => x.id))],
    ["RETURN", new Set(eligibleReturns.map(x => x.id))],
  ]);
  for (const i of alerts.items) {
    const group = alertModules.find(m => m.module === i.module && i.href.startsWith(m.path));
    if (!group) continue;
    const id = i.href.slice(group.path.length).split(/[/?#]/)[0];
    if (!eligible.get(group.module)?.has(id)) continue;
    const tab = group.module === "CAPA" ? (i.ruleKey === "CAPA_EFFECTIVENESS_PENDING" ? "state" : "versions")
      : group.module === "COMPLAINT" ? "part-ii" : "followups";
    tasks.push(toTask(group.module, i.key, group.path + encodeURIComponent(id) + "?tab=" + tab,
      i.businessCode, i.label, i.dueDate, i.detail, today));
  }
  // Existing deviation list semantics: latest followup, active/open only; no invented deadline.
  for (const r of deviationDue) {
    const due = r.followups[0]?.nextFollowupDate;
    if (!due || todayUtc(due) > upcomingLimit) continue;
    tasks.push(toTask("DEVIATION", "DEV-F-" + r.id, "/deviations/" + r.id + "?tab=actions",
      r.qmsRecord.businessCode, "Seguimiento de desviación", due, "Fecha del último seguimiento", today));
  }
  // Audit scopes: the newest blank resets a date for its own finding/general scope.
  for (const r of auditDue) {
    const due = pendingAuditReviewDate(r.followups, new Set(r.findings.map(f => f.id)));
    if (!due || todayUtc(due) > upcomingLimit) continue;
    tasks.push(toTask("AUDIT", "AUD-F-" + r.id, "/audits/" + r.id,
      r.qmsRecord.businessCode, "Revisión de auditoría", due, "Próxima revisión de hallazgos o seguimiento", today));
  }
  for (const r of distinctPnt.values()) {
    const due = operationalDates(r).reviewDueAt;
    if (!due || due > upcomingLimit.toISOString().slice(0, 10)) continue;
    tasks.push(toTask("PNT", "PNT-R-" + r.documentId, "/controlled-documents/" + r.documentId,
      r.document.baseCode, "Revisión de PNT", new Date(due + "T00:00:00.000Z"),
      "Revisión en vigor " + r.revisionCode, today));
  }

  tasks.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.key.localeCompare(b.key));
  const uniqueTasks = [...new Map(tasks.map(t => [t.key, t])).values()];
  const paged = splitTasks(uniqueTasks, filters.taskView, filters.page);
  const trend = await getTrend(filters.module, filters.year ?? referenceDate.getUTCFullYear(), dep);
  const years = [...new Set([referenceDate.getUTCFullYear(), ...(filters.year ? [filters.year] : []), ...availableYears.map(r => r.year).filter((y): y is number => y !== null)])].sort((a,b) => b-a);
  return { asOf: today, filters, years, departments, cards, tasks: paged, totals: {
    overdue: uniqueTasks.filter(x => x.state === "OVERDUE").length,
    upcoming: uniqueTasks.filter(x => x.state === "UPCOMING").length,
    affectedRecords: new Set(uniqueTasks.map(x => x.module + ":" + x.href.split("?")[0])).size,
  }, trend, alertRuleCount: alerts.rules.length, pntRevisionsInForce: revisions.length };
}
