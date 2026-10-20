import { describe, expect, it } from "vitest";
import { formatAuditTrailDateTime } from "./display-time";

describe("formatAuditTrailDateTime (D-117, H-14)", () => {
  it("muestra la hora local de Madrid con la zona, en horario de verano", () => {
    expect(formatAuditTrailDateTime(new Date("2026-10-07T22:11:05Z"))).toBe("8 oct 2026, 0:11:05 CEST");
  });
  it("muestra la hora local de Madrid con la zona, en horario de invierno", () => {
    expect(formatAuditTrailDateTime(new Date("2026-01-15T09:30:00Z"))).toBe("15 ene 2026, 10:30:00 CET");
  });
});
