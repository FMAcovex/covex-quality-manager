import { describe, expect, it } from "vitest";
import { revisionDates } from "./revision-dates";

describe("Fechas vigentes de una revisión", () => {
  const legacy = { effectiveFrom: new Date("2020-01-01"), reviewDueAt: new Date("2021-01-01") };
  it("con ciclo de vida, usa las suyas aunque estén vacías (como el resto de la ficha)", () => {
    expect(revisionDates({ ...legacy, lifecycle: { effectiveFrom: null, reviewDueAt: null } })).toEqual({ effectiveFrom: null, reviewDueAt: null });
  });
  it("sin ciclo de vida, usa las de la revisión", () => {
    expect(revisionDates({ ...legacy, lifecycle: null })).toEqual(legacy);
  });
});
