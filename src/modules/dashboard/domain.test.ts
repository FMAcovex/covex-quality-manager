import { describe, expect, it } from "vitest";
import {
  dayState, normalizeDashboardFilters, statusFromGroups, taskPage, trendPoints, uniqueTasks, utcDay, withinTaskHorizon,
  DASHBOARD_TASK_PAGE_SIZE, type DashboardTask,
} from "./domain";

const asOf = new Date("2026-10-11T23:40:00.000Z");
const task = (key: string, date: string, module: "CAPA" | "AUDIT" = "CAPA"): DashboardTask => ({
  key, module, code: key, label: "Revisión", dueDate: date,
  state: date < "2026-10-11" ? "OVERDUE" : "UPCOMING",
  href: module === "CAPA" ? "/capa/test" : "/audits/test", source: "RULE",
});
describe("D1B: filtros seguros y semántica de dashboard", () => {
  it("selecciona parámetros válidos, limita paginación y evita valores desconocidos", () => {
    expect(normalizeDashboardFilters({ year: ["2025"], module: "CAPA", taskView: "overdue", page: "3" }, asOf))
      .toEqual({ year: 2025, department: "", module: "CAPA", taskView: "overdue", page: 3 });
    expect(normalizeDashboardFilters({ year: "xyz", module: "EXTERNAL", taskView: "bad", page: "-4" }, asOf))
      .toMatchObject({ year: 2026, module: "ALL", taskView: "all", page: 1 });
  });
  it("distingue vencido del día vigente y conserva fechas UTC @db.Date", () => {
    expect(dayState(new Date("2026-10-10T00:00:00Z"), asOf)).toBe("OVERDUE");
    expect(dayState(new Date("2026-10-11T00:00:00Z"), asOf)).toBe("UPCOMING");
    expect(utcDay(new Date("2026-10-11T00:00:00Z"))).toBe("2026-10-11");
    expect(withinTaskHorizon(new Date("2026-11-10T00:00:00Z"), asOf)).toBe(true);
    expect(withinTaskHorizon(new Date("2026-11-11T00:00:00Z"), asOf)).toBe(false);
  });
  it("no duplica una obligación ni suma categorías heterogéneas", () => {
    const items = uniqueTasks([task("x", "2026-10-13"), task("a", "2026-10-10", "AUDIT"), task("x", "2026-10-13")]);
    expect(items.map(x => x.key)).toEqual(["a", "x"]);
    expect(taskPage(items, { module: "CAPA", taskView: "all", page: 1 }).total).toBe(1);
    expect(taskPage(items, { module: "ALL", taskView: "overdue", page: 1 }).total).toBe(1);
  });
  it("pagina todas las tareas y corrige página fuera de rango", () => {
    const items = Array.from({ length: DASHBOARD_TASK_PAGE_SIZE + 1 }, (_, i) => task(String(i), "2026-11-01"));
    const selected = taskPage(items, { module: "ALL", taskView: "all", page: 2 });
    expect(selected.total).toBe(DASHBOARD_TASK_PAGE_SIZE + 1);
    expect(selected.items).toHaveLength(1);
    expect(taskPage(items, { module: "ALL", taskView: "all", page: 400 }).page).toBe(2);
  });
  it("las cifras provienen de grupos sin depender de filas de listas limitadas", () => {
    const status = statusFromGroups("CAPA", "/capa", [
      { status: "OPEN", _count: { _all: 6 } }, { status: "DRAFT", _count: { _all: 2 } },
      { status: "CLOSED", _count: { _all: 7 } }, { status: "CANCELLED", _count: { _all: 1 } },
    ], { draft: "DRAFT", open: "OPEN", closed: "CLOSED" });
    expect(status).toMatchObject({ open: 6, drafts: 2, closed: 7, other: 1, total: 16, openHref: "/capa?status=OPEN" });
  });
  it("«Sin datos» no se convierte en cero histórico", () => {
    expect(trendPoints([
      { year: 2025, dataAvailable: false, total: 0 },
      { year: 2026, dataAvailable: true, total: 0 },
    ])).toEqual([
      { year: 2025, dataAvailable: false, total: null },
      { year: 2026, dataAvailable: true, total: 0 },
    ]);
  });
});