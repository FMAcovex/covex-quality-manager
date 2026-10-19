import { describe, expect, it } from "vitest";
import { capaEditOrigins } from "./edit-origins";

const record = (id: string, recordType: string) => ({ id, recordType, businessCode: id.toUpperCase(), year: 2026 });
describe("capaEditOrigins", () => {
  it("une las relaciones activas con los orígenes pendientes del borrador, sin duplicados (R5B1)", () => {
    const audit = record("audit", "AUDIT"), deviation = record("dev", "DEVIATION");
    expect(capaEditOrigins([audit], [deviation, audit]).map((r) => r.id)).toEqual(["audit", "dev"]);
  });
  it("sin relaciones devuelve los pendientes y sin pendientes las relaciones", () => {
    expect(capaEditOrigins([], [record("dev", "DEVIATION")]).map((r) => r.id)).toEqual(["dev"]);
    expect(capaEditOrigins([record("audit", "AUDIT")], []).map((r) => r.id)).toEqual(["audit"]);
  });
});
