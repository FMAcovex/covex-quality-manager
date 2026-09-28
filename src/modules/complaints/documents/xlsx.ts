import { readZip,updateZipEntry,writeZip } from "@/lib/ooxml/zip";
import { escapeXml,setXlsxCell } from "@/lib/ooxml/xml";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { loadComplaintPntTemplate } from "@/modules/complaints/documents/templates";
import { DocumentType } from "@prisma/client";
import { generateSimpleXlsx } from "@/lib/ooxml/simple-xlsx";
import { complaintClassificationLabel,complaintEffectivenessLabel,complaintStatusLabel,complaintTypeLabel,formatDate } from "@/modules/complaints/domain";

type Row=Awaited<ReturnType<typeof import("@/modules/complaints/documents/export-data").getComplaintExportRows>>[number];

function xmlCell(column:string,row:number,style:string,value:string){
 const s=style?` s="${style}"`:"";
 if(!value)return `<c r="${column}${row}"${s}></c>`;
 return `<c r="${column}${row}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}
function rowStyles(rowXml:string){
 const styles=new Map<string,string>();
 for(const m of rowXml.matchAll(new RegExp("<c\\b([^>]*\\br=\\\"([A-Z]+)\\d+\\\"[^>]*)","g")))styles.set(m[2],m[1].match(new RegExp("\\bs=\\\"([^\\\"]+)\\\""))?.[1]??"");
 return styles;
}

export async function generateComplaintAnnexV(year:number,rows:Row[],versionCode="03"){
 const entries=readZip(await loadComplaintPntTemplate(versionCode,DocumentType.COMPLAINT_ANNEX_V));
 const entry=entries.find(x=>x.name==="xl/worksheets/sheet1.xml");
 if(!entry)throw new Error("Anexo V Reclamaciones: hoja principal no encontrada.");
 let sheet=entry.data.toString("utf8");
 const data=sheet.match(new RegExp("<sheetData>([\\s\\S]*?)</sheetData>"));
 if(!data)throw new Error("Anexo V Reclamaciones: sheetData no encontrado.");
 const source=[...data[1].matchAll(new RegExp("<row\\b[^>]*\\br=\\\"(\\d+)\\\"[^>]*>[\\s\\S]*?</row>","g"))].map(m=>({n:Number(m[1]),xml:m[0]}));
 const template=source.find(x=>x.n===5)?.xml;
 if(!template)throw new Error("Anexo V Reclamaciones: fila modelo no encontrada.");
 const styles=rowStyles(template);
 const headers=source.filter(x=>x.n<=4).map(x=>x.xml);
 const body=rows.map((r,i)=>{
  const n=5+i, f=r.followups[0];
  const vals=[
   r.qmsRecord.businessCode??"",
   complaintTypeLabel(r.complaintType),
   formatDate(r.openedAt),
   r.partyName??"",
   r.reference??r.affectedScope??"",
   r.lotReference??"",
   complaintClassificationLabel(r.classification),
   complaintStatusLabel(r.status),
   formatDate(r.closedAt),
   [r.internalObservations,...r.capaPlans.map(x=>x.businessCapaCode||x.description),f?.comment].filter(Boolean).join(" · "),
  ];
  return `<row r="${n}">${"BCDEFGHIJK".split("").map((col,j)=>xmlCell(col,n,styles.get(col)??"",String(vals[j]??""))).join("")}</row>`;
 });
 sheet=sheet.replace(new RegExp("<sheetData>[\\s\\S]*?</sheetData>"),`<sheetData>${[...headers,...body].join("")}</sheetData>`);
 sheet=sheet.replace(/<dimension ref="[^"]+"/,`<dimension ref="B1:K${Math.max(5,4+rows.length)}"`);
 sheet=setXlsxCell(sheet,"B2",`LISTADO DE RECLAMACIONES\n"${year}"`);
 updateZipEntry(entries,"xl/worksheets/sheet1.xml",sheet);
 sanitizeOfficeMetadata(entries);
 return writeZip(entries);
}

export function generateComplaintSimpleList(rows:Row[]){
 const headers=["N.º reclamación","Tipo","Fecha apertura","Cliente/Proveedor","Producto/material/servicio","Lote/Ref.","Clasificación","Estado","Eficacia","Fecha cierre","Causa raíz","Recurrente","Último seguimiento","Próximo seguimiento","Observaciones/CAPA"];
 return generateSimpleXlsx("Reclamaciones",headers,rows.map(r=>{const f=r.followups[0];return[
  r.qmsRecord.businessCode??"",complaintTypeLabel(r.complaintType),formatDate(r.openedAt),r.partyName??"",r.reference??r.affectedScope??"",r.lotReference??"",
  complaintClassificationLabel(r.classification),complaintStatusLabel(r.status),complaintEffectivenessLabel(r.effectivenessStatus),formatDate(r.closedAt),r.rootCause??"",
  r.recurrent===true?"Sí":r.recurrent===false?"No":"",f?formatDate(f.followupDate):"",f?formatDate(f.nextFollowupDate):"",
  [r.internalObservations,...r.capaPlans.map(x=>x.businessCapaCode||x.description)].filter(Boolean).join(" · ")
 ]}));
}
