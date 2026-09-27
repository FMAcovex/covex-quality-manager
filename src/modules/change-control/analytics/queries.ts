import "server-only";
import { prisma } from "@/lib/db";
import { buildChangeTrend,buildChangeYearMetrics,type ChangeAnalyticsRow } from "@/modules/change-control/analytics/domain";

export type ChangeAnalyticsFilters={year?:string;department?:string;classification?:string;status?:string;};
export async function getChangeControlAnalytics(filters:ChangeAnalyticsFilters){
  const records=await prisma.changeControl.findMany({
    where:{includeInKpi:true,...(filters.department?{departmentId:filters.department}:{}),
      ...(filters.classification==="MAJOR"||filters.classification==="MINOR"?{classification:filters.classification}:{}),
      ...(["OPEN","CLOSED","REJECTED","CANCELLED"].includes(filters.status??"")?{status:filters.status as "OPEN"|"CLOSED"|"REJECTED"|"CANCELLED"}:{})},
    select:{requestedAt:true,decisionAt:true,requestDecisionAt:true,plannedImplementationAt:true,executedAt:true,effectiveClosedAt:true,
      status:true,executionStatus:true,classification:true,departmentCodeSnapshot:true,qmsRecord:{select:{year:true}}},
  });
  const [departments,years,batches]=await Promise.all([
    prisma.department.findMany({where:{isActive:true},orderBy:{code:"asc"}}),
    prisma.qmsRecord.findMany({where:{recordType:"CHANGE_CONTROL",year:{not:null}},select:{year:true},distinct:["year"],orderBy:{year:"desc"}}),
    prisma.historicalImportBatch.findMany({where:{appliedAt:{not:null}},select:{recordType:true,years:true}}),
  ]);
  const rows:ChangeAnalyticsRow[]=records.map((r)=>({
    requestedAt:r.requestedAt,approvalAt:r.decisionAt??r.requestDecisionAt,plannedAt:r.plannedImplementationAt,
    executedAt:r.executedAt,closedAt:r.effectiveClosedAt,status:r.status,executionStatus:r.executionStatus,
    classification:r.classification,departmentCode:r.departmentCodeSnapshot,
  }));
  const yearValues=years.map((r)=>r.year).filter((v):v is number=>v!==null);
  const selected=filters.year&&/^\d{4}$/.test(filters.year)?Number(filters.year):yearValues[0]??new Date().getFullYear();
  const covered=new Set<number>([...yearValues,...batches.filter((b)=>b.recordType==="CHANGE_CONTROL").flatMap((b)=>b.years)]);
  return {selectedYear:selected,current:buildChangeYearMetrics(rows,selected,covered.has(selected)),previous:buildChangeYearMetrics(rows,selected-1,covered.has(selected-1)),
    trend:buildChangeTrend(rows,selected,covered),years:yearValues,departments};
}
