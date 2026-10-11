import { describe, expect, it } from "vitest";
import {
  addUtcDays, classifyDue, countTrend, moduleCounts, moduleListHref,
  queryOption, queryPage, queryYear, uniqueSortedTasks, utcDay,
  type DashboardTask,
} from "./domain";

describe("D1B — Contratos del dashboard", () => {
  it("no cuenta borradores, cerrados o cancelados como abiertos", () => {
    const result = moduleCounts("CAPA", [
      { status: "OPEN", count: 3 }, { status: "CLOSED", count: 4 },
      { status: "DRAFT", count: 2 }, { status: "CANCELLED", count: 1 },
    ], "OPEN");
    expect(result).toMatchObject({ total: 10, open: 3, closed: 4, draft: 2, cancelled: 1, selected: 3 });
    expect(moduleCounts("CAPA", [{ status: "DRAFT", count: 2 }], "ALL").open).toBe(0);
  });

  it("respeta días UTC, hoy no es vencido y los próximos se limitan a 30 días", () => {
    const today = new Date("2026-10-11T23:30:00.000Z");
    expect(utcDay(today).toISOString()).toBe("2026-10-11T00:00:00.000Z");
    expect(classifyDue(new Date("2026-10-10T00:00:00Z"), today)).toBe("OVERDUE");
    expect(classifyDue(new Date("2026-10-11T00:00:00Z"), today)).toBe("UPCOMING");
    expect(classifyDue(addUtcDays(today, 30), today)).toBe("UPCOMING");
    expect(classifyDue(addUtcDays(today, 31), today)).toBeNull();
    expect(addUtcDays(new Date("2026-12-30T12:00:00Z"), 3).toISOString()).toBe("2027-01-02T00:00:00.000Z");
  });

  it("distingue cero con cobertura de ausencia de cobertura", () => {
    expect(countTrend([
      { year: 2024, total: 10, dataAvailable: true },
      { year: 2025, total: 0, dataAvailable: true },
      { year: 2026, total: 0, dataAvailable: false },
    ])).toEqual([
      { year: 2024, total: 10, dataAvailable: true },
      { year: 2025, total: 0, dataAvailable: true },
      { year: 2026, total: null, dataAvailable: false },
    ]);
  });

  it("elimina duplicados únicamente si tienen misma identidad de obligación", () => {
    const first: DashboardTask = {
      key: "CAPA-E-1", module: "CAPA", code: "AC-1", label: "Eficacia",
      dueDate: new Date("2026-10-12T00:00:00Z"), state: "UPCOMING", href: "/capa/1", source: "Test",
    };
    const followup = { ...first, key: "CAPA-F-1", label: "Seguimiento" };
    expect(uniqueSortedTasks([first, first, followup])).toHaveLength(2);
  });

  it("valida filtros y construye únicamente destinos internos", () => {
    expect(queryYear("2026")).toBe(2026);
    expect(queryYear("9999")).toBeNull();
    expect(queryYear("2e26")).toBeNull();
    expect(queryOption("BOGUS", ["ALL", "CAPA"] as const, "ALL")).toBe("ALL");
    expect(queryPage("-1")).toBe(1);
    expect(queryPage("12000")).toBe(10000);
    expect(moduleListHref("/capa", "OPEN", 2026, "abc")).toBe("/capa?year=2026&department=abc&status=OPEN");
  });
});
