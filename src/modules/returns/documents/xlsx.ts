import { generateSimpleXlsx } from "@/lib/ooxml/simple-xlsx";
import { getZipEntryText,readZip,updateZipEntry,writeZip } from "@/lib/ooxml/zip";
import { escapeXml,setXlsxCell } from "@/lib/ooxml/xml";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { loadReturnTemplate } from "@/modules/returns/documents/templates";
import { DocumentType } from "@prisma/client";
import type { ReturnDocumentRecord } from "@/modules/returns/documents/docx";
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


const officialDate=(v:Date|null|undefined)=>v?new Intl.DateTimeFormat("es-ES").format(v):"";
const officialText=(v:string|null|undefined)=>v??"";
const returnTypeOfficial=(r:ReturnDocumentRecord)=>r.relatedDocument||(
 r.returnType==="COMMERCIAL"?"Comercial":
 r.returnType==="COMPLAINT"?"Reclamación":
 r.returnType==="RECALL"?"Retirada":
 r.returnType==="EXPIRY"?"Caducidad":
 r.returnType==="TRANSPORT"?"Transporte":
 r.otherReturnType||"Otra"
);

function officialCell(ref:string,style:string,value:string){
 if(!value)return `<c r="${ref}" s="${style}"></c>`;
 return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function officialReturnRow(rowNumber:number,r:ReturnDocumentRecord,p:ReturnDocumentRecord["products"][number],first:boolean){
 const values=[
  officialText(r.qmsRecord.businessCode),
  officialDate(r.communicationDate),
  returnTypeOfficial(r),
  officialText(r.customerEntity),
  p.productNameCode,
  officialText(p.format),
  officialText(p.lot),
  [p.quantity,p.unit].filter(Boolean).join(" "),
  officialText(p.expiryReanalysis),
  officialText(r.country),
  officialText(r.destructionManagedBy),
  officialText(r.destructionCertificate),
  [r.internalObservations,...r.followups.map(f=>`${officialDate(f.followupDate)}: ${f.comment}`)].filter(Boolean).join(" · "),
 ];
 const firstStyles=["4","5","5","4","4","4","4","4","6","4","4","4","4"];
 const normalStyles=["8","8","8","8","8","8","8","8","8","8","8","8","11"];
 const styles=first?firstStyles:normalStyles;
 return `<row r="${rowNumber}" spans="1:13">${values.map((value,index)=>officialCell(`${"ABCDEFGHIJKLM"[index]}${rowNumber}`,styles[index],value)).join("")}</row>`;
}

export async function generateReturnAnnexVI(year:number,records:ReturnDocumentRecord[],versionCode="03"){
 const entries=readZip(await loadReturnTemplate(versionCode,DocumentType.RETURN_ANNEX_VI));
 let sheet=getZipEntryText(entries,"xl/worksheets/sheet1.xml");
 let workbook=getZipEntryText(entries,"xl/workbook.xml");
 const source=[...sheet.matchAll(/<row\\b[^>]*\\br="(\\d+)"[^>]*>[\\s\\S]*?<\\/row>/g)]
   .map(match=>({number:Number(match[1]),xml:match[0]}));
 const headers=source.filter(item=>item.number<=4).map(item=>item.xml);
 const flat=records.flatMap(r=>r.products.length?r.products.map(p=>({r,p})):[{r,p:{id:"",productType:"",productNameCode:"",format:null,lot:null,expiryReanalysis:null,quantity:null,unit:null,netWeight:null,grossWeight:null,receptionObservations:null,receivedBy:null,verifiedBy:null}}]);
 const dataRows=flat.map(({r,p},index)=>officialReturnRow(5+index,r,p,index===0));
 const last=Math.max(5,4+dataRows.length);
 sheet=sheet.replace(/<sheetData>[\\s\\S]*?<\\/sheetData>/,`<sheetData>${[...headers,...dataRows].join("")}</sheetData>`);
 sheet=setXlsxCell(sheet,"A3",String(year));
 sheet=sheet.replace(/<dimension ref="[^"]+"/,`<dimension ref="A1:M${last}"`);
 workbook=workbook.replace(/<sheet name="&quot;AÑO&quot;"/,`<sheet name="${year}"`);
 updateZipEntry(entries,"xl/worksheets/sheet1.xml",sheet);
 updateZipEntry(entries,"xl/workbook.xml",workbook);
 sanitizeOfficeMetadata(entries);
 return writeZip(entries);
}
