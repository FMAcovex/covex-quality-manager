import { describe,expect,it } from "vitest";
import { buildCapaBacklog,buildCapaEffectivenessBacklog,buildCapaYearMetrics,buildCapaYearToDate,plannedCompletionDate,type CapaAnalyticsRow } from "@/modules/capa/analytics/domain";

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

describe("CAPA: tendencias y pendientes",()=>{
  const today=new Date("2026-10-17T12:00:00Z");
  it("compara el acumulado del año con el mismo día del año anterior",()=>{
    const ytd=buildCapaYearToDate([
      row({openedAt:new Date("2026-03-01"),operationalClosedAt:new Date("2026-04-01"),plannedDates:[new Date("2026-05-01")],effectiveClosedAt:new Date("2026-06-01")}),
      row({openingYear:2025,openedAt:new Date("2025-10-17"),actionType:"PREVENTIVE",operationalClosedAt:new Date("2025-11-01"),plannedDates:[new Date("2025-10-20")],effectiveClosedAt:null,effectivenessStatus:"PENDING"}),
    ],2026,new Set([2025,2026]),today);
    expect(ytd.rows.map((r)=>[r.label,r.current,r.previous])).toEqual([
      ["Aperturas",1,1],["Correctivas",1,0],["Preventivas",0,1],["Ejecutadas",1,0],
      ["Ejecución en plazo",100,null],["Eficacias evaluadas",1,0],["Eficacia conforme",100,null],
    ]);
  });
  it("marca la fecha prevista superada solo cuando ya pasó el día previsto",()=>{
    const backlog=buildCapaBacklog([
      {id:"a",code:"C-1",openedAt:new Date("2026-10-01"),actionType:"CORRECTIVE",plannedDates:[new Date("2026-10-16"),new Date("2026-09-01")],nextFollowupDate:new Date("2026-10-17")},
      {id:"b",code:"C-2",openedAt:new Date("2026-01-01"),actionType:"PREVENTIVE",plannedDates:[new Date("2026-10-17")],nextFollowupDate:null},
      {id:"c",code:"C-3",openedAt:new Date("2026-10-10"),actionType:"CORRECTIVE",plannedDates:[],nextFollowupDate:new Date("2026-10-18")},
    ],today);
    expect([backlog.total,backlog.overdue,backlog.withoutPlan,backlog.followupDue]).toEqual([3,1,1,1]);
    expect(backlog.buckets[0].tags).toEqual({OVERDUE:1,NO_PLAN:1});
    expect(backlog.oldest[0]).toMatchObject({code:"C-2",note:"Preventiva"});
    expect(backlog.oldest.find((x)=>x.code==="C-1")?.note).toBe("Correctiva · prevista superada");
  });
  it("cuenta la eficacia pendiente desde el cierre operativo",()=>{
    const pending=buildCapaEffectivenessBacklog([
      {id:"a",code:"C-1",operationalClosedAt:new Date("2026-06-01"),actionType:"CORRECTIVE",nextFollowupDate:new Date("2026-10-17")},
      {id:"b",code:"C-2",operationalClosedAt:new Date("2026-10-01"),actionType:"PREVENTIVE",nextFollowupDate:new Date("2026-11-01")},
      {id:"c",code:"C-3",operationalClosedAt:new Date("2026-10-10"),actionType:"PREVENTIVE",nextFollowupDate:null},
    ],today);
    expect([pending.total,pending.buckets[3].count,pending.oldest[0].ageDays]).toEqual([3,1,138]);
    expect([pending.checkDue,pending.withoutCheckDate]).toEqual([1,1]);
    expect(pending.oldest[0].note).toBe("Correctiva · verificación vencida");
    expect(pending.buckets[0].tags).toEqual({PREVENTIVE:2,NO_CHECK_DATE:1});
  });
});
