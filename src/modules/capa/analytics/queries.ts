import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildMonthlyCounts,buildPareto } from "@/lib/qms/analytics/trends";
import { qmsRecordDisplayCode } from "@/lib/qms/record-links";
import {
  buildCapaBacklog,buildCapaEffectivenessBacklog,buildCapaFiveYearTrend,buildCapaYearMetrics,buildCapaYearToDate,
  type CapaAnalyticsRow,
} from "@/modules/capa/analytics/domain";

export type CapaAnalyticsFilters={
  year?:string;department?:string;type?:string;origin?:string;status?:string;
};

export async function getCapaAnalytics(filters:CapaAnalyticsFilters,today=new Date()) {
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
  const rows:CapaAnalyticsRow[]=records
    .filter((r)=>r.status!=="DRAFT")
    .map((r)=>({
      openingYear:r.qmsRecord.year??r.openedAt?.getUTCFullYear()??null,
      openedAt:r.openedAt,operationalClosedAt:r.operationalClosedAt,effectiveClosedAt:r.effectiveClosedAt,
      status:r.status as "OPEN"|"CLOSED"|"CANCELLED",
      actionType:r.actionType,effectivenessStatus:r.effectivenessStatus,
      departmentCode:r.departmentCodeSnapshot,originType:r.originType,
      plannedDates:r.plannedActions.map((a)=>a.plannedExecutionDate).filter((d):d is Date=>Boolean(d)),
    }));
  const years=yearRows.map((r)=>r.year).filter((y):y is number=>y!==null);
  const selected=filters.year&&/^\d{4}$/.test(filters.year)?Number(filters.year):years[0]??new Date().getFullYear();
  const covered=new Set<number>([
    ...years,
    ...batches.filter((b)=>b.recordType==="CAPA").flatMap((b)=>b.years),
  ]);
  const current=buildCapaYearMetrics(rows,selected,covered.has(selected));
  return {
    selectedYear:selected,
    current,
    previous:buildCapaYearMetrics(rows,selected-1,covered.has(selected-1)),
    trend:buildCapaFiveYearTrend(rows,selected,covered),
    // Tendencias: se calculan sobre las mismas filas, sin consultas nuevas.
    monthlySeries:buildMonthlyCounts(rows.map((r)=>r.openedAt),selected,covered,today),
    yearToDate:buildCapaYearToDate(rows,selected,covered,today),
    pareto:{department:buildPareto(current.departments),origin:buildPareto(current.origins),type:buildPareto(current.types)},
    years,departments,
    origins:origins.map((r)=>r.originType).filter((v):v is string=>Boolean(v)),
  };
}

/**
 * CAPA abiertas hoy y CAPA ejecutadas con eficacia pendiente. Aplica departamento, tipo y
 * origen; no el año analizado ni el estado, porque lo pendiente es de hoy.
 */
export async function getCapaBacklog(filters:CapaAnalyticsFilters,today=new Date()) {
  const where:Prisma.CapaWhereInput={
    includeInKpi:true,
    qmsRecord:{isActive:true},
    ...(filters.department?{departmentId:filters.department}:{}),
    ...(filters.type==="CORRECTIVE"||filters.type==="PREVENTIVE"?{actionType:filters.type}:{}),
    ...(filters.origin?{originType:filters.origin}:{}),
  };
  const code={select:{businessCode:true,annulledBusinessCode:true}} as const;
  const [open,pendingEffectiveness]=await Promise.all([
    prisma.capa.findMany({
      where:{...where,status:"OPEN"},
      select:{id:true,openedAt:true,actionType:true,nextFollowupDate:true,qmsRecord:code,plannedActions:{select:{plannedExecutionDate:true}}},
    }),
    prisma.capa.findMany({
      where:{...where,status:"CLOSED",effectivenessStatus:"PENDING",effectiveClosedAt:null},
      select:{id:true,operationalClosedAt:true,actionType:true,qmsRecord:code},
    }),
  ]);
  return {
    open:buildCapaBacklog(open.map((r)=>({
      id:r.id,code:qmsRecordDisplayCode(r.qmsRecord),openedAt:r.openedAt,actionType:r.actionType,nextFollowupDate:r.nextFollowupDate,
      plannedDates:r.plannedActions.map((a)=>a.plannedExecutionDate).filter((d):d is Date=>Boolean(d)),
    })),today),
    effectiveness:buildCapaEffectivenessBacklog(pendingEffectiveness.map((r)=>({
      id:r.id,code:qmsRecordDisplayCode(r.qmsRecord),operationalClosedAt:r.operationalClosedAt,actionType:r.actionType,
    })),today),
  };
}
