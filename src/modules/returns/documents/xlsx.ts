import { DocumentType } from "@prisma/client";
import { readZip,updateZipEntry,writeZip } from "@/lib/ooxml/zip";
import { escapeXml,setXlsxCell } from "@/lib/ooxml/xml";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { loadReturnPntTemplate } from "@/modules/returns/documents/templates";
import { generateSimpleXlsx } from "@/lib/ooxml/simple-xlsx";
import { formatDate,returnDecisionLabel,returnStatusLabel,returnTypeLabel } from "@/modules/returns/domain";

type Row=Awaited<ReturnType<typeof import("@/modules/returns/documents/export-data").getReturnExportRows>>[number];

function xmlCell(column:string,row:number,style:string,value:string){
 const s=style?` s="${style}"`:"";
 if(!value)return `<c r="${column}${row}"${s}></c>`;
 return `<c r="${column}${row}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}
function stylesFrom(rowXml:string){
 const out=new Map<string,string>();
 for(const m of rowXml.matchAll(new RegExp("<c\\b([^>]*\\br=\\\"([A-Z]+)\\d+\\\"[^>]*)","g")))out.set(m[2],m[1].match(new RegExp("\\bs=\\\"([^\\\"]+)\\\""))?.[1]??"");
 return out;
}

function returnRowHeight(values:string[]){
 const longest=Math.max(...values.map(value=>value.length),0);
 if(longest>260)return 108;
 if(longest>180)return 90;
 if(longest>100)return 72;
 return 54;
}
export function finalizeReturnAnnexVISheet(sheetXml:string){
 const setup='<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>';
 let result=sheetXml;
 if(/<pageSetup\b[^>]*\/>/.test(result)) result=result.replace(/<pageSetup\b[^>]*\/>/,setup);
 else if(/<pageMargins\b[^>]*\/>/.test(result)) result=result.replace(/<pageMargins\b[^>]*\/>/,(m)=>`${m}${setup}`);
 if(!/<sheetPr\b/.test(result)) result=result.replace(/(<dimension\b)/,'<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>$1');
 return result;
}
export function finalizeReturnAnnexVIWorkbook(workbookXml:string,maxRow:number){
 const names=`<definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'&quot;AÑO&quot;'!$A$1:$M${maxRow}</definedName><definedName name="_xlnm.Print_Titles" localSheetId="0">'&quot;AÑO&quot;'!$4:$4</definedName></definedNames>`;
 if(/<definedNames>[\s\S]*?<\/definedNames>/.test(workbookXml))return workbookXml.replace(/<definedNames>[\s\S]*?<\/definedNames>/,names);
 return workbookXml.replace(/<calcPr\b/,()=>`${names}<calcPr`);
}

export async function generateReturnAnnexVI(year:number,rows:Row[],versionCode="03"){
 const entries=readZip(await loadReturnPntTemplate(versionCode,DocumentType.RETURN_ANNEX_VI));
 const entry=entries.find(x=>x.name==="xl/worksheets/sheet1.xml");
 if(!entry)throw new Error("Anexo VI Devoluciones: hoja principal no encontrada.");
 let sheet=entry.data.toString("utf8");
 const data=sheet.match(new RegExp("<sheetData>([\\s\\S]*?)</sheetData>"));
 if(!data)throw new Error("Anexo VI Devoluciones: sheetData no encontrado.");
 const source=[...data[1].matchAll(new RegExp("<row\\b[^>]*\\br=\\\"(\\d+)\\\"[^>]*>[\\s\\S]*?</row>","g"))].map(m=>({n:Number(m[1]),xml:m[0]}));
 const first=source.find(x=>x.n===5)?.xml, normal=source.find(x=>x.n===6)?.xml??first;
 if(!first||!normal)throw new Error("Anexo VI Devoluciones: fila modelo no encontrada.");
 const firstStyles=stylesFrom(first),normalStyles=stylesFrom(normal);
 const headers=source.filter(x=>x.n<=4).map(x=>x.xml);
 const flat=rows.flatMap(r=>(r.products.length?r.products:[null]).map((p,i)=>({r,p,i})));
 const body=flat.map(({r,p,i},index)=>{
  const n=5+index,styles=index===0?firstStyles:normalStyles;
  const follow=[r.finalDestination?`Destino: ${r.finalDestination}`:null,r.traceabilityUpdated?`Trazabilidad: ${r.traceabilityUpdated}`:null,r.internalObservations,...r.followups.map(f=>`${formatDate(f.followupDate)}: ${f.comment}`)].filter(Boolean).join(" · ");
  const vals=[
    r.qmsRecord.businessCode??"",formatDate(r.communicationDate),r.relatedDocument??returnTypeLabel(r.returnType),
    r.customerEntity??"",p?.productNameCode??"",p?.format??"",p?.lot??"",[p?.quantity,p?.unit].filter(Boolean).join(" "),
    p?.expiryReanalysis??"",r.country??"",r.destructionManagedBy??"",r.destructionCertificate??"",i===0?follow:"",
  ];
  return `<row r="${n}" ht="${returnRowHeight(vals.map(value=>String(value??"")))}" customHeight="1">${"ABCDEFGHIJKLM".split("").map((col,j)=>xmlCell(col,n,styles.get(col)??"",String(vals[j]??""))).join("")}</row>`;
 });
 const maxRow=Math.max(5,4+flat.length);
 sheet=sheet.replace(new RegExp("<sheetData>[\\s\\S]*?</sheetData>"),`<sheetData>${[...headers,...body].join("")}</sheetData>`);
 sheet=sheet.replace(/<dimension ref="[^"]+"/,`<dimension ref="A1:M${maxRow}"`);
 sheet=setXlsxCell(sheet,"A3",String(year));
 sheet=finalizeReturnAnnexVISheet(sheet);
 updateZipEntry(entries,"xl/worksheets/sheet1.xml",sheet);
 const workbookEntry=entries.find(x=>x.name==="xl/workbook.xml");
 if(!workbookEntry)throw new Error("Anexo VI Devoluciones: workbook no encontrado.");
 updateZipEntry(entries,"xl/workbook.xml",finalizeReturnAnnexVIWorkbook(workbookEntry.data.toString("utf8"),maxRow));
 sanitizeOfficeMetadata(entries);
 return writeZip(entries);
}

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
