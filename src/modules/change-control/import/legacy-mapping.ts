import type { XlsxCellValue,XlsxRow } from "@/modules/deviations/import/xlsx-reader";

export type HistoricalChangeFollowup={sequence:number;date:Date|null};
export type HistoricalChangeRow={
  sourceSheet:"2025"|"2026";sourceRow:number;year:number;departmentCode:string|null;departmentName:string|null;
  businessCode:string|null;scopeText:string|null;description:string|null;classification:"MAJOR"|"MINOR"|null;
  requestStatus:"PENDING"|"ACCEPTED"|"DENIED";requestedAt:Date|null;approvedAt:Date|null;plannedAt:Date|null;
  executionStatus:"EXECUTED"|"NOT_EXECUTED";executedAt:Date|null;closedAt:Date|null;
  status:"OPEN"|"CLOSED"|"REJECTED"|"CANCELLED";effectiveness:"PENDING"|"ACCEPTABLE"|"NOT_ACCEPTABLE";
  signed:boolean|null;observations:string|null;followups:HistoricalChangeFollowup[];nextFollowupAt:Date|null;issues:string[];raw:Record<string,XlsxCellValue>;
};
function str(v:XlsxCellValue){if(v===null||v===undefined)return null;const s=String(v).trim();return s||null;}
function date(v:XlsxCellValue){
  if(v instanceof Date)return v;
  if(typeof v==="number"){const d=new Date(Math.round((v-25569)*86400*1000));return Number.isNaN(d.valueOf())?null:d;}
  const s=str(v);if(!s)return null;
  const m=s.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);if(!m)return null;
  const y=+m[3]<100?2000+(+m[3]):+m[3];const d=new Date(Date.UTC(y,+m[2]-1,+m[1]));return Number.isNaN(d.valueOf())?null:d;
}
function classification(v:XlsxCellValue){const s=(str(v)??"").toLowerCase();return s.includes("mayor")?"MAJOR" as const:s.includes("menor")?"MINOR" as const:null;}
function requestStatus(v:XlsxCellValue){const s=(str(v)??"").toLowerCase();return s.includes("deneg")?"DENIED" as const:s.includes("acept")?"ACCEPTED" as const:"PENDING" as const;}
function execution(v:XlsxCellValue){const s=(str(v)??"").toLowerCase();return s.includes("ejecutado")&&!s.includes("no ejecutado")?"EXECUTED" as const:"NOT_EXECUTED" as const;}
function status(v:XlsxCellValue){const s=(str(v)??"").toLowerCase();if(s.includes("rechaz"))return "REJECTED" as const;if(s.includes("cancel"))return "CANCELLED" as const;if(s.includes("cerr"))return "CLOSED" as const;return "OPEN" as const;}
function efficacy(v:XlsxCellValue){const s=(str(v)??"").toLowerCase();if(s.includes("no acept"))return "NOT_ACCEPTABLE" as const;if(s.includes("acept"))return "ACCEPTABLE" as const;return "PENDING" as const;}
function bool(v:XlsxCellValue){const s=(str(v)??"").toLowerCase();if(["si","sí","yes"].includes(s))return true;if(s==="no")return false;return null;}
function followups(v:XlsxCellValue){
  const s=str(v);if(!s)return [];
  return [...s.matchAll(/(\d{1,2})\s*[(:-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/g)].map((m)=>({sequence:Number(m[1]),date:date(m[2])}));
}
function baseIssues(row:HistoricalChangeRow){
  if(!row.businessCode)row.issues.push("MISSING_CODE");
  if(!row.departmentCode)row.issues.push("MISSING_DEPARTMENT");
  if(!row.description)row.issues.push("MISSING_DESCRIPTION");
  if(!row.requestedAt)row.issues.push("MISSING_OR_INVALID_REQUEST_DATE");
  if(row.executionStatus==="EXECUTED"&&!row.executedAt)row.issues.push("EXECUTED_WITHOUT_VALID_DATE");
  if(row.status==="CLOSED"&&!row.closedAt)row.issues.push("CLOSED_WITHOUT_VALID_DATE");
  return row;
}
export function mapHistoricalChangeRows(rows2025:XlsxRow[],rows2026:XlsxRow[]){
  const out:HistoricalChangeRow[]=[];
  for(const row of rows2025){
    const code=str(row.cells.D);if(!code||!/^C\//i.test(code))continue;
    out.push(baseIssues({sourceSheet:"2025",sourceRow:row.rowNumber,year:2025,departmentCode:str(row.cells.C),departmentName:str(row.cells.E),businessCode:code,
      scopeText:str(row.cells.F),description:str(row.cells.G),classification:classification(row.cells.H),requestStatus:requestStatus(row.cells.I),
      requestedAt:date(row.cells.J),approvedAt:date(row.cells.K),plannedAt:date(row.cells.L),executionStatus:execution(row.cells.M),
      executedAt:date(row.cells.N),closedAt:date(row.cells.O),status:status(row.cells.P),effectiveness:efficacy(row.cells.Q),
      signed:bool(row.cells.R),observations:str(row.cells.S),followups:[],nextFollowupAt:null,issues:["HISTORICAL_LIST_ONLY"],raw:row.cells}));
  }
  for(const row of rows2026){
    const code=str(row.cells.C);if(!code||!/^C\//i.test(code))continue;
    out.push(baseIssues({sourceSheet:"2026",sourceRow:row.rowNumber,year:2026,departmentCode:str(row.cells.B),departmentName:null,businessCode:code,
      scopeText:null,description:str(row.cells.D),classification:classification(row.cells.G),requestStatus:"ACCEPTED",
      requestedAt:date(row.cells.E),approvedAt:date(row.cells.F),plannedAt:date(row.cells.H),executionStatus:execution(row.cells.I),
      executedAt:date(row.cells.J),closedAt:date(row.cells.O),status:status(row.cells.N),effectiveness:efficacy(row.cells.K),
      signed:null,observations:str(row.cells.P),followups:followups(row.cells.L),nextFollowupAt:date(row.cells.M),issues:["HISTORICAL_LIST_ONLY"],raw:row.cells}));
  }
  const counts=new Map<string,number>();out.forEach((r)=>{if(r.businessCode)counts.set(r.businessCode,(counts.get(r.businessCode)??0)+1);});
  out.forEach((r)=>{if(r.businessCode&&(counts.get(r.businessCode)??0)>1)r.issues.push("DUPLICATE_CODE_IN_SOURCE");});
  return out;
}
