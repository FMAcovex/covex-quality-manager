import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType,QmsRecordType } from "@prisma/client";
import { loadStoredTemplateAsset } from "@/modules/configuration/template-assets";

export class ReturnTemplateUnavailableError extends Error {}

const V03_PNT_SHA="7f6b318e936cef9d2685347decf52b8951c34585dbd2ef1ebca05232a0c59a5a";
const V03_ANNEX_III_SHA="9716477f2b261a4fec8b1d459fb8aa62bd42840f8fa352b4b66b15c2669745f4";
const V03_ANNEX_VI_SHA="fa027508995beca7e39368f92e9d75ac2fdcf0dd7dffa57dfef8d59e6696db64";

async function readChecked(filePath:string,expectedSha:string,label:string){
 let buffer:Buffer;
 try{buffer=await readFile(path.resolve(process.cwd(),filePath));}
 catch{throw new ReturnTemplateUnavailableError(`Plantilla ${label} no instalada: ${filePath}. Cárgala desde Administración → Versiones y plantillas.`);}
 const sha=createHash("sha256").update(buffer).digest("hex");
 if(sha!==expectedSha)throw new ReturnTemplateUnavailableError(`La plantilla ${label} no coincide con GC-00/028/03 auditado (SHA-256 inesperado).`);
 return buffer;
}

export async function loadReturnPntTemplate(versionCode="03",documentType:DocumentType=DocumentType.RETURN_ANNEX_III){
 const stored=await loadStoredTemplateAsset(QmsRecordType.RETURN,documentType,versionCode);
 if(stored)return stored;
 if(versionCode!=="03")throw new ReturnTemplateUnavailableError(`No hay plantilla controlada para Devoluciones versión ${versionCode}.`);

 if(documentType===DocumentType.RETURN_ANNEX_III){
  return readChecked("templates/returns/v03/Anexo III Formulario Devolucion 03.docx",V03_ANNEX_III_SHA,"Anexo III Devoluciones");
 }
 if(documentType===DocumentType.RETURN_ANNEX_VI){
  return readChecked("templates/returns/v03/Anexo VI Listado Devoluciones 03.xlsx",V03_ANNEX_VI_SHA,"Anexo VI Devoluciones");
 }
 const filePath=process.env.RETURN_PNT_TEMPLATE||"templates/returns/v03/GC-00-028-03 Devoluciones.docx";
 return readChecked(filePath,V03_PNT_SHA,documentType===DocumentType.RETURN_ANNEX_IV?"Anexo IV Devoluciones":"Anexo V Devoluciones");
}
export const auditedReturnTemplateHashes={pntV03:V03_PNT_SHA,annexIIIV03:V03_ANNEX_III_SHA,annexVIV03:V03_ANNEX_VI_SHA};
