import { describe, expect, it } from "vitest";
import { dateFilterErrors, listRevisionWhere, listWhere } from "./queries";

describe("PNT: filtros por fechas de revisiones", () => {
  it("permite fechas abiertas y rangos cerrados independientes", () => {
    const r = listRevisionWhere({ effectiveFromStart: "2026-01-01", effectiveFromEnd: "2026-12-31", reviewDueEnd: "2027-12-31" });
    expect(r.AND).toHaveLength(2);
    expect(JSON.stringify(r)).toContain("2028-01-01");
    expect(JSON.stringify(r)).toContain("2027-01-01"); // 31/12 inclusivo
    expect(JSON.stringify(r)).toContain("lifecycle");
    expect(JSON.stringify(r)).toContain("effectiveFrom");
  });
  it("combina revisión, estado, plazo y fecha en una misma revisión", () => {
    const r = listRevisionWhere({ revision: "01", revisionState: "IN_FORCE", validity: "due", reviewDueStart: "2025-01-01" });
    expect(r.revisionCode).toBe("01");
    expect(r.status).toBe("IN_FORCE");
    expect(r.AND).toHaveLength(3);
    const w = listWhere({ revision: "01", revisionState: "IN_FORCE", reviewDueStart: "2025-01-01" });
    expect(JSON.stringify(w)).toContain('"some"');
  });
  it("no devuelve coincidencias con intervalos invertidos o fechas imposibles", () => {
    for (const filters of [
      { effectiveFromStart: "2027-01-01", effectiveFromEnd: "2026-01-01" },
      { reviewDueStart: "2026-02-31" },
    ]) {
      expect(dateFilterErrors(filters)).not.toHaveLength(0);
      expect(listRevisionWhere(filters)).toEqual({ id: { in: [] } });
    }
  });
  it("conserva compatibilidad sin nuevos filtros", () => {
    expect(listRevisionWhere({})).toEqual({});
    expect(dateFilterErrors({ effectiveFromStart: "2026-01-01" })).toEqual([]);
  });
});

describe("PNT: «vigentes» según el día de Madrid (FEC1)", () => {
  it("a las 23:30 UTC ya cuenta como vigente lo que empieza el día siguiente en Madrid", async () => {
    const { vi } = await import("vitest");
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-11-12T23:30:00.000Z"));
      const text = JSON.stringify(listRevisionWhere({ validity: "current" }));
      expect(text).toContain("2026-11-13T00:00:00.000Z");
      expect(text).not.toContain("2026-11-12T00:00:00.000Z");
    } finally { vi.useRealTimers(); }
  });
});
