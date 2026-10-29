import type { DashboardModule } from "./domain";
import { addUtcDays, utcDay } from "./domain";

/**
 * Calendario de vencimientos (D-120): vista de mes o de semana con las fechas pendientes de todos
 * los módulos. Este fichero solo calcula periodos y agrupa; las reglas de qué está pendiente son
 * las del panel y de «Mis tareas».
 */
export const CALENDAR_VIEWS = ["month", "week"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];
export type CalendarScope = "all" | "mine";

export type CalendarItem = {
  key: string;
  module: DashboardModule;
  code: string;
  label: string;
  detail: string;
  date: Date;
  overdue: boolean;
  href: string;
};

export type CalendarQuery = { view: CalendarView; anchor: Date; module: DashboardModule | "ALL"; department: string; scope: CalendarScope };

const DAY = 86_400_000;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

/** Lunes de la semana de `date` (semana de lunes a domingo, en UTC). */
export function weekStart(date: Date) {
  const day = utcDay(date);
  return addUtcDays(day, -((day.getUTCDay() + 6) % 7));
}

export function parseCalendarQuery(query: Record<string, string | string[] | undefined>, today: Date, modules: readonly DashboardModule[]): CalendarQuery {
  const rawDate = first(query.date);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? new Date(`${rawDate}T00:00:00Z`) : null;
  const anchor = parsed && !Number.isNaN(parsed.getTime()) && isoDay(parsed) === rawDate ? parsed : utcDay(today);
  const module = first(query.module);
  return {
    view: first(query.view) === "week" ? "week" : "month",
    anchor,
    module: (modules as readonly string[]).includes(module) ? module as DashboardModule : "ALL",
    department: first(query.department),
    scope: first(query.scope) === "mine" ? "mine" : "all",
  };
}

/** Días que se pintan: semanas completas de lunes a domingo; `to` es exclusivo. */
export function calendarRange(view: CalendarView, anchor: Date) {
  const from = view === "week" ? weekStart(anchor) : weekStart(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1)));
  const lastShown = view === "week" ? addUtcDays(from, 6) : addUtcDays(weekStart(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0))), 6);
  const days: Date[] = [];
  for (let time = from.getTime(); time <= lastShown.getTime(); time += DAY) days.push(new Date(time));
  return { from, to: addUtcDays(lastShown, 1), days };
}

export function shiftAnchor(view: CalendarView, anchor: Date, step: -1 | 1) {
  return view === "week" ? addUtcDays(anchor, 7 * step) : new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + step, 1));
}

const monthTitle = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
const shortDate = (date: Date) => isoDay(date).split("-").reverse().join("/");

export function calendarTitle(view: CalendarView, anchor: Date) {
  if (view === "month") return monthTitle.format(anchor).replace(/^./, (c) => c.toUpperCase());
  const start = weekStart(anchor);
  return `Semana del ${shortDate(start)} al ${shortDate(addUtcDays(start, 6))}`;
}

export function groupByDay(items: CalendarItem[]) {
  const groups = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const key = isoDay(item.date);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

export function sortCalendarItems(items: CalendarItem[]) {
  return [...items].sort((a, b) => a.date.getTime() - b.date.getTime() || a.module.localeCompare(b.module) || a.code.localeCompare(b.code, "es") || a.key.localeCompare(b.key));
}

export { isoDay as calendarDayKey };
