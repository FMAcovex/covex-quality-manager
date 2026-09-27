import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType,QmsRecordType } from "@prisma/client";
import { loadStoredTemplateAsset } from "@/modules/configuration/template-assets";

export class ReturnTemplateUnavailableError extends Error {}
const SHA="191c0e838f06d465bd820450b9130e1209c14fc9cb97559e8ec567819ba07f9a";

export async function loadReturnPntTemplate(versionCode="03",documentType:DocumentType=DocumentType.RETURN_ANNEX_III){
 const stored=await loadStoredTemplateAsset(QmsRecordType.RETURN,documentType,versionCode);
 if(stored)return stored;
 if(versionCode!=="03")throw new ReturnTemplateUnavailableError(`No hay plantilla controlada para Devoluciones versión ${versionCode}.`);
 const filePath=path.resolve(process.cwd(),process.env.RETURN_PNT_TEMPLATE||"templates/returns/v03/GC-00-028-03 Devoluciones.docx");
 let buffer:Buffer;
 try{buffer=await readFile(filePath);}catch{throw new ReturnTemplateUnavailableError(`Plantilla de Devoluciones no instalada: ${filePath}. Ejecuta pnpm templates:returns:install.`);}
 const sha=createHash("sha256").update(buffer).digest("hex");
 if(sha!==SHA)throw new ReturnTemplateUnavailableError("La plantilla de Devoluciones no coincide con GC-00/028/03 auditado.");
 return buffer;
}
export const auditedReturnTemplateHash=SHA;
