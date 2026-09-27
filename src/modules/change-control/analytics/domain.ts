export type ChangeAnalyticsRow={
  requestedAt:Date|null;
  approvalAt:Date|null;
  plannedAt:Date|null;
  executedAt:Date|null;
  closedAt:Date|null;
  status:string;
  executionStatus:string;
  classification:string|null;
  departmentCode:string|null;
};
export type Distribution={label:string;count:number;percentage:number|null};
export type ChangeYearMetrics={
  year:number;dataAvailable:boolean;initiated:number;executed:number;closedAfterExecution:number;
  closedWithoutExecution:number;pendingExecution:number;executedPendingClosure:number;
  inTime:{evaluated:number;count:number;rate:number|null};
  medianApprovalToExecution:number|null;
  medianMinor:number|null;medianMajor:number|null;
  departments:Distribution[];classifications:Distribution[];
};
const days=(a:Date,b:Date)=>Math.round((b.getTime()-a.getTime())/86400000);
function median(values:number[]){
  if(!values.length)return null;const s=[...values].sort((a,b)=>a-b),m=Math.floor(s.length/2);
  return s.length%2?s[m]:(s[m-1]+s[m])/2;
}
function dist(values:(string|null)[]):Distribution[]{
  const map=new Map<string,number>();values.filter((v):v is string=>Boolean(v)).forEach((v)=>map.set(v,(map.get(v)??0)+1));
  const total=[...map.values()].reduce((a,b)=>a+b,0);
  return [...map.entries()].sort((a,b)=>b[1]-a[1]).map(([label,count])=>({label,count,percentage:total?count/total*100:null}));
}
export function buildChangeYearMetrics(rows:ChangeAnalyticsRow[],year:number,dataAvailable=true):ChangeYearMetrics{
  const initiated=rows.filter((r)=>r.requestedAt?.getUTCFullYear()===year);
  const executed=rows.filter((r)=>r.executedAt?.getUTCFullYear()===year);
  const closed=rows.filter((r)=>r.closedAt?.getUTCFullYear()===year);
  const executedClosed=closed.filter((r)=>Boolean(r.executedAt));
  const without=closed.filter((r)=>!r.executedAt);
  const pending=rows.filter((r)=>r.status==="OPEN"&&r.executionStatus==="NOT_EXECUTED");
  const executedPending=rows.filter((r)=>r.status==="OPEN"&&r.executionStatus==="EXECUTED");
  const evaluable=executed.filter((r)=>r.plannedAt&&r.executedAt);
  const inTime=evaluable.filter((r)=>r.executedAt!.getTime()<=r.plannedAt!.getTime());
  const durations=executed.filter((r)=>r.approvalAt&&r.executedAt).map((r)=>days(r.approvalAt!,r.executedAt!));
  const minor=executed.filter((r)=>r.classification==="MINOR"&&r.approvalAt&&r.executedAt).map((r)=>days(r.approvalAt!,r.executedAt!));
  const major=executed.filter((r)=>r.classification==="MAJOR"&&r.approvalAt&&r.executedAt).map((r)=>days(r.approvalAt!,r.executedAt!));
  return {year,dataAvailable,initiated:initiated.length,executed:executed.length,closedAfterExecution:executedClosed.length,
    closedWithoutExecution:without.length,pendingExecution:pending.length,executedPendingClosure:executedPending.length,
    inTime:{evaluated:evaluable.length,count:inTime.length,rate:evaluable.length?inTime.length/evaluable.length*100:null},
    medianApprovalToExecution:median(durations),medianMinor:median(minor),medianMajor:median(major),
    departments:dist(initiated.map((r)=>r.departmentCode)),
    classifications:dist(initiated.map((r)=>r.classification==="MAJOR"?"Mayor":r.classification==="MINOR"?"Menor":null)),
  };
}
export function buildChangeTrend(rows:ChangeAnalyticsRow[],endYear:number,covered:Set<number>){
  return Array.from({length:5},(_,i)=>endYear-4+i).map((y)=>buildChangeYearMetrics(rows,y,covered.has(y)));
}
