import { generateSimpleXlsx } from "@/lib/ooxml/simple-xlsx";
import { DocumentType } from "@prisma/client";
import { getZipEntryText, readZip, updateZipEntry, writeZip } from "@/lib/ooxml/zip";
import { setXlsxCell } from "@/lib/ooxml/xml";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { loadComplaintTemplate } from "@/modules/complaints/documents/templates";

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


export async function generateComplaintAnnexV(year:number, rows:Row[], versionCode="03"){
 const entries=readZip(await loadComplaintTemplate(DocumentType.COMPLAINT_ANNEX_V,versionCode));
 let sheet=getZipEntryText(entries,"xl/worksheets/sheet1.xml");
 sheet=setXlsxCell(sheet,"B2",`LISTADO DE RECLAMACIONES\n"${year}"`);
 const capacity=30;
 if(rows.length>capacity)throw new Error(`El Anexo V de Reclamaciones admite ${capacity} registros en la plantilla actual.`);
 const cls=(v:string|null)=>v==="CRITICAL"?"Crítica":v==="MAJOR"?"Mayor":v==="MINOR"?"Menor":v==="NO_GMP_IMPACT"?"Sin impacto GMP":"";
 for(let i=0;i<capacity;i++){
  const r=rows[i]??null,n=5+i;
  const values=r?[
   r.qmsRecord.businessCode??"",
   r.complaintType==="PROVIDER"?"A proveedor":"De cliente",
   formatDate(r.openedAt),r.partyName??"",r.reference??r.affectedScope??"",r.lotReference??"",
   cls(r.classification),r.status==="CLOSED"?"Cerrada":"Abierta",formatDate(r.closedAt),
   [r.internalObservations,...r.capaPlans.map(x=>x.businessCapaCode||x.description)].filter(Boolean).join(" · ")
  ]:Array(10).fill("");
  "BCDEFGHIJK".split("").forEach((column,index)=>{sheet=setXlsxCell(sheet,`${column}${n}`,values[index] as string);});
 }
 updateZipEntry(entries,"xl/worksheets/sheet1.xml",sheet);
 sanitizeOfficeMetadata(entries);
 return writeZip(entries);
}
