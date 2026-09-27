import { describe,expect,it } from "vitest";
import { buildCapaYearMetrics,plannedCompletionDate,type CapaAnalyticsRow } from "@/modules/capa/analytics/domain";

function row(p:Partial<CapaAnalyticsRow>={}):CapaAnalyticsRow {
  return {
    openingYear:2026,openedAt:new Date("2026-01-01T00:00:00Z"),
    operationalClosedAt:new Date("2026-01-20T00:00:00Z"),
    effectiveClosedAt:new Date("2026-02-10T00:00:00Z"),
    status:"CLOSED",actionType:"CORRECTIVE",effectivenessStatus:"CONFORMING",
    departmentCode:"GC-00",originType:"Desviación",
    plannedDates:[new Date("2026-01-10"),new Date("2026-01-31")],...p,
  };
}
describe("CAPA analytics",()=>{
  it("uses the latest planned action as global execution due date",()=>{
    expect(plannedCompletionDate(row())?.toISOString().slice(0,10)).toBe("2026-01-31");
  });
  it("calculates execution compliance by operational closing year",()=>{
    const m=buildCapaYearMetrics([
      row(),
      row({openingYear:2025,openedAt:new Date("2025-12-01"),operationalClosedAt:new Date("2026-02-10"),plannedDates:[new Date("2026-02-01")]}),
    ],2026);
    expect(m.total).toBe(1);
    expect(m.execution.total).toBe(2);
    expect(m.execution.inTime).toBe(1);
    expect(m.execution.rate).toBe(50);
  });
  it("does not count pending efficacy as evaluated",()=>{
    const m=buildCapaYearMetrics([row(),row({effectivenessStatus:"PENDING",effectiveClosedAt:null})],2026);
    expect(m.effectiveness.evaluated).toBe(1);
    expect(m.effectiveness.rate).toBe(100);
    expect(m.pendingEffectiveness).toBe(1);
  });
});
