import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType,QmsRecordType } from "@prisma/client";
import { loadStoredTemplateAsset } from "@/modules/configuration/template-assets";

export class ComplaintTemplateUnavailableError extends Error {}

const HASHES = {
  annexIII: "764e12076b407e9675f6291f03c8bab477f7850fbdb62fed8a904b4693b2bcde",
  annexV: "8d9a572fcfbc8bba05d99e3772aa0fec6fd3b716b6db2eaa5a056737d79d1d83",
  pnt: "45965ecfbfb4cf496242349e74f42a01a598868b4a35eeac92b21a91a80ded59",
} as const;

async function loadFile(configured:string|undefined,fallback:string,expectedSha:string,label:string){
 const filePath=path.resolve(process.cwd(),configured||fallback);
 let buffer:Buffer;
 try{buffer=await readFile(filePath);}catch{
  throw new ComplaintTemplateUnavailableError(`Plantilla ${label} no instalada: ${filePath}. Cárgala desde Administración o ejecuta el instalador de Reclamaciones v03.`);
 }
 const sha=createHash("sha256").update(buffer).digest("hex");
 if(sha!==expectedSha)throw new ComplaintTemplateUnavailableError(`La plantilla ${label} no coincide con la copia controlada preparada para GC-00/027/03.`);
 return buffer;
}

function requireV03(versionCode:string,label:string){
 if(versionCode!=="03")throw new ComplaintTemplateUnavailableError(`No hay plantilla controlada preparada para ${label} versión ${versionCode}.`);
}

export async function loadComplaintAnnexIIITemplate(versionCode="03"){
 const stored=await loadStoredTemplateAsset(QmsRecordType.COMPLAINT,DocumentType.COMPLAINT_ANNEX_III,versionCode);
 if(stored)return stored;
 requireV03(versionCode,"Anexo III");
 return loadFile(process.env.COMPLAINT_ANNEX_III_TEMPLATE,"templates/complaints/v03/Anexo III INFORME RECLAMACION 03.docx",HASHES.annexIII,"Anexo III");
}

export async function loadComplaintAnnexVTemplate(versionCode="03"){
 const stored=await loadStoredTemplateAsset(QmsRecordType.COMPLAINT,DocumentType.COMPLAINT_ANNEX_V,versionCode);
 if(stored)return stored;
 requireV03(versionCode,"Anexo V");
 return loadFile(process.env.COMPLAINT_ANNEX_V_TEMPLATE,"templates/complaints/v03/Anexo V LISTADO DE RECLAMACIONES 03.xlsx",HASHES.annexV,"Anexo V");
}

export async function loadComplaintPntV03(){
 return loadFile(process.env.COMPLAINT_PNT_TEMPLATE,"templates/complaints/v03/GC-00.027.03 Reclamaciones.docx",HASHES.pnt,"PNT GC-00/027/03");
}

export const auditedComplaintTemplateHashes=HASHES;
