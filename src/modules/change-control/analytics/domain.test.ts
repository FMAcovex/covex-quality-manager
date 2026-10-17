import { describe, expect, it } from "vitest";
import {
  buildChangeBacklog,
  buildChangeYearToDate,
  changeScopeDistribution,
  type ChangeAnalyticsRow,
} from "@/modules/change-control/analytics/domain";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const today = d("2026-10-17");

function row(patch: Partial<ChangeAnalyticsRow> = {}): ChangeAnalyticsRow {
  return {
    openingYear: 2026, requestDate: d("2026-02-01"), executionDate: d("2026-04-01"), effectiveClosedAt: d("2026-06-01"),
    finalStatus: "CLOSED", classification: "MINOR", executionStatus: "EXECUTED", effectivenessStatus: "ACCEPTABLE",
    departmentCode: "PRO", plannedDates: [d("2026-05-01")], scopes: ["EQUIPMENT"], ...patch,
  };
}

describe("Controles de cambios: tendencias y pendientes", () => {
  it("cuenta los alcances marcados del año con su etiqueta", () => {
    const items = changeScopeDistribution([
      row({ scopes: ["EQUIPMENT", "PROCESS"] }), row(), row({ scopes: [] }), row({ openingYear: 2025, scopes: ["SUPPLIER"] }),
    ], 2026);
    expect(items.map((item) => [item.label, item.count])).toEqual([["Equipos", 2], ["Proceso", 1], ["Sin alcance indicado", 1]]);
  });

  it("compara solicitudes, ejecución y eficacia hasta el mismo día", () => {
    const ytd = buildChangeYearToDate([
      row({ classification: "MAJOR" }),
      row({ requestDate: d("2025-10-18"), executionDate: d("2025-10-01"), plannedDates: [d("2025-09-01")], effectiveClosedAt: null, effectivenessStatus: "PENDING" }),
    ], 2026, new Set([2025, 2026]), today);
    expect(ytd.rows.map((item) => [item.label, item.current, item.previous])).toEqual([
      ["Solicitudes", 1, 0], ["Mayores", 1, 0], ["Ejecutados", 1, 1], ["Ejecución en plazo", 100, 0],
      ["Eficacias evaluadas", 1, 0], ["Eficacia aceptable", 100, null],
    ]);
  });

  it("solo da por superada la fecha prevista de los controles sin ejecutar", () => {
    const base = { classification: null, effectivenessStatus: "PENDING" as const, nextFollowupDate: null };
    const backlog = buildChangeBacklog([
      { ...base, id: "a", code: "CC-1", requestDate: d("2026-01-10"), classification: "MAJOR", executionStatus: "NOT_EXECUTED", plannedDates: [d("2026-10-16")], nextFollowupDate: d("2026-10-17") },
      { ...base, id: "b", code: "CC-2", requestDate: d("2026-09-30"), executionStatus: "EXECUTED", plannedDates: [d("2026-05-01")] },
      { ...base, id: "c", code: "CC-3", requestDate: null, executionStatus: "NOT_EXECUTED", plannedDates: [d("2026-10-17")] },
    ], today);
    expect([backlog.total, backlog.overdue, backlog.pendingEffectiveness, backlog.followupDue, backlog.withoutStartDate]).toEqual([3, 1, 1, 1, 1]);
    expect(backlog.buckets[3].tags).toEqual({ MAJOR: 1, OVERDUE: 1 });
    expect(backlog.oldest[0]).toMatchObject({ code: "CC-1", note: "Mayor · prevista superada" });
  });
});
