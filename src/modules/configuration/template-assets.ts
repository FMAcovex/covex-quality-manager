import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType,QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";

export class TemplateAssetError extends Error {}
export class StoredTemplateIntegrityError extends TemplateAssetError {}

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

/** Instrucción común cuando falta una plantilla controlada (D-099). */
export const templateInstallHint = "Instálala en Configuración → Versiones → «Instalar plantillas» (o con «pnpm templates:install -- <carpeta de plantillas>»).";

/**
 * Plantilla guardada para esa versión, verificada contra su SHA-256 registrado. Las
 * plantillas se instalan siempre en la base de datos; no hay copia de respaldo en disco.
 */
export async function requireStoredTemplate(
  module: QmsRecordType,
  documentType: DocumentType,
  versionCode: string,
  label: string,
  ErrorType: new (message: string) => TemplateAssetError = TemplateAssetError,
) {
  const stored = await loadStoredTemplateAsset(module, documentType, versionCode);
  if (!stored) throw new ErrorType(`Plantilla no instalada: ${label} versión ${versionCode}. ${templateInstallHint}`);
  return stored;
}
