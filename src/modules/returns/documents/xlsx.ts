import { generateSimpleXlsx } from "@/lib/ooxml/simple-xlsx";
import { formatDate,returnDecisionLabel,returnStatusLabel,returnTypeLabel } from "@/modules/returns/domain";
type Row=Awaited<ReturnType<typeof import("@/modules/returns/documents/export-data").getReturnExportRows>>[number];
export function generateReturnSimpleList(rows:Row[]){
 const headers=["N.º devolución","Fecha comunicación","Fecha recepción","Tipo","Cliente/Entidad","País","Documento relacionado","Producto","Formato","Lote","Cantidad","Caducidad/Reanálisis","Decisión","Destino final","Destrucción","Certificado destrucción","Estado","Último seguimiento","Próximo seguimiento"];
 const out=rows.flatMap(r=>r.products.length?r.products.map((p,i)=>{const f=r.followups[0];return[
  r.qmsRecord.businessCode??"",formatDate(r.communicationDate),formatDate(r.receivedAt),returnTypeLabel(r.returnType),r.customerEntity??"",r.country??"",r.relatedDocument??"",
  p.productNameCode,p.format??"",p.lot??"",[p.quantity,p.unit].filter(Boolean).join(" "),p.expiryReanalysis??"",returnDecisionLabel(r.decision),r.finalDestination??"",
  r.destructionManagedBy??"",r.destructionCertificate??"",returnStatusLabel(r.status),i===0&&f?formatDate(f.followupDate):"",i===0&&f?formatDate(f.nextFollowupDate):""
 ]}):[[
  r.qmsRecord.businessCode??"",formatDate(r.communicationDate),formatDate(r.receivedAt),returnTypeLabel(r.returnType),r.customerEntity??"",r.country??"",r.relatedDocument??"",
  "","","","","",returnDecisionLabel(r.decision),r.finalDestination??"",r.destructionManagedBy??"",r.destructionCertificate??"",returnStatusLabel(r.status),"",""
 ]]);
 return generateSimpleXlsx("Devoluciones",headers,out);
}


import { DocumentType } from "@prisma/client";
import { escapeXml,setXlsxCell } from "@/lib/ooxml/xml";
import { getZipEntryText,readZip,updateZipEntry,writeZip } from "@/lib/ooxml/zip";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { loadReturnPntTemplate } from "@/modules/returns/documents/templates";

const officialDate=(v:Date|null|undefined)=>v?new Intl.DateTimeFormat("es-ES").format(v):"";
const officialText=(v:string|null|undefined)=>v??"";
function officialStyles(rowXml:string){const m=new Map<string,string>();for(const x of rowXml.matchAll(/<c\\b([^>]*\\br="([A-Z]+)\\d+"[^>]*)/g))m.set(x[2],x[1].match(/\\bs="([^"]+)"/)?.[1]??"");return m;}
function officialCell(c:string,r:number,s:string,v:string){const a=s?` s="${s}"`:"";return v?`<c r="${c}${r}"${a} t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`:`<c r="${c}${r}"${a}></c>`;}
export async function generateReturnAnnexVIXlsx(year:number,rows:Row[],versionCode="03"){
 const entries=readZip(await loadReturnPntTemplate(versionCode,DocumentType.RETURN_ANNEX_VI));let sheet=getZipEntryText(entries,"xl/worksheets/sheet1.xml");
 const data=sheet.match(/<sheetData>([\\s\\S]*?)<\\/sheetData>/);if(!data)throw new Error("Anexo VI Devoluciones: sheetData no encontrado.");
 const source=[...data[1].matchAll(/<row\\b[^>]*\\br="(\\d+)"[^>]*>[\\s\\S]*?<\\/row>/g)].map(x=>({n:Number(x[1]),xml:x[0]}));const tpl=source.find(x=>x.n===5)?.xml;if(!tpl)throw new Error("Anexo VI Devoluciones: fila modelo no encontrada.");
 const st=officialStyles(tpl),headers=source.filter(x=>x.n<=4).map(x=>x.xml),flat=rows.flatMap(r=>r.products.map(p=>({r,p}))),out=flat.map(({r,p},i)=>{const n=5+i,vals=[officialText(r.qmsRecord.businessCode),officialDate(r.communicationDate),officialText(r.relatedDocument)||returnTypeLabel(r.returnType),officialText(r.customerEntity),p.productNameCode,officialText(p.format),officialText(p.lot),[p.quantity,p.unit].filter(Boolean).join(" "),officialText(p.expiryReanalysis),officialText(r.country),officialText(r.destructionManagedBy),officialText(r.destructionCertificate),[r.internalObservations,...r.followups.map(f=>`${officialDate(f.followupDate)}: ${f.comment}`)].filter(Boolean).join(" · ")];return `<row r="${n}">${["A","B","C","D","E","F","G","H","I","J","K","L","M"].map((col,j)=>officialCell(col,n,st.get(col)??"",vals[j])).join("")}</row>`;});
 sheet=sheet.replace(/<sheetData>[\\s\\S]*?<\\/sheetData>/,`<sheetData>${[...headers,...out].join("")}</sheetData>`).replace(/<dimension ref="[^"]+"/,`<dimension ref="A1:N${Math.max(5,4+flat.length)}"`);sheet=setXlsxCell(sheet,"A3",`"${year}"`);
 updateZipEntry(entries,"xl/worksheets/sheet1.xml",sheet);sanitizeOfficeMetadata(entries);return writeZip(entries);
}
