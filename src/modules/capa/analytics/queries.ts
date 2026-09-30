import "server-only";
import { prisma } from "@/lib/db";
import { buildCapaFiveYearTrend,buildCapaYearMetrics,type CapaAnalyticsRow } from "@/modules/capa/analytics/domain";

export type CapaAnalyticsFilters={
  year?:string;department?:string;type?:string;origin?:string;status?:string;
};

export async function getCapaAnalytics(filters:CapaAnalyticsFilters) {
  const records=await prisma.capa.findMany({
    where:{
      includeInKpi:true,
      qmsRecord:{isActive:true},
      status:{not:"DRAFT"},
      ...(filters.department?{departmentId:filters.department}:{}),
      ...(filters.type==="CORRECTIVE"||filters.type==="PREVENTIVE"?{actionType:filters.type}:{}),
      ...(filters.origin?{originType:filters.origin}:{}),
      ...(["OPEN","CLOSED","CANCELLED"].includes(filters.status??"")?{status:filters.status as "OPEN"|"CLOSED"|"CANCELLED"}:{}),
    },
    select:{
      openedAt:true,operationalClosedAt:true,effectiveClosedAt:true,status:true,actionType:true,
      effectivenessStatus:true,departmentCodeSnapshot:true,originType:true,
      qmsRecord:{select:{year:true}},plannedActions:{select:{plannedExecutionDate:true}},
    },
  });
  const [departments,origins,yearRows,batches]=await Promise.all([
    prisma.department.findMany({where:{isActive:true},orderBy:{code:"asc"}}),
    prisma.capa.findMany({where:{originType:{not:null}},select:{originType:true},distinct:["originType"],orderBy:{originType:"asc"}}),
    prisma.qmsRecord.findMany({where:{recordType:"CAPA",year:{not:null}},select:{year:true},distinct:["year"],orderBy:{year:"desc"}}),
    prisma.historicalImportBatch.findMany({where:{appliedAt:{not:null}},select:{recordType:true,years:true}}),
  ]);
  const rows:CapaAnalyticsRow[]=records.map((r)=>({
    openingYear:r.qmsRecord.year??r.openedAt?.getUTCFullYear()??null,
    openedAt:r.openedAt,operationalClosedAt:r.operationalClosedAt,effectiveClosedAt:r.effectiveClosedAt,
    status:r.status,actionType:r.actionType,effectivenessStatus:r.effectivenessStatus,
    departmentCode:r.departmentCodeSnapshot,originType:r.originType,
    plannedDates:r.plannedActions.map((a)=>a.plannedExecutionDate).filter((d):d is Date=>Boolean(d)),
  }));
  const years=yearRows.map((r)=>r.year).filter((y):y is number=>y!==null);
  const selected=filters.year&&/^\d{4}$/.test(filters.year)?Number(filters.year):years[0]??new Date().getFullYear();
  const covered=new Set<number>([
    ...years,
    ...batches.filter((b)=>b.recordType==="CAPA").flatMap((b)=>b.years),
  ]);
  return {
    selectedYear:selected,
    current:buildCapaYearMetrics(rows,selected,covered.has(selected)),
    previous:buildCapaYearMetrics(rows,selected-1,covered.has(selected-1)),
    trend:buildCapaFiveYearTrend(rows,selected,covered),
    years,departments,
    origins:origins.map((r)=>r.originType).filter((v):v is string=>Boolean(v)),
  };
}
