import type { QmsModuleContract, QmsModuleKey } from "@/modules/contract";
import { qmsModules, qmsRecordModules } from "@/modules/registry";

const dashboardEntry = (contract: QmsModuleContract) => ({
  key: contract.key,
  label: contract.labels.plural,
  href: contract.href,
  indicatorHref: contract.indicatorsHref,
});

/** Tarjetas con recuentos: módulos con expediente QmsRecord, en orden del registro. */
export const DASHBOARD_MODULES = qmsRecordModules.map(dashboardEntry);
/** Todos los módulos seleccionables en el dashboard, PNT incluido. */
export const DASHBOARD_ALL_MODULES = qmsModules.map(dashboardEntry);

export type DashboardModule = QmsModuleKey;
export type DashboardState = "ALL" | "OPEN" | "CLOSED" | "DRAFT";
/** `mine`: acciones pendientes asignadas al usuario de la sesión (D-102). */
export type DashboardTaskView = "all" | "overdue" | "upcoming" | "mine";
export type DashboardFilters = {
  year: number | null;
  department: string;
  module: DashboardModule | "ALL";
  state: DashboardState;
  taskView: DashboardTaskView;
  page: number;
  asOf: Date;
};

export type DashboardModuleCount = {
  module: Exclude<DashboardModule, "PNT">;
  label: string;
  href: string;
  total: number;
  open: number;
  closed: number;
  draft: number;
  cancelled: number;
  selected: number;
};
export type DashboardTask = {
  key: string;
  module: DashboardModule;
  code: string;
  label: string;
  dueDate: Date;
  state: "OVERDUE" | "UPCOMING";
  href: string;
  source: string;
};
export type DashboardTrendPoint = { year: number; total: number | null; dataAvailable: boolean };

export function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
export function addUtcDays(date: Date, days: number): Date {
  const d = utcDay(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
export function classifyDue(dueDate: Date, today: Date, horizonDays = 30): "OVERDUE" | "UPCOMING" | null {
  const due = utcDay(dueDate).getTime();
  const base = utcDay(today).getTime();
  if (due < base) return "OVERDUE";
  if (due <= addUtcDays(today, horizonDays).getTime()) return "UPCOMING";
  return null;
}
export function moduleCounts(
  key: DashboardModuleCount["module"],
  statuses: ReadonlyArray<{ status: string; count: number }>,
  state: DashboardState,
): DashboardModuleCount {
  const cfg = DASHBOARD_MODULES.find(m => m.key === key)!;
  const count = (value: string) => statuses.filter(s => s.status === value).reduce((n, s) => n + s.count, 0);
  const open = count("OPEN"), closed = count("CLOSED"), draft = count("DRAFT"), cancelled = count("CANCELLED");
  const total = statuses.reduce((n, s) => n + s.count, 0);
  const selected = state === "OPEN" ? open : state === "CLOSED" ? closed : state === "DRAFT" ? draft : total;
  return { module: key, label: cfg.label, href: cfg.href, total, open, closed, draft, cancelled, selected };
}
export function taskIdentity(task: Pick<DashboardTask, "key">): string { return task.key; }
export function uniqueSortedTasks(tasks: DashboardTask[]): DashboardTask[] {
  return [...new Map(tasks.map(task => [taskIdentity(task), task])).values()]
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.code.localeCompare(b.code, "es") || a.key.localeCompare(b.key));
}
export function queryYear(input: string | string[] | undefined): number | null {
  const value = Array.isArray(input) ? input[0] : input;
  if (!value || !/^\d{4}$/.test(value)) return null;
  const number = Number(value);
  return number >= 2000 && number <= 2100 ? number : null;
}
export function queryOption<T extends string>(input: string | string[] | undefined, options: readonly T[], fallback: T): T {
  const value = Array.isArray(input) ? input[0] : input;
  return value && options.some(option => option === value) ? value as T : fallback;
}
export function queryPage(input: string | string[] | undefined): number {
  const value = Array.isArray(input) ? input[0] : input;
  if (!value || !/^[1-9]\d{0,4}$/.test(value)) return 1;
  return Math.min(10000, Number(value));
}
export function countTrend(rows: ReadonlyArray<{ year: number; total: number; dataAvailable: boolean }>): DashboardTrendPoint[] {
  return rows.map(row => ({
    year: row.year,
    total: row.dataAvailable ? row.total : null,
    dataAvailable: row.dataAvailable,
  }));
}
export function moduleListHref(path: string, status: DashboardState, year: number | null, department: string): string {
  const query = new URLSearchParams();
  if (year) query.append("year", String(year));
  if (department) query.append("department", department);
  if (status !== "ALL") query.append("status", status);
  const search = query.toString();
  return path + (search ? "?" + search : "");
}
