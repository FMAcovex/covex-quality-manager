import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType,QmsRecordType } from "@prisma/client";
import { loadStoredTemplateAsset } from "@/modules/configuration/template-assets";

export class ReturnTemplateUnavailableError extends Error {}

const HASHES={
 annexIII:"9716477f2b261a4fec8b1d459fb8aa62bd42840f8fa352b4b66b15c2669745f4",
 annexVI:"fa027508995beca7e39368f92e9d75ac2fdcf0dd7dffa57dfef8d59e6696db64",
 pnt:"7f6b318e936cef9d2685347decf52b8951c34585dbd2ef1ebca05232a0c59a5a",
} as const;

async function loadFile(configured:string|undefined,fallback:string,expected:string,label:string){
 const filePath=path.resolve(process.cwd(),configured||fallback);
 let buffer:Buffer;
 try{buffer=await readFile(filePath);}catch{
  throw new ReturnTemplateUnavailableError(`Plantilla ${label} no instalada: ${filePath}. Cárgala desde Administración o instala las plantillas GC-00/028/03.`);
 }
 const sha=createHash("sha256").update(buffer).digest("hex");
 if(sha!==expected)throw new ReturnTemplateUnavailableError(`La plantilla ${label} no coincide con la copia controlada de GC-00/028/03.`);
 return buffer;
}
function requireV03(versionCode:string,label:string){
 if(versionCode!=="03")throw new ReturnTemplateUnavailableError(`No hay plantilla controlada para ${label} versión ${versionCode}.`);
}

export async function loadReturnTemplate(versionCode="03",documentType:DocumentType=DocumentType.RETURN_ANNEX_III){
 requireV03(versionCode,String(documentType));
 const stored=await loadStoredTemplateAsset(QmsRecordType.RETURN,documentType,versionCode);
 if(stored)return stored;

 if(documentType===DocumentType.RETURN_ANNEX_III){
  return loadFile(process.env.RETURN_ANNEX_III_TEMPLATE,"templates/returns/v03/Anexo III FORMULARIO DEV 03.docx",HASHES.annexIII,"Anexo III");
 }
 if(documentType===DocumentType.RETURN_ANNEX_VI){
  return loadFile(process.env.RETURN_ANNEX_VI_TEMPLATE,"templates/returns/v03/Anexo VI LISTADO DEV 03.xlsx",HASHES.annexVI,"Anexo VI");
 }
 if(documentType===DocumentType.RETURN_ANNEX_IV||documentType===DocumentType.RETURN_ANNEX_V){
  return loadFile(process.env.RETURN_PNT_TEMPLATE,"templates/returns/v03/GC-00.028.03 DEV PRODUCTO.docx",HASHES.pnt,"PNT GC-00/028/03");
 }
 throw new ReturnTemplateUnavailableError("Tipo documental de Devoluciones no soportado.");
}

export const auditedReturnTemplateHashes=HASHES;
