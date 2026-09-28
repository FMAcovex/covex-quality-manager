import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType,QmsRecordType } from "@prisma/client";
import { loadStoredTemplateAsset } from "@/modules/configuration/template-assets";

export class ReturnTemplateUnavailableError extends Error {}

const V03_PNT_SHA="7f6b318e936cef9d2685347decf52b8951c34585dbd2ef1ebca05232a0c59a5a";
const V03_ANNEX_III_SHA="9716477f2b261a4fec8b1d459fb8aa62bd42840f8fa352b4b66b15c2669745f4";
const V03_ANNEX_VI_SHA="fa027508995beca7e39368f92e9d75ac2fdcf0dd7dffa57dfef8d59e6696db64";

async function readControlled(filePath:string,expectedSha:string,label:string){
 let buffer:Buffer;
 try{buffer=await readFile(path.resolve(process.cwd(),filePath));}
 catch{throw new ReturnTemplateUnavailableError(`Plantilla ${label} no instalada: ${filePath}.`);}
 const sha=createHash("sha256").update(buffer).digest("hex");
 if(sha!==expectedSha)throw new ReturnTemplateUnavailableError(`La plantilla ${label} no coincide con la copia auditada (SHA-256 inesperado).`);
 return buffer;
}

export async function loadReturnPntTemplate(versionCode="03",documentType:DocumentType=DocumentType.RETURN_ANNEX_III){
 const stored=await loadStoredTemplateAsset(QmsRecordType.RETURN,documentType,versionCode);
 if(stored)return stored;
 if(versionCode!=="03")throw new ReturnTemplateUnavailableError(`No hay plantilla controlada para Devoluciones versión ${versionCode}.`);

 if(documentType===DocumentType.RETURN_ANNEX_III){
   return readControlled(
     process.env.RETURN_ANNEX_III_TEMPLATE||"templates/returns/v03/A3 FORMULARIO DEV 03.docx",
     V03_ANNEX_III_SHA,
     "Anexo III Devoluciones v03",
   );
 }
 if(documentType===DocumentType.RETURN_ANNEX_VI){
   return readControlled(
     process.env.RETURN_ANNEX_VI_TEMPLATE||"templates/returns/v03/A6 LISTADO DEV 03.xlsx",
     V03_ANNEX_VI_SHA,
     "Anexo VI Devoluciones v03",
   );
 }
 if(documentType===DocumentType.RETURN_ANNEX_IV||documentType===DocumentType.RETURN_ANNEX_V){
   return readControlled(
     process.env.RETURN_PNT_TEMPLATE||"templates/returns/v03/GC-00.028.03 DEV PRODUCTO_CSM_CG.docx",
     V03_PNT_SHA,
     documentType===DocumentType.RETURN_ANNEX_IV?"Anexo IV Devoluciones v03":"Anexo V Devoluciones v03",
   );
 }
 throw new ReturnTemplateUnavailableError(`No hay plantilla controlada para ${documentType} en Devoluciones v03.`);
}
export const auditedReturnTemplateHashes={v03Pnt:V03_PNT_SHA,v03AnnexIII:V03_ANNEX_III_SHA,v03AnnexVI:V03_ANNEX_VI_SHA};
