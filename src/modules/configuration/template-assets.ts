import "server-only";

import { createHash } from "node:crypto";
import { DocumentType,QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";

export class StoredTemplateIntegrityError extends Error {}

export async function loadStoredTemplateAsset(
  module:QmsRecordType,
  documentType:DocumentType,
  versionCode:string,
){
  const version=await prisma.templateVersion.findUnique({
    where:{module_documentType_versionCode:{module,documentType,versionCode}},
    select:{fileData:true,fileName:true,checksum:true},
  });
  if(!version?.fileData)return null;
  const buffer=Buffer.from(version.fileData);
  const sha=createHash("sha256").update(buffer).digest("hex");
  if(version.checksum&&sha.toLowerCase()!==version.checksum.toLowerCase()){
    throw new StoredTemplateIntegrityError(
      `La plantilla almacenada ${version.fileName??versionCode} no coincide con su SHA-256 registrado.`,
    );
  }
  return buffer;
}
