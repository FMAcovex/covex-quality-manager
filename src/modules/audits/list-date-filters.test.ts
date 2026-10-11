import { describe, expect, it } from "vitest";
import { nextReviewRange } from "./list-date-filters";

describe("límites estrictos de próxima revisión", () => {
  it("admite límites ISO independientes e inclusivos, incluido un año bisiesto", () => {
    expect(nextReviewRange({ nextReviewFrom: "2024-02-29" }).from?.toISOString()).toBe("2024-02-29T00:00:00.000Z");
    expect(nextReviewRange({ nextReviewTo: "2026-12-31" }).to?.toISOString()).toBe("2026-12-31T00:00:00.000Z");
    expect(nextReviewRange({ nextReviewFrom: "2026-01-01", nextReviewTo: "2026-01-01" }).errors).toEqual([]);
    expect(nextReviewRange({}).errors).toEqual([]);
  });
  it.each(["2026-02-29", "2026-02-31", "2026-13-01", "2026-00-01", "2026-1-01", "31/01/2026", "2026-01-01T00:00:00Z", "0000-01-01", "invalid"])("rechaza %s sin ignorar el límite solicitado", value => {
    expect(nextReviewRange({ nextReviewFrom: value }).errors).toHaveLength(1);
    expect(nextReviewRange({ nextReviewTo: value }).errors).toHaveLength(1);
  });
  it("rechaza rangos invertidos aunque ambas fechas sean válidas", () => {
    expect(nextReviewRange({ nextReviewFrom: "2026-02-01", nextReviewTo: "2026-01-01" }).errors).toHaveLength(1);
  });
});
