import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildMonthlyCounts,buildPareto } from "@/lib/qms/analytics/trends";
import { qmsRecordDisplayCode } from "@/lib/qms/record-links";
import { buildComplaintBacklog,buildComplaintYearToDate,complaintMentions,medianResponseDays,type ComplaintTrendRow } from "@/modules/complaints/analytics/domain";

export type ComplaintAnalyticsFilters={year?:string;department?:string;type?:string;classification?:string;status?:string};
type Dist={label:string;count:number;percentage:number};
const pct=(a:number,b:number)=>b?Math.round(a/b*1000)/10:null;
const days=(a:Date|null,b:Date|null)=>a&&b?Math.max(0,Math.round((b.getTime()-a.getTime())/86400000)):null;
const median=(v:number[])=>{if(!v.length)return null;const x=[...v].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
function dist<T>(rows:T[],get:(x:T)=>string):Dist[]{const m=new Map<string,number>();rows.forEach(x=>{const k=get(x);m.set(k,(m.get(k)??0)+1)});return [...m].map(([label,count])=>({label,count,percentage:rows.length?Math.round(count/rows.length*1000)/10:0})).sort((a,b)=>b.count-a.count);}

export async function getComplaintAnalytics(filters:ComplaintAnalyticsFilters,now=new Date()){
 const rows=await prisma.complaint.findMany({
  where:{
   includeInKpi:true,qmsRecord:{isActive:true},status:{not:"DRAFT"},
   ...(filters.department?{departmentId:filters.department}:{}),
   ...(filters.type==="PROVIDER"||filters.type==="CUSTOMER"?{complaintType:filters.type}:{}),
   ...(["CRITICAL","MAJOR","MINOR","NO_GMP_IMPACT"].includes(filters.classification??"")?{classification:filters.classification as "CRITICAL"|"MAJOR"|"MINOR"|"NO_GMP_IMPACT"}:{}),
   ...(filters.status==="OPEN"||filters.status==="CLOSED"?{status:filters.status}:{})
  },
  select:{
   openedAt:true,closedAt:true,status:true,complaintType:true,classification:true,recurrent:true,effectivenessStatus:true,
   partIIRequired:true,conclusion:true,responseSummary:true,nextFollowupDate:true,departmentCodeSnapshot:true,
   receptionDate:true,responseDate:true,categoryTypes:true,sourceTypes:true,
   qmsRecord:{select:{year:true}}
  }
 });
 const [departments,yearsRaw]=await Promise.all([
  prisma.department.findMany({where:{isActive:true},orderBy:{code:"asc"}}),
  prisma.qmsRecord.findMany({where:{recordType:"COMPLAINT",year:{not:null}},select:{year:true},distinct:["year"],orderBy:{year:"desc"}})
 ]);
 const years=yearsRaw.map(x=>x.year).filter((x):x is number=>x!==null);
 const selected=filters.year&&/^\d{4}$/.test(filters.year)?Number(filters.year):years[0]??new Date().getFullYear();
 const today=new Date();today.setHours(0,0,0,0);
 const trendRows:ComplaintTrendRow[]=rows.map(r=>({
  openingYear:r.qmsRecord.year??r.openedAt?.getUTCFullYear()??null,openedAt:r.openedAt,closedAt:r.closedAt,
  receptionDate:r.receptionDate,responseDate:r.responseDate,classification:r.classification,recurrent:r.recurrent,
  categoryTypes:r.categoryTypes,sourceTypes:r.sourceTypes
 }));
 const covered=new Set(years);
 const metric=(year:number)=>{
  const y=rows.filter(r=>(r.qmsRecord.year??r.openedAt?.getUTCFullYear())===year);
  const closure=y.map(r=>days(r.openedAt,r.closedAt)).filter((x):x is number=>x!==null);
  const recEval=y.filter(r=>r.recurrent!==null),rec=recEval.filter(r=>r.recurrent).length;
  const openRows=y.filter(r=>r.status==="OPEN");
  return{
   year,dataAvailable:years.includes(year),total:y.length,open:openRows.length,closed:y.filter(r=>r.status==="CLOSED").length,
   customer:y.filter(r=>r.complaintType==="CUSTOMER").length,provider:y.filter(r=>r.complaintType==="PROVIDER").length,
   pendingPartII:openRows.filter(r=>r.partIIRequired===null&&Boolean(r.conclusion?.trim())).length,
   pendingEffectiveness:openRows.filter(r=>r.partIIRequired===true&&r.effectivenessStatus==="PENDING"&&Boolean(r.responseSummary?.trim())).length,
   overdueFollowup:openRows.filter(r=>Boolean(r.nextFollowupDate&&r.nextFollowupDate<today)).length,
   recurrent:{count:rec,total:recEval.length,rate:pct(rec,recEval.length)},medianClosure:median(closure),
   critical:y.filter(r=>r.classification==="CRITICAL").length,major:y.filter(r=>r.classification==="MAJOR").length,
   medianResponse:medianResponseDays(trendRows,year),
   types:dist(y,r=>r.complaintType==="CUSTOMER"?"De cliente":r.complaintType==="PROVIDER"?"A proveedor":"Sin indicar"),
   classifications:dist(y,r=>r.classification==="CRITICAL"?"Crítica":r.classification==="MAJOR"?"Mayor":r.classification==="MINOR"?"Menor":r.classification==="NO_GMP_IMPACT"?"Sin impacto GMP":"Sin clasificar"),
   departments:dist(y,r=>r.departmentCodeSnapshot??"Sin departamento")
  };
 };
 const current=metric(selected);
 return{
  selectedYear:selected,current,previous:metric(selected-1),trend:Array.from({length:5},(_,i)=>metric(selected-4+i)),departments,years,
  // Tendencias: se calculan sobre las mismas filas, sin consultas nuevas.
  monthlySeries:buildMonthlyCounts(trendRows.map(r=>r.openedAt),selected,covered,now),
  yearToDate:buildComplaintYearToDate(trendRows,selected,covered,now),
  pareto:{
   category:buildPareto(complaintMentions(trendRows,selected,"categoryTypes")),
   classification:buildPareto(current.classifications),
   source:buildPareto(complaintMentions(trendRows,selected,"sourceTypes")),
   department:buildPareto(current.departments),
  },
 };
}

/**
 * Reclamaciones abiertas hoy y su antigüedad. Aplica departamento, tipo y clasificación;
 * no el año analizado ni el estado, porque lo pendiente es de hoy.
 */
export async function getComplaintBacklog(filters:ComplaintAnalyticsFilters,today=new Date()){
 const where:Prisma.ComplaintWhereInput={
  includeInKpi:true,qmsRecord:{isActive:true},status:"OPEN",
  ...(filters.department?{departmentId:filters.department}:{}),
  ...(filters.type==="PROVIDER"||filters.type==="CUSTOMER"?{complaintType:filters.type}:{}),
  ...(["CRITICAL","MAJOR","MINOR","NO_GMP_IMPACT"].includes(filters.classification??"")?{classification:filters.classification as "CRITICAL"|"MAJOR"|"MINOR"|"NO_GMP_IMPACT"}:{}),
 };
 const records=await prisma.complaint.findMany({
  where,
  select:{id:true,openedAt:true,classification:true,nextFollowupDate:true,partIIRequired:true,conclusion:true,effectivenessStatus:true,
   qmsRecord:{select:{businessCode:true,annulledBusinessCode:true}}},
 });
 return buildComplaintBacklog(records.map(r=>({
  id:r.id,code:qmsRecordDisplayCode(r.qmsRecord),openedAt:r.openedAt,classification:r.classification,nextFollowupDate:r.nextFollowupDate,
  partIIRequired:r.partIIRequired,conclusion:r.conclusion,effectivenessStatus:r.effectivenessStatus,
 })),today);
}
