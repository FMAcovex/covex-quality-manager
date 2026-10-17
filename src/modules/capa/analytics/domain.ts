import {
  buildAging,
  inYearToDate,
  isDue,
  yearToDateWindow,
  type YearToDateComparison,
} from "@/lib/qms/analytics/trends";

export type CapaAnalyticsRow = {
  openingYear: number | null;
  openedAt: Date | null;
  operationalClosedAt: Date | null;
  effectiveClosedAt: Date | null;
  status: "OPEN" | "CLOSED" | "CANCELLED";
  actionType: "CORRECTIVE" | "PREVENTIVE";
  effectivenessStatus: "CONFORMING" | "NONCONFORMING" | "PENDING" | "NA";
  departmentCode: string | null;
  originType: string | null;
  plannedDates: Date[];
};

export type CapaDistribution = { label:string; count:number; percentage:number };

export type CapaYearMetrics = {
  year:number;
  dataAvailable:boolean;
  total:number;
  openCurrent:number;
  cancelled:number;
  corrective:number;
  preventive:number;
  pendingEffectiveness:number;
  execution:{
    inTime:number;
    total:number;
    rate:number|null;
    medianDays:number|null;
  };
  effectiveness:{
    conforming:number;
    nonconforming:number;
    evaluated:number;
    rate:number|null;
    pending:number;
    medianDaysToEffectiveness:number|null;
  };
  departments:CapaDistribution[];
  origins:CapaDistribution[];
  types:CapaDistribution[];
  monthlyOpenings:number[];
};

const DAY=86_400_000;
const pct=(a:number,b:number)=>b?Math.round(a/b*1000)/10:null;

export function daysBetween(a:Date|null,b:Date|null) {
  if(!a||!b) return null;
  const days=Math.round((b.getTime()-a.getTime())/DAY);
  return days>=0?days:null;
}
export function median(values:number[]) {
  if(!values.length)return null;
  const x=[...values].sort((a,b)=>a-b),m=Math.floor(x.length/2);
  return x.length%2?x[m]:(x[m-1]+x[m])/2;
}
export function plannedCompletionDate(row:CapaAnalyticsRow) {
  if(!row.plannedDates.length)return null;
  return new Date(Math.max(...row.plannedDates.map((d)=>d.getTime())));
}
function distribution(rows:CapaAnalyticsRow[],get:(r:CapaAnalyticsRow)=>string) {
  const map=new Map<string,number>();
  rows.forEach((r)=>{const k=get(r);map.set(k,(map.get(k)??0)+1);});
  return [...map.entries()].map(([label,count])=>({
    label,count,percentage:rows.length?Math.round(count/rows.length*1000)/10:0,
  })).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,"es"));
}
export function buildCapaYearMetrics(
  rows:CapaAnalyticsRow[],
  year:number,
  dataAvailable=true,
):CapaYearMetrics {
  const opened=rows.filter((r)=>r.openingYear===year);
  const executed=rows.filter((r)=>r.operationalClosedAt?.getUTCFullYear()===year && r.status==="CLOSED");
  const evaluableExecution=executed.filter((r)=>plannedCompletionDate(r));
  const inTime=evaluableExecution.filter((r)=>r.operationalClosedAt!<=plannedCompletionDate(r)!).length;
  const executionDays=executed.map((r)=>daysBetween(r.openedAt,r.operationalClosedAt)).filter((v):v is number=>v!==null);

  const evaluated=rows.filter((r)=>
    r.effectiveClosedAt?.getUTCFullYear()===year &&
    (r.effectivenessStatus==="CONFORMING"||r.effectivenessStatus==="NONCONFORMING")
  );
  const conforming=evaluated.filter((r)=>r.effectivenessStatus==="CONFORMING").length;
  const efficacyDays=evaluated.map((r)=>daysBetween(r.operationalClosedAt,r.effectiveClosedAt)).filter((v):v is number=>v!==null);

  const months=Array.from({length:12},()=>0);
  opened.forEach((r)=>{if(r.openedAt)months[r.openedAt.getUTCMonth()]++;});

  return {
    year,dataAvailable,total:opened.length,
    openCurrent:opened.filter((r)=>r.status==="OPEN").length,
    cancelled:opened.filter((r)=>r.status==="CANCELLED").length,
    corrective:opened.filter((r)=>r.actionType==="CORRECTIVE").length,
    preventive:opened.filter((r)=>r.actionType==="PREVENTIVE").length,
    pendingEffectiveness:opened.filter((r)=>r.status==="CLOSED"&&r.effectivenessStatus==="PENDING"&&!r.effectiveClosedAt).length,
    execution:{
      inTime,total:evaluableExecution.length,rate:pct(inTime,evaluableExecution.length),
      medianDays:median(executionDays),
    },
    effectiveness:{
      conforming,
      nonconforming:evaluated.length-conforming,
      evaluated:evaluated.length,
      rate:pct(conforming,evaluated.length),
      pending:opened.filter((r)=>r.effectivenessStatus==="PENDING").length,
      medianDaysToEffectiveness:median(efficacyDays),
    },
    departments:distribution(opened,(r)=>r.departmentCode??"Sin departamento"),
    origins:distribution(opened,(r)=>r.originType?.trim()||"Sin origen"),
    types:distribution(opened,(r)=>r.actionType==="PREVENTIVE"?"Preventiva":"Correctiva"),
    monthlyOpenings:months,
  };
}
export function buildCapaFiveYearTrend(rows:CapaAnalyticsRow[],endYear:number,covered:Set<number>) {
  return Array.from({length:5},(_,i)=>endYear-4+i).map((year)=>
    buildCapaYearMetrics(rows,year,covered.has(year))
  );
}

// Tendencias y pendientes (2026-10-17). Descriptivos: sin objetivos ni plazos del PNT.
export const CAPA_PARETO = { department: "Departamento", origin: "Origen", type: "Tipo" } as const;
export type CapaParetoDimension = keyof typeof CAPA_PARETO;

export function buildCapaYearToDate(
  rows: CapaAnalyticsRow[],
  selectedYear: number,
  covered: Set<number>,
  today: Date,
): YearToDateComparison {
  const window = yearToDateWindow(selectedYear, today);
  const period = (year: number) => {
    const inPeriod = (date: Date | null) => inYearToDate(window, year, date);
    const opened = rows.filter((r) => inPeriod(r.openedAt));
    const executed = rows.filter((r) => r.status === "CLOSED" && inPeriod(r.operationalClosedAt));
    const evaluable = executed.filter((r) => plannedCompletionDate(r));
    const inTime = evaluable.filter((r) => r.operationalClosedAt! <= plannedCompletionDate(r)!).length;
    const evaluated = rows.filter((r) => inPeriod(r.effectiveClosedAt) && (r.effectivenessStatus === "CONFORMING" || r.effectivenessStatus === "NONCONFORMING"));
    return {
      opened: opened.length,
      corrective: opened.filter((r) => r.actionType === "CORRECTIVE").length,
      preventive: opened.filter((r) => r.actionType === "PREVENTIVE").length,
      executed: executed.length,
      inTimeRate: pct(inTime, evaluable.length),
      evaluated: evaluated.length,
      conformingRate: pct(evaluated.filter((r) => r.effectivenessStatus === "CONFORMING").length, evaluated.length),
    };
  };
  const current = period(selectedYear);
  const previous = period(selectedYear - 1);
  return {
    ...window,
    currentYear: selectedYear,
    previousYear: selectedYear - 1,
    currentAvailable: covered.has(selectedYear),
    previousAvailable: covered.has(selectedYear - 1),
    rows: [
      { label: "Aperturas", current: current.opened, previous: previous.opened, format: "count" },
      { label: "Correctivas", current: current.corrective, previous: previous.corrective, format: "count" },
      { label: "Preventivas", current: current.preventive, previous: previous.preventive, format: "count" },
      { label: "Ejecutadas", current: current.executed, previous: previous.executed, format: "count" },
      { label: "Ejecución en plazo", current: current.inTimeRate, previous: previous.inTimeRate, format: "percent" },
      { label: "Eficacias evaluadas", current: current.evaluated, previous: previous.evaluated, format: "count" },
      { label: "Eficacia conforme", current: current.conformingRate, previous: previous.conformingRate, format: "percent" },
    ],
    note: "Aperturas por fecha de apertura; ejecución por fecha de cierre operativo; eficacia por fecha de cierre de eficacia.",
  };
}

export type CapaBacklogRow = {
  id: string;
  code: string;
  openedAt: Date | null;
  actionType: "CORRECTIVE" | "PREVENTIVE";
  plannedDates: Date[];
  nextFollowupDate: Date | null;
};

const typeLabel = (value: CapaBacklogRow["actionType"]) => (value === "PREVENTIVE" ? "Preventiva" : "Correctiva");

/** CAPA abiertas hoy: antigüedad desde la apertura y fecha prevista de ejecución superada. */
export function buildCapaBacklog(rows: CapaBacklogRow[], today: Date) {
  const overdue = (row: CapaBacklogRow) => {
    const planned = row.plannedDates.length ? new Date(Math.max(...row.plannedDates.map((d) => d.getTime()))) : null;
    return isDue(planned, today, false);
  };
  return {
    ...buildAging(rows.map((row) => ({
      id: row.id,
      code: row.code,
      startDate: row.openedAt,
      tags: [overdue(row) ? "OVERDUE" : null, row.plannedDates.length ? null : "NO_PLAN"].filter((tag): tag is string => Boolean(tag)),
      note: `${typeLabel(row.actionType)}${overdue(row) ? " · prevista superada" : ""}`,
    })), today),
    overdue: rows.filter(overdue).length,
    withoutPlan: rows.filter((row) => !row.plannedDates.length).length,
    // Mismo criterio que el listado: próximo seguimiento hoy o antes.
    followupDue: rows.filter((row) => isDue(row.nextFollowupDate, today)).length,
  };
}

/** CAPA ejecutadas con la verificación de eficacia pendiente: días desde el cierre operativo. */
export function buildCapaEffectivenessBacklog(
  rows: Array<{ id: string; code: string; operationalClosedAt: Date | null; actionType: CapaBacklogRow["actionType"] }>,
  today: Date,
) {
  return buildAging(rows.map((row) => ({ id: row.id, code: row.code, startDate: row.operationalClosedAt, tags: [row.actionType], note: typeLabel(row.actionType) })), today);
}
