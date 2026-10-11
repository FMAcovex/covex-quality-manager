/**
 * Dashboard-only presentation contracts. Operational counts are distinct from
 * historical KPI cohorts and do not apply includeInKpi exclusions.
 */
export const DASHBOARD_MODULES = [
  { id: "DEVIATION", name: "Desviaciones", href: "/deviations", indicators: "/deviations/indicators" },
  { id: "CAPA", name: "CAPA", href: "/capa", indicators: "/capa/indicators" },
  { id: "CHANGE_CONTROL", name: "Controles de cambios", href: "/changes", indicators: "/changes/indicators" },
  { id: "COMPLAINT", name: "Reclamaciones", href: "/complaints", indicators: "/complaints/indicators" },
  { id: "RETURN", name: "Devoluciones", href: "/returns", indicators: "/returns/indicators" },
  { id: "AUDIT", name: "Auditorías", href: "/audits", indicators: null },
  { id: "PNT", name: "PNT / documentos", href: "/controlled-documents", indicators: null },
] as const;

export type DashboardModule = typeof DASHBOARD_MODULES[number]["id"];
export type DashboardTaskState = "OVERDUE" | "UPCOMING";
export type DashboardTask = {
  key: string;
  module: DashboardModule;
  code: string;
  label: string;
  dueDate: string;
  state: DashboardTaskState;
  href: string;
  source: "RULE" | "AUDIT_REVIEW" | "DEVIATION_FOLLOWUP" | "PNT_REVIEW";
};

export type DashboardStatus = { module: DashboardModule; open: number; drafts: number; closed: number; other: number; total: number; href: string; openHref: string };
export type DashboardTrendPoint = { year: number; total: number | null; dataAvailable: boolean };
export type DashboardTaskView = "all" | "overdue" | "upcoming";
export type DashboardFilters = { year: number; department: string; module: DashboardModule | "ALL"; taskView: DashboardTaskView; page: number };
export const DASHBOARD_TASK_PAGE_SIZE = 12;

export function normalizeDashboardFilters(
  query: Record<string, string | string[] | undefined>,
  asOf = new Date(),
): DashboardFilters {
  const first = (key: string) => {
    const value = query[key];
    return typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;
  };
  const year = Number(first("year"));
  const page = Number(first("page"));
  const module = first("module");
  const taskView = first("taskView");
  return {
    year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : asOf.getUTCFullYear(),
    department: first("department") || "",
    module: DASHBOARD_MODULES.some(m => m.id === module) ? module as DashboardModule : "ALL",
    taskView: taskView === "overdue" || taskView === "upcoming" ? taskView : "all",
    page: Number.isSafeInteger(page) && page >= 1 ? Math.min(page, 100000) : 1,
  };
}
export function utcDay(date: Date): string { return date.toISOString().slice(0, 10); }
export function dayState(due: Date, asOf: Date): DashboardTaskState {
  return utcDay(due) < utcDay(asOf) ? "OVERDUE" : "UPCOMING";
}
export function withinTaskHorizon(due: Date, asOf: Date, leadDays = 30): boolean {
  const max = new Date(utcDay(asOf) + "T00:00:00.000Z");
  max.setUTCDate(max.getUTCDate() + leadDays);
  return utcDay(due) <= utcDay(max);
}
/** Scope/date/category uniquely identify an obligation, not merely a record. */
export function uniqueTasks(tasks: DashboardTask[]): DashboardTask[] {
  return [...new Map(tasks.map(item => [item.key, item])).values()]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.module.localeCompare(b.module) || a.key.localeCompare(b.key));
}
export function taskPage(tasks: DashboardTask[], filters: Pick<DashboardFilters, "module" | "taskView" | "page">) {
  const scoped = tasks.filter(t => (filters.module === "ALL" || t.module === filters.module) &&
    (filters.taskView === "all" || t.state.toLowerCase() === filters.taskView));
  const pages = Math.max(1, Math.ceil(scoped.length / DASHBOARD_TASK_PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  return { total: scoped.length, page, pages, items: scoped.slice((page - 1) * DASHBOARD_TASK_PAGE_SIZE, page * DASHBOARD_TASK_PAGE_SIZE) };
}
export function statusFromGroups(
  moduleId: DashboardModule, href: string, groups: readonly { status: string; _count: { _all: number } }[],
  options: { draft: string; open: string; closed: string; statusKey?: string },
): DashboardStatus {
  const count = (status: string) => groups.find(g => g.status === status)?._count._all ?? 0;
  const open = count(options.open), drafts = count(options.draft), closed = count(options.closed);
  const total = groups.reduce((sum, row) => sum + row._count._all, 0);
  return { module: moduleId, href, total, open, drafts, closed, other: total - open - drafts - closed,
    openHref: href + "?status=" + encodeURIComponent(options.open) };
}
export function trendPoints(items: readonly { year: number; total: number; dataAvailable: boolean }[]): DashboardTrendPoint[] {
  return items.map(x => ({ year: x.year, total: x.dataAvailable ? x.total : null, dataAvailable: x.dataAvailable }));
}
