import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType,QmsRecordType } from "@prisma/client";
import { loadStoredTemplateAsset } from "@/modules/configuration/template-assets";

export class TemplateUnavailableError extends Error {}

const ANNEX_III_SHA256 = "8639c29198101a73253f0681620c89a3e2848b335d2a4be61b946f9b7a353d43";
const ANNEX_V_SHA256 = "1f92410bc94e2037fe632450ce766b3ce5d44c4f55b8868056bad73c882c03f2";

async function loadTemplate(configured: string | undefined, fallback: string, expectedSha: string) {
  const filePath = path.resolve(process.cwd(), configured || fallback);
  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    throw new TemplateUnavailableError(
      `Plantilla no instalada: ${filePath}. Ejecuta pnpm templates:install con los anexos oficiales v06.`,
    );
  }
  const sha = createHash("sha256").update(buffer).digest("hex");
  if (sha !== expectedSha) {
    throw new TemplateUnavailableError(
      `La plantilla ${path.basename(filePath)} no coincide con la versión v06 auditada (SHA-256 inesperado).`,
    );
  }
  return buffer;
}

function requireV06(versionCode: string, documentName: string) {
  if (versionCode !== "06") {
    throw new TemplateUnavailableError(
      `No hay una plantilla controlada instalada para ${documentName} versión ${versionCode}.`,
    );
  }
}

export async function loadAnnexIIITemplate(versionCode = "06") {
  const stored=await loadStoredTemplateAsset(QmsRecordType.DEVIATION,DocumentType.DEVIATION_ANNEX_III,versionCode);
  if(stored)return stored;
  requireV06(versionCode, "Anexo III");
  return loadTemplate(
    process.env.DEVIATION_ANNEX_III_TEMPLATE,
    "templates/deviations/v06/Anexo III Informe Desviaciones 06.docx",
    ANNEX_III_SHA256,
  );
}

export async function loadAnnexVTemplate(versionCode = "06") {
  const stored=await loadStoredTemplateAsset(QmsRecordType.DEVIATION,DocumentType.DEVIATION_ANNEX_V,versionCode);
  if(stored)return stored;
  requireV06(versionCode, "Anexo V");
  return loadTemplate(
    process.env.DEVIATION_ANNEX_V_TEMPLATE,
    "templates/deviations/v06/Anexo V.xlsx",
    ANNEX_V_SHA256,
  );
}

export const auditedTemplateHashes = {
  annexIII: ANNEX_III_SHA256,
  annexV: ANNEX_V_SHA256,
};
