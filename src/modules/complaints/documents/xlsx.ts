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

function complaintRowHeight(values:string[]){
 const longest=Math.max(...values.map(value=>value.length),0);
 if(longest>240)return 90;
 if(longest>160)return 72;
 if(longest>80)return 54;
 return 36;
}
export function finalizeComplaintAnnexVSheet(sheetXml:string,maxRow:number){
 let result=sheetXml
  .replace(/<conditionalFormatting[\s\S]*?<\/conditionalFormatting>/g,"")
  .replace(/<tableParts[\s\S]*?<\/tableParts>/g,"")
  .replace(/<extLst[\s\S]*?<\/extLst>/g,"");
 const filter=`<autoFilter ref="B4:K${maxRow}"/>`;
 if(/<autoFilter\b/.test(result)) result=result.replace(/<autoFilter\b[^>]*\/>/,filter);
 else result=result.replace(/(<mergeCells\b)/,`${filter}$1`);
 const setup='<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>';
 result=/<pageSetup\b[^>]*\/>/.test(result)
  ?result.replace(/<pageSetup\b[^>]*\/>/,setup)
  :result.replace(/(<drawing\b)/,`${setup}$1`);
 return result;
}
export function finalizeComplaintAnnexVWorkbook(workbookXml:string,maxRow:number){
 let result=workbookXml.replace(/<sheet\b[^>]*name="datos"[^>]*\/>/,"");
 const names=`<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">AÑO!$B$4:$K${maxRow}</definedName><definedName name="_xlnm.Print_Area" localSheetId="0">AÑO!$B$1:$K${maxRow}</definedName><definedName name="_xlnm.Print_Titles" localSheetId="0">AÑO!$4:$4</definedName></definedNames>`;
 result=/<definedNames>[\s\S]*?<\/definedNames>/.test(result)
  ?result.replace(/<definedNames>[\s\S]*?<\/definedNames>/,names)
  :result.replace(/(<calcPr\b)/,`${names}$1`);
 return result;
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
  return `<row r="${n}" ht="${complaintRowHeight(vals.map(value=>String(value??"")))}" customHeight="1">${"BCDEFGHIJK".split("").map((col,j)=>xmlCell(col,n,styles.get(col)??"",String(vals[j]??""))).join("")}</row>`;
 });
 const maxRow=Math.max(5,4+rows.length);
 sheet=sheet.replace(new RegExp("<sheetData>[\\s\\S]*?</sheetData>"),`<sheetData>${[...headers,...body].join("")}</sheetData>`);
 sheet=sheet.replace(/<dimension ref="[^"]+"/,`<dimension ref="B1:K${maxRow}"`);
 sheet=setXlsxCell(sheet,"B2",`LISTADO DE RECLAMACIONES\n"${year}"`);
 sheet=finalizeComplaintAnnexVSheet(sheet,maxRow);
 updateZipEntry(entries,"xl/worksheets/sheet1.xml",sheet);
 updateZipEntry(entries,"xl/workbook.xml",finalizeComplaintAnnexVWorkbook(entries.find(x=>x.name==="xl/workbook.xml")!.data.toString("utf8"),maxRow));
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
