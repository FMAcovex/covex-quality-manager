import { DocumentType } from "@prisma/client";
import { escapeXml,setXlsxCell } from "@/lib/ooxml/xml";
import { getZipEntryText,readZip,updateZipEntry,writeZip } from "@/lib/ooxml/zip";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { loadComplaintPntTemplate } from "@/modules/complaints/documents/templates";
import { generateSimpleXlsx } from "@/lib/ooxml/simple-xlsx";
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

const officialDate=(v:Date|null|undefined)=>v?new Intl.DateTimeFormat("es-ES").format(v):"";
const officialText=(v:string|null|undefined)=>v??"";
function officialStyles(rowXml:string){const m=new Map<string,string>();for(const x of rowXml.matchAll(/<c\b([^>]*\br="([A-Z]+)\d+"[^>]*)/g))m.set(x[2],x[1].match(/\bs="([^"]+)"/)?.[1]??"");return m;}
function officialCell(c:string,r:number,s:string,v:string){const a=s?` s="${s}"`:"";return v?`<c r="${c}${r}"${a} t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`:`<c r="${c}${r}"${a}></c>`;}
function officialClassification(v:string|null){return v==="CRITICAL"?"Crítica":v==="MAJOR"?"Mayor":v==="MINOR"?"Menor":v==="NO_GMP_IMPACT"?"Sin impacto GMP":"";}
export async function generateComplaintAnnexVXlsx(year:number,rows:Row[],versionCode="03"){
 const entries=readZip(await loadComplaintPntTemplate(versionCode,DocumentType.COMPLAINT_ANNEX_V));let sheet=getZipEntryText(entries,"xl/worksheets/sheet1.xml");
 const data=sheet.match(/<sheetData>([\s\S]*?)<\/sheetData>/);if(!data)throw new Error("Anexo V Reclamaciones: sheetData no encontrado.");
 const source=[...data[1].matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>[\s\S]*?<\/row>/g)].map(x=>({n:Number(x[1]),xml:x[0]}));const tpl=source.find(x=>x.n===5)?.xml;if(!tpl)throw new Error("Anexo V Reclamaciones: fila modelo no encontrada.");
 const st=officialStyles(tpl),headers=source.filter(x=>x.n<=4).map(x=>x.xml),out=rows.map((r,i)=>{const n=5+i,vals=[officialText(r.qmsRecord.businessCode),r.complaintType==="PROVIDER"?"A proveedor / subcontrata":"De cliente / agente externo",officialDate(r.openedAt),officialText(r.partyName),officialText(r.reference||r.affectedScope),officialText(r.lotReference),officialClassification(r.classification),r.closedAt?"Cerrada":"Abierta",officialDate(r.closedAt),[r.internalObservations,...r.capaPlans.map(x=>x.businessCapaCode||x.description)].filter(Boolean).join(" · ")];return `<row r="${n}">${["B","C","D","E","F","G","H","I","J","K"].map((col,j)=>officialCell(col,n,st.get(col)??"",vals[j])).join("")}</row>`;});
 sheet=sheet.replace(/<sheetData>[\\s\\S]*?<\\/sheetData>/,`<sheetData>${[...headers,...out].join("")}</sheetData>`).replace(/<dimension ref="[^"]+"/,`<dimension ref="A1:R${Math.max(5,4+rows.length)}"`);sheet=setXlsxCell(sheet,"B2",`LISTADO DE RECLAMACIONES\\n"${year}"`);
 updateZipEntry(entries,"xl/worksheets/sheet1.xml",sheet);sanitizeOfficeMetadata(entries);return writeZip(entries);
}
