import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType,QmsRecordType } from "@prisma/client";
import { loadStoredTemplateAsset } from "@/modules/configuration/template-assets";

export class ComplaintTemplateUnavailableError extends Error {}

const V02_PNT_SHA="f717ae907da9ed8b575f740fbf8b1536d4157174de5b7b4d240220910b570df4";
const V03_PNT_SHA="45965ecfbfb4cf496242349e74f42a01a598868b4a35eeac92b21a91a80ded59";
const V03_ANNEX_III_SHA="764e12076b407e9675f6291f03c8bab477f7850fbdb62fed8a904b4693b2bcde";
const V03_ANNEX_V_SHA="8d9a572fcfbc8bba05d99e3772aa0fec6fd3b716b6db2eaa5a056737d79d1d83";

async function readControlled(filePath:string, expectedSha:string, label:string){
 let buffer:Buffer;
 try{buffer=await readFile(path.resolve(process.cwd(),filePath));}
 catch{throw new ComplaintTemplateUnavailableError(`Plantilla ${label} no instalada: ${filePath}.`);}
 const sha=createHash("sha256").update(buffer).digest("hex");
 if(sha!==expectedSha)throw new ComplaintTemplateUnavailableError(`La plantilla ${label} no coincide con la copia auditada (SHA-256 inesperado).`);
 return buffer;
}

export async function loadComplaintPntTemplate(versionCode="02",documentType:DocumentType=DocumentType.COMPLAINT_ANNEX_III){
 const stored=await loadStoredTemplateAsset(QmsRecordType.COMPLAINT,documentType,versionCode);
 if(stored)return stored;

 if(versionCode==="02"){
   return readControlled(
     process.env.COMPLAINT_PNT_TEMPLATE||"templates/complaints/v02/GC-00-027-02 Reclamaciones.docx",
     V02_PNT_SHA,
     "Reclamaciones v02",
   );
 }
 if(versionCode!=="03")throw new ComplaintTemplateUnavailableError(`No hay plantilla controlada para Reclamaciones versión ${versionCode}.`);

 if(documentType===DocumentType.COMPLAINT_ANNEX_III){
   return readControlled(
     process.env.COMPLAINT_ANNEX_III_TEMPLATE||"templates/complaints/v03/Anexo III 02 INFORME RECLAMACION.docx",
     V03_ANNEX_III_SHA,
     "Anexo III Reclamaciones v03",
   );
 }
 if(documentType===DocumentType.COMPLAINT_ANNEX_V){
   return readControlled(
     process.env.COMPLAINT_ANNEX_V_TEMPLATE||"templates/complaints/v03/Anexo V 02 LISTADO DE RECLAMACIONES.xlsx",
     V03_ANNEX_V_SHA,
     "Anexo V Reclamaciones v03",
   );
 }
 if(documentType===DocumentType.COMPLAINT_ANNEX_IV){
   return readControlled(
     process.env.COMPLAINT_PNT_TEMPLATE_V03||"templates/complaints/v03/GC-00.027.03 Reclamaciones.docx",
     V03_PNT_SHA,
     "PNT Reclamaciones v03",
   );
 }
 throw new ComplaintTemplateUnavailableError(`No hay plantilla controlada para ${documentType} en Reclamaciones v03.`);
}

export const auditedComplaintTemplateHashes={
 v02Pnt:V02_PNT_SHA,
 v03Pnt:V03_PNT_SHA,
 v03AnnexIII:V03_ANNEX_III_SHA,
 v03AnnexV:V03_ANNEX_V_SHA,
};
