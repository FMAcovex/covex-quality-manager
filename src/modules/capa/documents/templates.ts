import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType,QmsRecordType } from "@prisma/client";
import { loadStoredTemplateAsset, TemplateAssetError } from "@/modules/configuration/template-assets";

export class CapaTemplateUnavailableError extends TemplateAssetError {}

const CAPA_ANNEX_III_SHA256 = "73c3d57ca5ae6f4e9644a4f1cbe416992de6b367973ba98cd67f7f0bd1fea540";
const CAPA_ANNEX_IV_SHA256 = "47f3d757c2c00cbcbdba9e4f7daf2cb4d804ce522a5e1145ab5260efd8147ac3";

async function loadTemplate(
  configured: string | undefined,
  fallback: string,
  expectedSha: string,
) {
  const filePath = path.resolve(process.cwd(), configured || fallback);
  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    throw new CapaTemplateUnavailableError(
      `Plantilla CAPA no instalada: ${filePath}. Ejecuta pnpm templates:capa:install con los anexos oficiales v05.`,
    );
  }
  const sha = createHash("sha256").update(buffer).digest("hex");
  if (sha !== expectedSha) {
    throw new CapaTemplateUnavailableError(
      `La plantilla ${path.basename(filePath)} no coincide con la versión v05 auditada (SHA-256 inesperado).`,
    );
  }
  return buffer;
}

function requireV05(versionCode: string, documentName: string) {
  if (versionCode !== "05") {
    throw new CapaTemplateUnavailableError(
      `No hay una plantilla controlada instalada para ${documentName} versión ${versionCode}.`,
    );
  }
}

export async function loadCapaAnnexIIITemplate(versionCode = "05") {
  const stored=await loadStoredTemplateAsset(QmsRecordType.CAPA,DocumentType.CAPA_ANNEX_III,versionCode);
  if(stored)return stored;
  requireV05(versionCode, "Anexo III CAPA");
  return loadTemplate(
    process.env.CAPA_ANNEX_III_TEMPLATE,
    "templates/capa/v05/Anexo III INFORME CAPA 05.docx",
    CAPA_ANNEX_III_SHA256,
  );
}

export async function loadCapaAnnexIVTemplate(versionCode = "05") {
  const stored=await loadStoredTemplateAsset(QmsRecordType.CAPA,DocumentType.CAPA_ANNEX_IV,versionCode);
  if(stored)return stored;
  requireV05(versionCode, "Anexo IV CAPA");
  return loadTemplate(
    process.env.CAPA_ANNEX_IV_TEMPLATE,
    "templates/capa/v05/Anexo IV LISTADO CAPA 05 oficial.xlsx",
    CAPA_ANNEX_IV_SHA256,
  );
}

export const auditedCapaTemplateHashes = {
  annexIII: CAPA_ANNEX_III_SHA256,
  annexIV: CAPA_ANNEX_IV_SHA256,
};
