import { describe, expect, it } from "vitest";
import {
  buildComplaintBacklog,
  buildComplaintYearToDate,
  complaintMentions,
  medianResponseDays,
  type ComplaintTrendRow,
} from "@/modules/complaints/analytics/domain";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const today = d("2026-10-17");

function row(patch: Partial<ComplaintTrendRow> = {}): ComplaintTrendRow {
  return {
    openingYear: 2026, openedAt: d("2026-03-01"), closedAt: null, receptionDate: d("2026-02-27"), responseDate: d("2026-03-09"),
    classification: "MINOR", recurrent: false, categoryTypes: ["PACKAGING"], sourceTypes: ["CUSTOMER"], ...patch,
  };
}

describe("Reclamaciones: tendencias y pendientes", () => {
  it("rotula las categorías y fuentes marcadas y cuenta las vacías aparte", () => {
    const rows = [row({ categoryTypes: ["PACKAGING", "PRODUCT_QUALITY"] }), row(), row({ categoryTypes: [], sourceTypes: [] })];
    expect(complaintMentions(rows, 2026, "categoryTypes").map((item) => [item.label, item.count])).toEqual([
      ["Acondicionamiento / envase", 2], ["Calidad del producto", 1], ["Sin categoría indicada", 1],
    ]);
    expect(complaintMentions(rows, 2026, "sourceTypes").map((item) => [item.label, item.count])).toEqual([["Cliente", 2], ["Sin origen indicado", 1]]);
  });

  it("calcula la mediana recepción→respuesta por año de respuesta", () => {
    const rows = [row(), row({ responseDate: d("2026-03-29") }), row({ responseDate: null }), row({ receptionDate: null })];
    expect(medianResponseDays(rows, 2026)).toBe(20);
    expect(medianResponseDays(rows, 2025)).toBeNull();
  });

  it("compara el acumulado con el mismo día del año anterior", () => {
    const ytd = buildComplaintYearToDate([
      row({ classification: "CRITICAL", recurrent: true }),
      row({ openingYear: 2025, openedAt: d("2025-10-18"), responseDate: null }),
      row({ openingYear: 2025, openedAt: d("2025-05-01"), closedAt: d("2025-06-01"), recurrent: null, receptionDate: d("2025-05-01"), responseDate: d("2025-05-05") }),
    ], 2026, new Set([2025, 2026]), today);
    expect(ytd.rows.map((item) => [item.label, item.current, item.previous])).toEqual([
      ["Recibidas", 1, 1], ["Críticas", 1, 0], ["Mayores", 0, 0], ["Cierres", 0, 1], ["Recurrentes", 100, null], ["Mediana recepción→respuesta", 10, 4],
    ]);
  });

  it("usa los criterios del listado para seguimiento, Parte II y eficacia", () => {
    const base = { conclusion: null, partIIRequired: null, effectivenessStatus: "PENDING", nextFollowupDate: null, classification: null };
    const backlog = buildComplaintBacklog([
      { ...base, id: "a", code: "R-1", openedAt: d("2026-10-01"), classification: "CRITICAL", nextFollowupDate: d("2026-10-16"), conclusion: "Texto" },
      { ...base, id: "b", code: "R-2", openedAt: d("2026-07-01"), nextFollowupDate: d("2026-10-17"), partIIRequired: true },
    ], today);
    expect([backlog.followupDue, backlog.pendingPartII, backlog.pendingEffectiveness]).toEqual([1, 1, 1]);
    expect(backlog.buckets[0].tags).toEqual({ CRITICAL: 1 });
  });
});
