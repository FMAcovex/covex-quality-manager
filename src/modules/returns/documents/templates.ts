import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType,QmsRecordType } from "@prisma/client";
import { loadStoredTemplateAsset } from "@/modules/configuration/template-assets";

export class ReturnTemplateUnavailableError extends Error {}

const HASHES = {
  annexIII: "9716477f2b261a4fec8b1d459fb8aa62bd42840f8fa352b4b66b15c2669745f4",
  annexIV: "4c125e117f8b44f4605b4fde203cfb825ed3b5378e9858cda5591ecc84336460",
  annexV: "0b8a6e74a45c1f4a3cf216444449acd2cbdf54fc47276728c9cd7a48fb3a52ee",
  annexVI: "fa027508995beca7e39368f92e9d75ac2fdcf0dd7dffa57dfef8d59e6696db64",
} as const;

const config:Record<string,{fallback:string;hash:string;label:string}> = {
  [DocumentType.RETURN_ANNEX_III]: {
    fallback: "templates/returns/v03/A3 FORMULARIO DEV 03.docx",
    hash: HASHES.annexIII,
    label: "Anexo III",
  },
  [DocumentType.RETURN_ANNEX_IV]: {
    fallback: "templates/returns/v03/A4 PETICION DEV 03.docx",
    hash: HASHES.annexIV,
    label: "Anexo IV",
  },
  [DocumentType.RETURN_ANNEX_V]: {
    fallback: "templates/returns/v03/A5 DECLARACION CLIENTE 03.docx",
    hash: HASHES.annexV,
    label: "Anexo V",
  },
  [DocumentType.RETURN_ANNEX_VI]: {
    fallback: "templates/returns/v03/A6 LISTADO DEV 03.xlsx",
    hash: HASHES.annexVI,
    label: "Anexo VI",
  },
};

export async function loadReturnPntTemplate(
  versionCode="03",
  documentType:DocumentType=DocumentType.RETURN_ANNEX_III,
){
  const stored=await loadStoredTemplateAsset(QmsRecordType.RETURN,documentType,versionCode);
  if(stored)return stored;
  if(versionCode!=="03"){
    throw new ReturnTemplateUnavailableError(
      `No hay plantilla controlada para Devoluciones versión ${versionCode}.`,
    );
  }
  const entry=config[documentType];
  if(!entry)throw new ReturnTemplateUnavailableError("Tipo documental de Devoluciones no soportado.");
  const filePath=path.resolve(process.cwd(),entry.fallback);
  let buffer:Buffer;
  try{buffer=await readFile(filePath);}
  catch{
    throw new ReturnTemplateUnavailableError(
      `Plantilla ${entry.label} de Devoluciones no instalada. Cárgala desde Administración > Versiones y plantillas.`,
    );
  }
  const sha=createHash("sha256").update(buffer).digest("hex");
  if(sha!==entry.hash){
    throw new ReturnTemplateUnavailableError(
      `La plantilla ${entry.label} no coincide con la copia oficial de GC-00/028/03 (SHA-256 inesperado).`,
    );
  }
  return buffer;
}

export const auditedReturnTemplateHashes=HASHES;
