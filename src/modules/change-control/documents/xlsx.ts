import { escapeXml } from "@/lib/ooxml/xml";
import { writeZip,type ZipEntry } from "@/lib/ooxml/zip";

type ExportRow={
  qmsRecord:{businessCode:string|null};
  departmentCodeSnapshot:string|null;
  description:string|null;
  requestedAt:Date|null;
  decisionAt:Date|null;
  requestDecisionAt:Date|null;
  classification:string|null;
  plannedImplementationAt:Date|null;
  executionStatus:string;
  executedAt:Date|null;
  effectivenessStatus:string;
  status:string;
  effectiveClosedAt:Date|null;
  internalObservations:string|null;
  closureConclusion:string|null;
  followups:Array<{sequenceNumber:number;followupDate:Date;nextFollowupDate:Date|null}>;
};
function date(value:Date|null|undefined){return value?new Intl.DateTimeFormat("es-ES").format(value):"";}
function classification(value:string|null){return value==="MAJOR"?"Mayor":value==="MINOR"?"Menor":"";}
function execution(value:string){return value==="EXECUTED"?"Ejecutado":"No ejecutado";}
function efficacy(value:string){return value==="ACCEPTABLE"?"Aceptable":value==="NOT_ACCEPTABLE"?"No Aceptable":"Pendiente";}
function state(value:string){return value==="CLOSED"?"Cerrado":value==="REJECTED"?"Rechazado":value==="CANCELLED"?"Cancelado":"Abierto";}
function cell(ref:string,value:string,style=0){return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;}
function col(index:number){let n=index+1,s="";while(n){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}return s;}

function workbook(name:string,headers:string[],data:string[][]) {
  const rows=[headers,...data].map((values,ri)=>{
    const rn=ri+1;return `<row r="${rn}">${values.map((v,ci)=>cell(`${col(ci)}${rn}`,v,ri===0?1:0)).join("")}</row>`;
  }).join("");
  const last=col(headers.length-1),max=Math.max(1,data.length+1);
  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="${headers.length}" width="22" customWidth="1"/></cols><sheetData>${rows}</sheetData><autoFilter ref="A1:${last}${max}"/></worksheet>`;
  const entries:ZipEntry[]=[
    {name:"[Content_Types].xml",data:Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`)},
    {name:"_rels/.rels",data:Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`)},
    {name:"xl/workbook.xml",data:Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(name)}" sheetId="1" r:id="rId1"/></sheets></workbook>`)},
    {name:"xl/_rels/workbook.xml.rels",data:Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`)},
    {name:"xl/styles.xml",data:Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0"><alignment vertical="center" wrapText="1"/></xf></cellXfs></styleSheet>`)},
    {name:"xl/worksheets/sheet1.xml",data:Buffer.from(sheet)},
  ];
  return writeZip(entries);
}

export function generateChangeAnnexVII(year:number,rows:ExportRow[]) {
  const headers=["CÓDIGO DEPARTAMENTO","CÓDIFICACIÓN","DESCRIPCIÓN","FECHA SOLICITUD","FECHA DE APROBACIÓN","CLASIFICACIÓN (Mayor/Menor)","FECHA PREVISTA EJECUCIÓN","ESTADO DE EJECUCIÓN","FECHA DE EJECUCIÓN","EFICACIA","FECHA DE ÚLTIMO SEGUIMIENTO","FECHA PRÓXIMO SEGUIMIENTO","ESTADO FINAL","FECHA CIERRE","OBSERVACIONES"];
  const data=rows.map((r)=>{
    const latest=r.followups[0];
    return [r.departmentCodeSnapshot??"",r.qmsRecord.businessCode??"",r.description??"",date(r.requestedAt),date(r.decisionAt??r.requestDecisionAt),classification(r.classification),date(r.plannedImplementationAt),execution(r.executionStatus),date(r.executedAt),efficacy(r.effectivenessStatus),latest?`${String(latest.sequenceNumber).padStart(2,"0")} ${date(latest.followupDate)}`:"",date(latest?.nextFollowupDate),state(r.status),date(r.effectiveClosedAt),r.internalObservations??r.closureConclusion??""];
  });
  return workbook(`ANEXO VII ${year}`,headers,data);
}

export function generateChangeSimpleList(rows:ExportRow[]) {
  const headers=["CÓDIGO DEPARTAMENTO","CÓDIFICACIÓN","DESCRIPCIÓN","SOLICITUD","APROBACIÓN","CLASIFICACIÓN","PREVISTA","EJECUCIÓN","FECHA EJECUCIÓN","EFICACIA","ÚLTIMO SEGUIMIENTO","PRÓXIMO SEGUIMIENTO","ESTADO","CIERRE","OBSERVACIONES"];
  const data=rows.map((r)=>{const latest=r.followups[0];return [r.departmentCodeSnapshot??"",r.qmsRecord.businessCode??"",r.description??"",date(r.requestedAt),date(r.decisionAt??r.requestDecisionAt),classification(r.classification),date(r.plannedImplementationAt),execution(r.executionStatus),date(r.executedAt),efficacy(r.effectivenessStatus),latest?`${String(latest.sequenceNumber).padStart(2,"0")} · ${date(latest.followupDate)}`:"",date(latest?.nextFollowupDate),state(r.status),date(r.effectiveClosedAt),r.internalObservations??r.closureConclusion??""];});
  return workbook("Listado Controles Cambio",headers,data);
}
