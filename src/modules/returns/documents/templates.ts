import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType,QmsRecordType } from "@prisma/client";
import { loadStoredTemplateAsset } from "@/modules/configuration/template-assets";

export class ReturnTemplateUnavailableError extends Error {}

const HASHES={
  annexIII:"9716477f2b261a4fec8b1d459fb8aa62bd42840f8fa352b4b66b15c2669745f4",
  pnt:"7f6b318e936cef9d2685347decf52b8951c34585dbd2ef1ebca05232a0c59a5a",
  annexVI:"fa027508995beca7e39368f92e9d75ac2fdcf0dd7dffa57dfef8d59e6696db64",
};

async function fallback(file:string,expected:string){
 const filePath=path.resolve(process.cwd(),file);let buffer:Buffer;
 try{buffer=await readFile(filePath);}catch{throw new ReturnTemplateUnavailableError(`Plantilla de Devoluciones no instalada: ${filePath}.`);}
 const sha=createHash("sha256").update(buffer).digest("hex");
 if(sha!==expected)throw new ReturnTemplateUnavailableError("La plantilla de Devoluciones no coincide con GC-00/028/03 auditado.");
 return buffer;
}

export async function loadReturnTemplate(versionCode="03",documentType:DocumentType=DocumentType.RETURN_ANNEX_III){
 const stored=await loadStoredTemplateAsset(QmsRecordType.RETURN,documentType,versionCode);
 if(stored)return stored;
 if(versionCode!=="03")throw new ReturnTemplateUnavailableError(`No hay plantilla controlada para Devoluciones versión ${versionCode}.`);
 if(documentType===DocumentType.RETURN_ANNEX_III)return fallback("templates/returns/v03/A3 FORMULARIO DEV 03.docx",HASHES.annexIII);
 if(documentType===DocumentType.RETURN_ANNEX_IV||documentType===DocumentType.RETURN_ANNEX_V)return fallback("templates/returns/v03/GC-00.028.03 DEV PRODUCTO_CSM_CG.docx",HASHES.pnt);
 if(documentType===DocumentType.RETURN_ANNEX_VI)return fallback("templates/returns/v03/A6 LISTADO DEV 03.xlsx",HASHES.annexVI);
 throw new ReturnTemplateUnavailableError("Plantilla de Devoluciones no soportada.");
}
export const auditedReturnTemplateHashes=HASHES;
