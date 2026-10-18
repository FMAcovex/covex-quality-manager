import { describe, expect, it } from "vitest";
import { rankSimilar, recurrenceReasons, recurrenceWindowStart, type RecurrenceSource } from "@/modules/deviations/recurrence";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const base = (patch: Partial<RecurrenceSource> = {}): RecurrenceSource => ({
  id: "x", issueDate: d("2026-10-01"), departmentId: "dep-1", provenance: "FINISHED_PRODUCT_SYSTEM",
  finishedProductSystem: "Producto A", productLot: "L-1", rawOrPackagingMaterial: null, materialLot: null, supplierLot: null, additionalLots: [], ...patch,
});

describe("ayuda de recurrencia", () => {
  it("detecta mismo lote (también en otros lotes), mismo producto y misma área y procedencia", () => {
    expect(recurrenceReasons(base(), base({ id: "a" }))).toEqual(["LOT", "PRODUCT", "AREA_ORIGIN"]);
    expect(recurrenceReasons(base(), base({ id: "b", productLot: "L-9", finishedProductSystem: "otro", departmentId: "dep-2", additionalLots: [{ lot: " l-1 ", name: "" }] }))).toEqual(["LOT"]);
    expect(recurrenceReasons(base(), base({ id: "c", productLot: null, finishedProductSystem: " producto  a " , departmentId: "dep-2" }))).toEqual(["PRODUCT"]);
    expect(recurrenceReasons(base(), base({ id: "d", productLot: null, finishedProductSystem: null, provenance: "SUPPLIER" }))).toEqual([]);
    expect(recurrenceReasons(base(), base())).toEqual([]);
  });

  it("ordena por número de motivos y fecha, y limita la lista", () => {
    const ranked = rankSimilar(base(), [
      base({ id: "uno", issueDate: d("2026-05-01"), finishedProductSystem: null, departmentId: "dep-2" }),
      base({ id: "tres", issueDate: d("2026-01-01") }),
      base({ id: "uno-reciente", issueDate: d("2026-09-01"), finishedProductSystem: null, departmentId: "dep-2" }),
      base({ id: "nada", productLot: "Z", finishedProductSystem: "Z", departmentId: "dep-9" }),
    ], 2);
    expect(ranked.map((item) => item.candidate.id)).toEqual(["tres", "uno-reciente"]);
  });

  it("toma 12 meses antes de la apertura", () => {
    expect(recurrenceWindowStart(d("2026-10-01")).toISOString().slice(0, 10)).toBe("2025-10-01");
    expect(recurrenceWindowStart(null, d("2026-03-15")).toISOString().slice(0, 10)).toBe("2025-03-15");
  });
});
