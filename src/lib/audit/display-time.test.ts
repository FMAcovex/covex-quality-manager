import { describe, expect, it } from "vitest";
import { formatAuditTrailCsvLocal, formatAuditTrailDateTime, madridDayBoundary } from "./display-time";

describe("formatAuditTrailDateTime (D-117, H-14)", () => {
  it("muestra la hora local de Madrid con la zona, en horario de verano", () => {
    expect(formatAuditTrailDateTime(new Date("2026-10-07T22:11:05Z"))).toBe("8 oct 2026, 0:11:05 CEST");
  });
  it("muestra la hora local de Madrid con la zona, en horario de invierno", () => {
    expect(formatAuditTrailDateTime(new Date("2026-01-15T09:30:00Z"))).toBe("15 ene 2026, 10:30:00 CET");
  });
});

describe("días de Madrid en filtros y exportación (D-117)", () => {
  it("el día empieza a medianoche de Madrid, en verano y en invierno", () => {
    expect(madridDayBoundary("2026-10-07").toISOString()).toBe("2026-10-06T22:00:00.000Z");
    expect(madridDayBoundary("2026-01-15").toISOString()).toBe("2026-01-14T23:00:00.000Z");
  });
  it("el día termina justo antes de la medianoche siguiente, también el día del cambio de hora", () => {
    expect(madridDayBoundary("2026-10-25", true).toISOString()).toBe("2026-10-25T22:59:59.999Z");
    expect(madridDayBoundary("2026-03-29", true).toISOString()).toBe("2026-03-29T21:59:59.999Z");
  });
  it("la exportación muestra la hora de Madrid ordenable", () => {
    expect(formatAuditTrailCsvLocal(new Date("2026-10-07T22:11:05Z"))).toBe("2026-10-08 00:11:05 CEST");
    expect(formatAuditTrailCsvLocal(new Date("2026-01-15T09:30:00Z"))).toBe("2026-01-15 10:30:00 CET");
  });
});
