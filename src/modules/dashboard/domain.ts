export const DASHBOARD_MODULES = [
  { key: "DEVIATION", label: "Desviaciones", href: "/deviations", indicators: "/deviations/indicators" },
  { key: "CAPA", label: "CAPA", href: "/capa", indicators: "/capa/indicators" },
  { key: "CHANGE_CONTROL", label: "Controles de cambios", href: "/changes", indicators: "/changes/indicators" },
  { key: "COMPLAINT", label: "Reclamaciones", href: "/complaints", indicators: "/complaints/indicators" },
  { key: "RETURN", label: "Devoluciones", href: "/returns", indicators: "/returns/indicators" },
  { key: "AUDIT", label: "Auditorías", href: "/audits", indicators: null },
  { key: "PNT", label: "PNT", href: "/controlled-documents", indicators: null },
] as const;
export type DashboardModule = typeof DASHBOARD_MODULES[number]["key"];
export type DashboardFilters = { year?: number; departmentId?: string; module: DashboardModule; taskView: "all" | "overdue" | "upcoming"; page: number };
export type DashboardCard = { module: DashboardModule; total: number; open: number; draft: number; closed: number; other: number; href: string };
export type DashboardTask = { key: string; module: DashboardModule; businessCode: string; label: string; dueDate: Date; state: "OVERDUE" | "UPCOMING"; href: string; detail: string };
export type DashboardTrendPoint = { year: number; dataAvailable: boolean; total: number; open: number };
export type DashboardTrend = { module: DashboardModule; year: number; points: DashboardTrendPoint[]; indicatorHref: string } | null;

/** Distinct records, not related actions, children, plan entries or document revisions. */
export function summarizeStatuses(module: DashboardModule, values: readonly { status: string; count: number }[], href: string): DashboardCard {
  const counts = new Map(values.map(x => [x.status, x.count]));
  const total = values.reduce((n, row) => n + row.count, 0);
  const open = counts.get("OPEN") ?? 0, draft = counts.get("DRAFT") ?? 0, closed = counts.get("CLOSED") ?? 0;
  return { module, href, total, open, draft, closed, other: total - open - draft - closed };
}

/** Input validation is shared with the page and exercised by unit tests. */
export function normalizeDashboardFilters(raw: Record<string, string | string[] | undefined>): DashboardFilters {
  const first = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;
  const moduleValue = first(raw.module);
  const module = DASHBOARD_MODULES.some(m => m.key === moduleValue) ? moduleValue as DashboardModule : "DEVIATION";
  const yearText = first(raw.year), parsed = yearText && /^\d{4}$/.test(yearText) ? Number(yearText) : null;
  const year = parsed !== null && parsed >= 2000 && parsed <= 2100 ? parsed : undefined;
  const dep = first(raw.department), departmentId = dep && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(dep) ? dep : undefined;
  const taskValue = first(raw.taskView), taskView = taskValue === "overdue" || taskValue === "upcoming" ? taskValue : "all";
  const pageValue = first(raw.page), requestedPage = pageValue && /^[1-9]\d{0,5}$/.test(pageValue) ? Number(pageValue) : 1;
  return { year, departmentId, module, taskView, page: requestedPage };
}
export function splitTasks(items: DashboardTask[], view: DashboardFilters["taskView"], page: number, pageSize = 10) {
  const filtered = view === "all" ? items : items.filter(x => x.state === (view === "overdue" ? "OVERDUE" : "UPCOMING"));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pages);
  return { total: filtered.length, page: safePage, pages, items: filtered.slice((safePage - 1) * pageSize, safePage * pageSize) };
}
export function trendPoints(rows: readonly { year: number; dataAvailable: boolean; total: number; openCurrent?: number; open?: number }[]): DashboardTrendPoint[] {
  return rows.map(r => ({ year: r.year, dataAvailable: r.dataAvailable, total: r.total, open: r.openCurrent ?? r.open ?? 0 }));
}
