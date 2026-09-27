import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType,QmsRecordType } from "@prisma/client";
import { loadStoredTemplateAsset } from "@/modules/configuration/template-assets";

export class ComplaintTemplateUnavailableError extends Error {}
const SHA="f717ae907da9ed8b575f740fbf8b1536d4157174de5b7b4d240220910b570df4";

export async function loadComplaintPntTemplate(versionCode="02",documentType:DocumentType=DocumentType.COMPLAINT_ANNEX_III){
 const stored=await loadStoredTemplateAsset(QmsRecordType.COMPLAINT,documentType,versionCode);
 if(stored)return stored;
 if(versionCode!=="02")throw new ComplaintTemplateUnavailableError(`No hay plantilla controlada para Reclamaciones versión ${versionCode}.`);
 const filePath=path.resolve(process.cwd(),process.env.COMPLAINT_PNT_TEMPLATE||"templates/complaints/v02/GC-00-027-02 Reclamaciones.docx");
 let buffer:Buffer;
 try{buffer=await readFile(filePath);}catch{throw new ComplaintTemplateUnavailableError(`Plantilla de Reclamaciones no instalada: ${filePath}. Ejecuta pnpm templates:complaints:install.`);}
 const sha=createHash("sha256").update(buffer).digest("hex");
 if(sha!==SHA)throw new ComplaintTemplateUnavailableError("La plantilla de Reclamaciones no coincide con GC-00/027/02 auditado.");
 return buffer;
}
export const auditedComplaintTemplateHash=SHA;
