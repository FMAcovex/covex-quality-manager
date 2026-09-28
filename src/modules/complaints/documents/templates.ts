import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType,QmsRecordType } from "@prisma/client";
import { loadStoredTemplateAsset } from "@/modules/configuration/template-assets";

export class ComplaintTemplateUnavailableError extends Error {}

const HASHES = {
  annexIII: "31cff8c72182ef70a4774ad388d377b71d460fde5b007dd1e32c5d6f46e3d3f5",
  annexIV: "84fff57e53ffa9f1dc273c2116f76799bf9772ee3d4c446873be8e259834fa54",
  annexV: "db57f9349b4c302538c09fbaa48f22afc8e7231a49b9cfec5f626a93afff0010",
} as const;

const config:Record<string,{fallback:string;hash:string;label:string}> = {
  [DocumentType.COMPLAINT_ANNEX_III]: {
    fallback: "templates/complaints/v02/Anexo III 02 INFORME RECLAMACION.docx",
    hash: HASHES.annexIII,
    label: "Anexo III",
  },
  [DocumentType.COMPLAINT_ANNEX_IV]: {
    fallback: "templates/complaints/v02/Anexo IV 02 RECLAMACION RESPUESTA.docx",
    hash: HASHES.annexIV,
    label: "Anexo IV",
  },
  [DocumentType.COMPLAINT_ANNEX_V]: {
    fallback: "templates/complaints/v02/Anexo V 02 LISTADO DE RECLAMACIONES.xlsx",
    hash: HASHES.annexV,
    label: "Anexo V",
  },
};

export async function loadComplaintPntTemplate(
  versionCode="02",
  documentType:DocumentType=DocumentType.COMPLAINT_ANNEX_III,
){
  const stored=await loadStoredTemplateAsset(QmsRecordType.COMPLAINT,documentType,versionCode);
  if(stored)return stored;
  if(versionCode!=="02") {
    throw new ComplaintTemplateUnavailableError(
      `No hay plantilla controlada para Reclamaciones versión ${versionCode}.`,
    );
  }
  const entry=config[documentType];
  if(!entry)throw new ComplaintTemplateUnavailableError("Tipo documental de Reclamaciones no soportado.");
  const filePath=path.resolve(process.cwd(),entry.fallback);
  let buffer:Buffer;
  try{buffer=await readFile(filePath);}
  catch{
    throw new ComplaintTemplateUnavailableError(
      `Plantilla ${entry.label} de Reclamaciones no instalada. Cárgala desde Administración > Versiones y plantillas.`,
    );
  }
  const sha=createHash("sha256").update(buffer).digest("hex");
  if(sha!==entry.hash){
    throw new ComplaintTemplateUnavailableError(
      `La plantilla ${entry.label} no coincide con la copia oficial de GC-00/027/02 (SHA-256 inesperado).`,
    );
  }
  return buffer;
}

export const auditedComplaintTemplateHashes=HASHES;
