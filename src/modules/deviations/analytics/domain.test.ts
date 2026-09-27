import { describe, expect, it } from "vitest";
import {
  buildFiveYearTrend,
  buildYearMetrics,
  closingDays,
  isKpiComplete,
  median,
  type AnalyticsRow,
} from "@/modules/deviations/analytics/domain";

function row(patch: Partial<AnalyticsRow> = {}): AnalyticsRow {
  return {
    openingYear: 2026,
    issueDate: new Date("2026-01-01T00:00:00Z"),
    closedAt: new Date("2026-01-21T00:00:00Z"),
    status: "CLOSED",
    classification: "MINOR",
    recurrentRootCause: "NO",
    affectsFinishedProduct: "NO",
    provenance: "Auditoría interna",
    departmentCode: "GC-00",
    departmentName: "Garantía de Calidad",
    capaRequired: false,
    capaCount: 0,
    ...patch,
  };
}

describe("deviation KPI domain", () => {
  it("uses opening year for volume but closing year for closing KPIs", () => {
    const historical = row({
      openingYear: 2025,
      issueDate: new Date("2025-12-20T00:00:00Z"),
      closedAt: new Date("2026-01-10T00:00:00Z"),
    });
    const metrics2025 = buildYearMetrics([historical], 2025);
    const metrics2026 = buildYearMetrics([historical], 2026);
    expect(metrics2025.total).toBe(1);
    expect(metrics2025.closure.total).toBe(0);
    expect(metrics2026.total).toBe(0);
    expect(metrics2026.closure.total).toBe(1);
  });

  it("calculates closure compliance as <=30 natural days", () => {
    const rows = [
      row({ closedAt: new Date("2026-01-31T00:00:00Z") }),
      row({ closedAt: new Date("2026-02-01T00:00:00Z") }),
    ];
    const metrics = buildYearMetrics(rows, 2026);
    expect(metrics.closure.within30).toBe(1);
    expect(metrics.closure.total).toBe(2);
    expect(metrics.closure.rate).toBe(50);
    expect(metrics.closure.medianDays).toBe(30.5);
  });

  it("excludes unassessed recurrence and product impact from denominators", () => {
    const metrics = buildYearMetrics(
      [
        row({ recurrentRootCause: "YES", affectsFinishedProduct: "YES" }),
        row({ recurrentRootCause: "NO", affectsFinishedProduct: "NO" }),
        row({ recurrentRootCause: null, affectsFinishedProduct: null }),
      ],
      2026,
    );
    expect(metrics.recurrence).toMatchObject({ numerator: 1, denominator: 2, rate: 50, missing: 1 });
    expect(metrics.affectsProduct).toMatchObject({ numerator: 1, denominator: 2, rate: 50, missing: 1 });
  });

  it("uses explicit CAPA requirement even if no structured CAPA row exists", () => {
    const metrics = buildYearMetrics([row({ capaRequired: true, capaCount: 0 })], 2026);
    expect(metrics.withCapa).toBe(1);
    expect(metrics.withCapaRate).toBe(100);
  });

  it("defines KPI completeness independently from full Annex III completeness", () => {
    expect(isKpiComplete(row())).toBe(true);
    expect(isKpiComplete(row({ recurrentRootCause: null }))).toBe(false);
    expect(isKpiComplete(row({ provenance: null }))).toBe(false);
  });

  it("builds a fixed five-year trend and distinguishes years not loaded", () => {
    const trend = buildFiveYearTrend([row()], 2026, new Set([2025, 2026]));
    expect(trend.map((item) => item.year)).toEqual([2022, 2023, 2024, 2025, 2026]);
    expect(trend[0].dataAvailable).toBe(false);
    expect(trend[3].dataAvailable).toBe(true);
    expect(trend.at(-1)?.total).toBe(1);
  });

  it("handles date and median edge cases", () => {
    expect(closingDays(row({ closedAt: null }))).toBeNull();
    expect(median([])).toBeNull();
    expect(median([5, 1, 9])).toBe(5);
  });
});
