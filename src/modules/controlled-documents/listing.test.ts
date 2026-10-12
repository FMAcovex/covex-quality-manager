import { describe, expect, it, vi } from "vitest";
// The listing now imports a server-only SQL selector; these tests exercise its pure date/options exports.
vi.mock("server-only", () => ({}));
import { dateInRange, matchesQuickFilter, normalizedListOptions, operationalDates } from "./listing";

describe("PNT P3C-4 — listado operativo", () => {
  const fixture = {
    status: "IN_FORCE", verificationStatus: "VERIFIED",
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    reviewDueAt: new Date("2026-10-15T00:00:00Z"),
    lifecycle: null,
  };
  it("normaliza opciones sin aceptar ordenaciones arbitrarias", () => {
    expect(normalizedListOptions({ sort: "SQL", view: "unknown", quick: "invalid" })).toEqual({
      sort:"code", direction:"asc", view:"all", quick:null,
    });
    expect(normalizedListOptions({ sort:"reviewDueAt", direction:"desc", view:"latest", quick:"overdue" }).view).toBe("latest");
  });
  it("los intervalos aplican los dos límites de manera inclusiva", () => {
    expect(dateInRange("2026-10-15","2026-10-15","2026-10-15")).toBe(true);
    expect(dateInRange("2026-10-14","2026-10-15","2026-10-15")).toBe(false);
    expect(dateInRange("","2026-01-01")).toBe(false);
  });
  it("mantiene separadas fechas operativas y originales", () => {
    expect(operationalDates({ ...fixture, lifecycle:{ effectiveFrom: null, reviewDueAt:null } })).toEqual({ effectiveFrom:"", reviewDueAt:"" });
    expect(operationalDates(fixture)).toEqual({ effectiveFrom:"2026-01-01", reviewDueAt:"2026-10-15" });
  });
  it("identifica vencidas, próximas, vigentes y pendientes", () => {
    const dates=operationalDates(fixture);
    expect(matchesQuickFilter(fixture,dates,"current","2026-10-09")).toBe(true);
    expect(matchesQuickFilter(fixture,dates,"dueSoon","2026-10-09")).toBe(true);
    expect(matchesQuickFilter(fixture,dates,"overdue","2026-10-09")).toBe(false);
    expect(matchesQuickFilter(fixture,dates,"overdue","2026-10-16")).toBe(true);
    expect(matchesQuickFilter({...fixture,status:"DRAFT"},dates,"overdue","2026-10-16")).toBe(false);
    expect(matchesQuickFilter({...fixture,verificationStatus:"UNVERIFIED"},dates,"unverified","2026-10-09")).toBe(true);
  });
});
