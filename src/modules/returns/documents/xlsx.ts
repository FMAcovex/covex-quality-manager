import { generateSimpleXlsx } from "@/lib/ooxml/simple-xlsx";
import { DocumentType } from "@prisma/client";
import { getZipEntryText, readZip, updateZipEntry, writeZip } from "@/lib/ooxml/zip";
import { escapeXml, setXlsxCell } from "@/lib/ooxml/xml";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { loadReturnTemplate } from "@/modules/returns/documents/templates";
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


function styleMap(rowXml:string){
 const styles=new Map<string,string>();
 for(const m of rowXml.matchAll(/<c\b([^>]*\br="([A-Z]+)\d+"[^>]*)/g))styles.set(m[2],m[1].match(/\bs="([^"]+)"/)?.[1]??"");
 return styles;
}
function xcell(column:string,row:number,style:string,value:string){
 const s=style?` s="${style}"`:"";
 return value?`<c r="${column}${row}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`:`<c r="${column}${row}"${s}></c>`;
}
function returnOrigin(r:Row){
 const type=returnTypeLabel(r.returnType);
 return [r.relatedDocument,type,r.reasonObservations].filter(Boolean).join(" · ");
}
export async function generateReturnAnnexVI(year:number, records:Row[], versionCode="03"){
 const entries=readZip(await loadReturnTemplate(versionCode,DocumentType.RETURN_ANNEX_VI));
 let sheet=getZipEntryText(entries,"xl/worksheets/sheet1.xml");
 const m=sheet.match(/<sheetData>([\s\S]*?)<\/sheetData>/);
 if(!m)throw new Error("Anexo VI Devoluciones: sheetData no encontrado.");
 const source=[...m[1].matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>[\s\S]*?<\/row>/g)].map(x=>({n:Number(x[1]),xml:x[0]}));
 const headers=source.filter(x=>x.n<=4).map(x=>x.xml);
 const template=source.find(x=>x.n===6)??source.find(x=>x.n===5);
 if(!template)throw new Error("Anexo VI Devoluciones: fila modelo no encontrada.");
 const styles=styleMap(template.xml);
 const rows=records.flatMap(r=>(r.products.length?r.products:[null]).map(p=>[
   r.qmsRecord.businessCode??"",formatDate(r.communicationDate),returnOrigin(r),r.customerEntity??"",
   p?.productNameCode??"",p?.format??"",p?.lot??"",[p?.quantity,p?.unit].filter(Boolean).join(" "),
   p?.expiryReanalysis??"",r.country??"",r.destructionManagedBy??"",r.destructionCertificate??"",
   [r.internalObservations,...r.followups.map(f=>`${formatDate(f.followupDate)}: ${f.comment}`)].filter(Boolean).join(" · ")
 ]));
 const capacity=Math.max(rows.length,6);
 const dataRows=Array.from({length:capacity},(_,i)=>{
   const values=rows[i]??Array(13).fill(""),n=5+i;
   const cells="ABCDEFGHIJKLM".split("").map((col,j)=>xcell(col,n,styles.get(col)??"",String(values[j]??""))).join("");
   return `<row r="${n}">${cells}</row>`;
 });
 sheet=sheet.replace(/<sheetData>[\s\S]*?<\/sheetData>/,`<sheetData>${[...headers,...dataRows].join("")}</sheetData>`);
 sheet=sheet.replace(/<dimension ref="[^"]+"/,`<dimension ref="A1:N${4+capacity}"`);
 sheet=setXlsxCell(sheet,"A3",`"${year}"`);
 updateZipEntry(entries,"xl/worksheets/sheet1.xml",sheet);
 sanitizeOfficeMetadata(entries);
 return writeZip(entries);
}
