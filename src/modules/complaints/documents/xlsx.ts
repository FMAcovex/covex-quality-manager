import { generateSimpleXlsx } from "@/lib/ooxml/simple-xlsx";
import { getZipEntryText,readZip,updateZipEntry,writeZip } from "@/lib/ooxml/zip";
import { escapeXml,setXlsxCell } from "@/lib/ooxml/xml";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { loadComplaintAnnexVTemplate } from "@/modules/complaints/documents/templates";
import type { ComplaintDocumentRecord } from "@/modules/complaints/documents/docx";

import { complaintClassificationLabel,complaintEffectivenessLabel,complaintStatusLabel,complaintTypeLabel,formatDate } from "@/modules/complaints/domain";
type Row=Awaited<ReturnType<typeof import("@/modules/complaints/documents/export-data").getComplaintExportRows>>[number];
export function generateComplaintSimpleList(rows:Row[]){
 const headers=["N.º reclamación","Tipo","Fecha apertura","Cliente/Proveedor","Producto/material/servicio","Lote/Ref.","Clasificación","Estado","Eficacia","Fecha cierre","Causa raíz","Recurrente","Último seguimiento","Próximo seguimiento","Observaciones/CAPA"];
 return generateSimpleXlsx("Reclamaciones",headers,rows.map(r=>{const f=r.followups[0];return[
  r.qmsRecord.businessCode??"",complaintTypeLabel(r.complaintType),formatDate(r.openedAt),r.partyName??"",r.reference??r.affectedScope??"",r.lotReference??"",
  complaintClassificationLabel(r.classification),complaintStatusLabel(r.status),complaintEffectivenessLabel(r.effectivenessStatus),formatDate(r.closedAt),r.rootCause??"",
  r.recurrent===true?"Sí":r.recurrent===false?"No":"",f?formatDate(f.followupDate):"",f?formatDate(f.nextFollowupDate):"",
  [r.internalObservations,...r.capaPlans.map(x=>x.businessCapaCode||x.description)].filter(Boolean).join(" · ")
 ]}));
}


const annexDate=(v:Date|null|undefined)=>v?new Intl.DateTimeFormat("es-ES").format(v):"";
const annexText=(v:string|null|undefined)=>v??"";
const annexClassification=(v:string|null)=>v==="CRITICAL"?"CRÍTICA":v==="MAJOR"?"MAYOR":v==="MINOR"?"MENOR":v==="NO_GMP_IMPACT"?"SIN IMPACTO GMP":"";

function annexCell(ref:string,style:string,value:string){
 if(!value)return `<c r="${ref}" s="${style}"></c>`;
 return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function complaintAnnexRow(rowNumber:number,r:ComplaintDocumentRecord){
 const values=[
  annexText(r.qmsRecord.businessCode),
  r.complaintType==="PROVIDER"?"A PROVEEDOR":"DE CLIENTE",
  annexDate(r.openedAt),
  annexText(r.partyName),
  annexText(r.reference||r.affectedScope),
  annexText(r.lotReference),
  annexClassification(r.classification),
  r.status==="CLOSED"||r.closedAt?"CERRADA":"ABIERTA",
  annexDate(r.closedAt),
  [r.internalObservations,...r.capaPlans.map(x=>x.businessCapaCode||x.description)].filter(Boolean).join(" · "),
 ];
 return `<row r="${rowNumber}" spans="2:11" ht="36" customHeight="1">${values.map((value,index)=>annexCell(`${"BCDEFGHIJK"[index]}${rowNumber}`,index===0?"15":"16",value)).join("")}</row>`;
}

export async function generateComplaintAnnexV(year:number,rows:ComplaintDocumentRecord[],versionCode="03"){
 const entries=readZip(await loadComplaintAnnexVTemplate(versionCode));
 let sheet=getZipEntryText(entries,"xl/worksheets/sheet1.xml");
 let workbook=getZipEntryText(entries,"xl/workbook.xml");

 const source=[...sheet.matchAll(/<row\\b[^>]*\\br="(\\d+)"[^>]*>[\\s\\S]*?<\\/row>/g)]
   .map(match=>({number:Number(match[1]),xml:match[0]}));
 const headers=source.filter(item=>item.number<=4).map(item=>item.xml);
 const dataRows=rows.map((row,index)=>complaintAnnexRow(5+index,row));
 const last=Math.max(5,4+rows.length);

 sheet=sheet.replace(/<sheetData>[\\s\\S]*?<\\/sheetData>/,`<sheetData>${[...headers,...dataRows].join("")}</sheetData>`);
 sheet=setXlsxCell(sheet,"B2",`LISTADO DE RECLAMACIONES\\n"${year}"`);
 sheet=sheet.replace(/<dimension ref="[^"]+"/,`<dimension ref="B1:K${last}"`);
 sheet=sheet.replace(/<conditionalFormatting[\\s\\S]*?<\\/conditionalFormatting>/g,"");
 sheet=sheet.replace(/<autoFilter[^>]*\\/>/g,`<autoFilter ref="B4:K${last}"/>`);

 workbook=workbook
  .replace(/<sheet name="AÑO"/,`<sheet name="${year}"`)
  .replaceAll("AÑO!$",`'${year}'!$`)
  .replace(/<definedName name="_xlnm\\._FilterDatabase"[^>]*>[\\s\\S]*?<\\/definedName>/,`<definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${year}'!$B$4:$K$${last}</definedName>`)
  .replace(/<definedName name="_xlnm\\.Print_Area"[^>]*>[\\s\\S]*?<\\/definedName>/,`<definedName name="_xlnm.Print_Area" localSheetId="0">'${year}'!$B$1:$K$${last}</definedName>`);

 updateZipEntry(entries,"xl/worksheets/sheet1.xml",sheet);
 updateZipEntry(entries,"xl/workbook.xml",workbook);
 sanitizeOfficeMetadata(entries);
 return writeZip(entries);
}
