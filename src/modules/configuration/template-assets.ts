import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
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
    select:{fileData:true,fileName:true,filePath:true,checksum:true},
  });
  if(!version)return null;
  let buffer:Buffer;
  if(version.fileData){
    buffer=Buffer.from(version.fileData);
  }else if(version.filePath){
    try{buffer=await readFile(path.resolve(process.cwd(),version.filePath));}
    catch{throw new StoredTemplateIntegrityError(`No se puede leer la plantilla registrada en ${version.filePath}.`);}
  }else{
    return null;
  }
  const sha=createHash("sha256").update(buffer).digest("hex");
  if(version.checksum&&sha.toLowerCase()!==version.checksum.toLowerCase()){
    throw new StoredTemplateIntegrityError(
      `La plantilla almacenada ${version.fileName??versionCode} no coincide con su SHA-256 registrado.`,
    );
  }
  return buffer;
}
