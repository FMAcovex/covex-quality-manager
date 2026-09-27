import type { XlsxCellValue,XlsxRow } from "@/modules/deviations/import/xlsx-reader";

export type HistoricalCapaRow={
  sourceSheet:"2025"|"2026";
  sourceRow:number;
  year:number;
  actionType:"CORRECTIVE"|"PREVENTIVE";
  departmentCode:string|null;
  departmentName:string|null;
  businessCode:string|null;
  originType:string|null;
  normalizedOrigin:string|null;
  originCode:string|null;
  description:string|null;
  openedAt:Date|null;
  plannedAt:Date|null;
  operationalClosedAt:Date|null;
  effectiveClosedAt:Date|null;
  status:"OPEN"|"CLOSED"|"CANCELLED";
  effectivenessStatus:"CONFORMING"|"NONCONFORMING"|"PENDING";
  observations:string|null;
  signedDocumentAvailable:boolean|null;
  followupSummary:string|null;
  followupSequence:number|null;
  followupDate:Date|null;
  nextFollowupDate:Date|null;
  issues:string[];
  raw:Record<string,XlsxCellValue>;
};

function str(v:XlsxCellValue){if(v===null||v===undefined)return null;const s=String(v).trim();return s||null;}
function date(v:XlsxCellValue){
  if(typeof v==="number"){const d=new Date(Math.round((v-25569)*86400*1000));return Number.isNaN(d.valueOf())?null:d;}
  const s=str(v); if(!s)return null;
  const iso=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(iso)return new Date(Date.UTC(+iso[1],+iso[2]-1,+iso[3]));
  const m=s.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if(!m)return null; const y=+m[3]<100?2000+(+m[3]):+m[3];
  return new Date(Date.UTC(y,+m[2]-1,+m[1]));
}
function type(v:XlsxCellValue){
  const s=(str(v)??"").toLowerCase();
  return s.includes("prevent")||s==="ap"?"PREVENTIVE" as const:"CORRECTIVE" as const;
}
function status(v:XlsxCellValue){
  const s=(str(v)??"").toLowerCase();
  if(s.includes("cancel"))return "CANCELLED" as const;
  if(s.includes("cerr"))return "CLOSED" as const;
  return "OPEN" as const;
}
function efficacy(v:XlsxCellValue){
  const s=(str(v)??"").toLowerCase();
  if(s.includes("no conforme"))return "NONCONFORMING" as const;
  if(s.includes("conforme"))return "CONFORMING" as const;
  return "PENDING" as const;
}
function bool(v:XlsxCellValue){
  const s=(str(v)??"").toLowerCase();
  if(["si","sí","yes"].includes(s))return true;
  if(["no"].includes(s))return false;
  return null;
}
function followup(raw:XlsxCellValue){
  const s=str(raw); if(!s)return {summary:null,sequence:null,date:null};
  const matches=[...s.matchAll(/(\d{1,2})\s*(?:[-–:]?\s*)?(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/g)];
  const last=matches.at(-1);
  return {
    summary:s,
    sequence:last?Number(last[1]):null,
    date:last?date(last[2]):null,
  };
}

export function baseKpiByCode(rows:XlsxRow[]) {
  const map=new Map<string,{normalizedOrigin:string|null;efficacy:string|null}>();
  for(const row of rows){
    const code=str(row.cells.E); if(!code)continue;
    map.set(code,{normalizedOrigin:str(row.cells.H),efficacy:str(row.cells.P)});
  }
  return map;
}

export function mapHistoricalCapaRows(
  rows2025:XlsxRow[],
  rows2026:XlsxRow[],
  baseRows:XlsxRow[],
):HistoricalCapaRow[] {
  const base=baseKpiByCode(baseRows);
  const output:HistoricalCapaRow[]=[];

  for(const row of rows2025){
    const code=str(row.cells.D);
    if(!code||!/^A[CP]\//i.test(code))continue;
    const enriched=base.get(code);
    const mapped:HistoricalCapaRow={
      sourceSheet:"2025",sourceRow:row.rowNumber,year:2025,
      actionType:type(row.cells.B),departmentCode:str(row.cells.C),departmentName:str(row.cells.E),
      businessCode:code,originType:str(row.cells.F),normalizedOrigin:enriched?.normalizedOrigin??null,
      originCode:str(row.cells.G),description:str(row.cells.H),openedAt:date(row.cells.I),
      plannedAt:date(row.cells.J),operationalClosedAt:date(row.cells.K),effectiveClosedAt:date(row.cells.L),
      status:status(row.cells.M),effectivenessStatus:efficacy(enriched?.efficacy??null),
      observations:str(row.cells.O),signedDocumentAvailable:bool(row.cells.N),
      followupSummary:null,followupSequence:null,followupDate:null,nextFollowupDate:null,
      issues:["HISTORICAL_LIST_ONLY","ROOT_CAUSE_NOT_IN_LIST"],raw:row.cells,
    };
    if(!mapped.openedAt)mapped.issues.push("MISSING_OR_INVALID_OPENING_DATE");
    if(!mapped.departmentCode)mapped.issues.push("MISSING_DEPARTMENT");
    if(!mapped.description)mapped.issues.push("MISSING_DESCRIPTION");
    if(!enriched)mapped.issues.push("NOT_PRESENT_IN_BASE_KPI");
    output.push(mapped);
  }

  for(const row of rows2026){
    const code=str(row.cells.C);
    if(!code||!/^A[CP]\//i.test(code))continue;
    const enriched=base.get(code);
    const f=followup(row.cells.L);
    const mapped:HistoricalCapaRow={
      sourceSheet:"2026",sourceRow:row.rowNumber,year:2026,
      actionType:type(row.cells.A),departmentCode:str(row.cells.B),departmentName:null,
      businessCode:code,originType:str(row.cells.D),normalizedOrigin:enriched?.normalizedOrigin??null,
      originCode:str(row.cells.E),description:str(row.cells.F),openedAt:date(row.cells.G),
      plannedAt:date(row.cells.H),operationalClosedAt:date(row.cells.J),effectiveClosedAt:date(row.cells.N),
      status:status(row.cells.I),effectivenessStatus:efficacy(row.cells.K),
      observations:str(row.cells.O),signedDocumentAvailable:null,
      followupSummary:f.summary,followupSequence:f.sequence,followupDate:f.date,nextFollowupDate:date(row.cells.M),
      issues:["HISTORICAL_LIST_ONLY","ROOT_CAUSE_NOT_IN_LIST"],raw:row.cells,
    };
    if(!mapped.openedAt)mapped.issues.push("MISSING_OR_INVALID_OPENING_DATE");
    if(!mapped.departmentCode)mapped.issues.push("MISSING_DEPARTMENT");
    if(!mapped.description)mapped.issues.push("MISSING_DESCRIPTION");
    if(!enriched)mapped.issues.push("NOT_PRESENT_IN_BASE_KPI");
    output.push(mapped);
  }

  const counts=new Map<string,number>();
  output.forEach((r)=>{if(r.businessCode)counts.set(r.businessCode,(counts.get(r.businessCode)??0)+1);});
  output.forEach((r)=>{if(r.businessCode&&(counts.get(r.businessCode)??0)>1)r.issues.push("DUPLICATE_CODE_IN_SOURCE");});
  return output;
}
