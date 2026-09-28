import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType, QmsRecordType } from "@prisma/client";
import { loadStoredTemplateAsset } from "@/modules/configuration/template-assets";

export class ComplaintTemplateUnavailableError extends Error {}

const ANNEX_III_SHA = "764e12076b407e9675f6291f03c8bab477f7850fbdb62fed8a904b4693b2bcde";
const ANNEX_V_SHA = "8d9a572fcfbc8bba05d99e3772aa0fec6fd3b716b6db2eaa5a056737d79d1d83";

async function fallback(file: string, expected: string) {
  const filePath = path.resolve(process.cwd(), file);
  let buffer: Buffer;
  try { buffer = await readFile(filePath); }
  catch { throw new ComplaintTemplateUnavailableError(`Plantilla de Reclamaciones no instalada: ${filePath}.`); }
  const sha = createHash("sha256").update(buffer).digest("hex");
  if (sha !== expected) throw new ComplaintTemplateUnavailableError("La plantilla de Reclamaciones no coincide con la revisión v03 auditada.");
  return buffer;
}

export async function loadComplaintTemplate(documentType: DocumentType, versionCode = "03") {
  const stored = await loadStoredTemplateAsset(QmsRecordType.COMPLAINT, documentType, versionCode);
  if (stored) return stored;
  if (versionCode !== "03") throw new ComplaintTemplateUnavailableError(`No hay plantilla controlada para Reclamaciones versión ${versionCode}.`);
  if (documentType === DocumentType.COMPLAINT_ANNEX_III) {
    return fallback("templates/complaints/v03/Anexo III INFORME RECLAMACION.docx", ANNEX_III_SHA);
  }
  if (documentType === DocumentType.COMPLAINT_ANNEX_V) {
    return fallback("templates/complaints/v03/Anexo V LISTADO DE RECLAMACIONES.xlsx", ANNEX_V_SHA);
  }
  throw new ComplaintTemplateUnavailableError("Ese documento de Reclamaciones no se genera desde la aplicación.");
}

export const auditedComplaintTemplateHashes = { annexIII: ANNEX_III_SHA, annexV: ANNEX_V_SHA };
