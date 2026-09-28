import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType,QmsRecordType } from "@prisma/client";
import { loadStoredTemplateAsset, TemplateAssetError } from "@/modules/configuration/template-assets";

export class ComplaintTemplateUnavailableError extends TemplateAssetError {}

const LEGACY_V02_PNT_SHA="f717ae907da9ed8b575f740fbf8b1536d4157174de5b7b4d240220910b570df4";
const V03_ANNEX_III_SHA="764e12076b407e9675f6291f03c8bab477f7850fbdb62fed8a904b4693b2bcde";
const V03_ANNEX_V_SHA="8d9a572fcfbc8bba05d99e3772aa0fec6fd3b716b6db2eaa5a056737d79d1d83";

async function readChecked(filePath:string,expectedSha:string,label:string){
 let buffer:Buffer;
 try{buffer=await readFile(path.resolve(process.cwd(),filePath));}
 catch{throw new ComplaintTemplateUnavailableError(`Plantilla ${label} no instalada: ${filePath}. Cárgala desde Administración → Versiones y plantillas.`);}
 const sha=createHash("sha256").update(buffer).digest("hex");
 if(sha!==expectedSha)throw new ComplaintTemplateUnavailableError(`La plantilla ${label} no coincide con la versión auditada (SHA-256 inesperado).`);
 return buffer;
}

export async function loadComplaintPntTemplate(versionCode="03",documentType:DocumentType=DocumentType.COMPLAINT_ANNEX_III){
 const stored=await loadStoredTemplateAsset(QmsRecordType.COMPLAINT,documentType,versionCode);
 if(stored)return stored;

 if(versionCode==="03"){
  if(documentType===DocumentType.COMPLAINT_ANNEX_III){
   return readChecked("templates/complaints/v03/Anexo III Informe Reclamacion 03.docx",V03_ANNEX_III_SHA,"Anexo III Reclamaciones v03");
  }
  if(documentType===DocumentType.COMPLAINT_ANNEX_V){
   return readChecked("templates/complaints/v03/Anexo V Listado Reclamaciones 03.xlsx",V03_ANNEX_V_SHA,"Anexo V Reclamaciones v03");
  }
  throw new ComplaintTemplateUnavailableError("GC-00/027/03 no requiere generar desde la app el anexo de respuesta al cliente.");
 }

 if(versionCode==="02"){
  const filePath=process.env.COMPLAINT_PNT_TEMPLATE||"templates/complaints/v02/GC-00-027-02 Reclamaciones.docx";
  return readChecked(filePath,LEGACY_V02_PNT_SHA,"Reclamaciones v02");
 }
 throw new ComplaintTemplateUnavailableError(`No hay plantilla controlada para Reclamaciones versión ${versionCode}.`);
}

export const auditedComplaintTemplateHashes={legacyV02:LEGACY_V02_PNT_SHA,annexIIIV03:V03_ANNEX_III_SHA,annexVV03:V03_ANNEX_V_SHA};
