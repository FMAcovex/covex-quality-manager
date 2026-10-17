import { describe, expect, it } from "vitest";
import {
  buildReturnBacklog,
  buildReturnYearToDate,
  decisionDays,
  medianDecisionDays,
  returnProductMentions,
  type ReturnTrendRow,
} from "@/modules/returns/analytics/domain";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const today = d("2026-10-17");

function row(patch: Partial<ReturnTrendRow> = {}): ReturnTrendRow {
  return { openingYear: 2026, communicationDate: d("2026-02-01"), closedAt: null, decisionDate: d("2026-02-11"), decision: "ACCEPTED", productTypes: ["MEDICINE"], ...patch };
}

describe("Devoluciones: tendencias y pendientes", () => {
  it("no calcula días de decisión mientras está pendiente", () => {
    expect(decisionDays(row())).toBe(10);
    expect(decisionDays(row({ decision: "PENDING" }))).toBeNull();
    expect(medianDecisionDays([row(), row({ decisionDate: d("2026-02-21") }), row({ decision: "PENDING" })], 2026)).toBe(15);
  });

  it("rotula los tipos de producto de todas las líneas", () => {
    const items = returnProductMentions([row({ productTypes: ["MEDICINE", "API"] }), row(), row({ productTypes: [] })], 2026);
    expect(items.map((item) => [item.label, item.count])).toEqual([["Medicamento", 2], ["API", 1], ["Sin producto registrado", 1]]);
  });

  it("compara el acumulado y cuenta las decisiones por su fecha", () => {
    const ytd = buildReturnYearToDate([
      row(),
      row({ openingYear: 2025, communicationDate: d("2025-09-01"), decision: "REJECTED", decisionDate: d("2025-12-01"), closedAt: d("2025-10-01") }),
    ], 2026, new Set([2025, 2026]), today);
    expect(ytd.rows.map((item) => [item.label, item.current, item.previous])).toEqual([
      ["Devoluciones", 1, 1], ["Aceptadas", 1, 0], ["Rechazadas", 0, 0], ["Cierres", 0, 1], ["Mediana comunicación→decisión", 10, null],
    ]);
  });

  it("marca la decisión pendiente y el seguimiento vencido como el listado", () => {
    const backlog = buildReturnBacklog([
      { id: "a", code: "DV-1", communicationDate: d("2026-06-01"), returnType: "TRANSPORT", decision: "PENDING", nextFollowupDate: d("2026-10-17") },
      { id: "b", code: "DV-2", communicationDate: d("2026-10-10"), returnType: "COMMERCIAL", decision: "ACCEPTED", nextFollowupDate: d("2026-10-18") },
    ], today);
    expect([backlog.total, backlog.pendingDecision, backlog.followupDue]).toEqual([2, 1, 1]);
    expect(backlog.oldest[0]).toMatchObject({ code: "DV-1", note: "Transporte · decisión pendiente" });
  });
});
