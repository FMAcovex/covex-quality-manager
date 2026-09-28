import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType,QmsRecordType } from "@prisma/client";
import { loadStoredTemplateAsset, TemplateAssetError } from "@/modules/configuration/template-assets";

export class ChangeControlTemplateUnavailableError extends TemplateAssetError {}

const HASHES = {
  annexIII: "a436d4aa732209e1aeb9620d5442a154a68899f875d1aa5d0dc437edd751a49f",
  annexIV: "742b1de11e0e0dece4e9c65c97613c112325189e183b9cb02c56ca82cd06cc60",
  annexV: "3012e81b0172c77c59c9c97514d788e10eb332a73e4490b9c0a1c87afa6ad1e4",
  annexVII: "b65671cdd652f104f4038c65e07c025b5c7374dee4b683d74fbeef55f12bc8eb",
} as const;

async function loadTemplate(
  configured: string | undefined,
  fallback: string,
  expectedSha: string,
  label: string,
) {
  const filePath = path.resolve(process.cwd(), configured || fallback);
  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    throw new ChangeControlTemplateUnavailableError(
      `Plantilla ${label} no instalada: ${filePath}. Ejecuta pnpm templates:changes:install con los anexos oficiales de GC-00/003/03.`,
    );
  }
  const sha = createHash("sha256").update(buffer).digest("hex");
  if (sha !== expectedSha) {
    throw new ChangeControlTemplateUnavailableError(
      `La plantilla ${label} no coincide con la versión auditada de GC-00/003/03 (SHA-256 inesperado).`,
    );
  }
  return buffer;
}

function requireV03(versionCode: string, label: string) {
  if (versionCode !== "03") {
    throw new ChangeControlTemplateUnavailableError(
      `No hay una plantilla controlada instalada para ${label} versión ${versionCode}.`,
    );
  }
}

export async function loadChangeAnnexIIITemplate(versionCode = "03") {
  const stored=await loadStoredTemplateAsset(QmsRecordType.CHANGE_CONTROL,DocumentType.CHANGE_ANNEX_III,versionCode);
  if(stored)return stored;
  requireV03(versionCode, "Anexo III");
  return loadTemplate(
    process.env.CHANGE_ANNEX_III_TEMPLATE,
    "templates/change-control/v03/Anexo III Solicitud GC-00-003-03.docx",
    HASHES.annexIII,
    "Anexo III",
  );
}

export async function loadChangeAnnexIVTemplate(versionCode = "03") {
  const stored=await loadStoredTemplateAsset(QmsRecordType.CHANGE_CONTROL,DocumentType.CHANGE_ANNEX_IV,versionCode);
  if(stored)return stored;
  requireV03(versionCode, "Anexo IV");
  return loadTemplate(
    process.env.CHANGE_ANNEX_IV_TEMPLATE,
    "templates/change-control/v03/Anexo IV Dictamen GC-00-003-03.docx",
    HASHES.annexIV,
    "Anexo IV",
  );
}

export async function loadChangeAnnexVTemplate(versionCode = "03") {
  const stored=await loadStoredTemplateAsset(QmsRecordType.CHANGE_CONTROL,DocumentType.CHANGE_ANNEX_V,versionCode);
  if(stored)return stored;
  requireV03(versionCode, "Anexo V");
  return loadTemplate(
    process.env.CHANGE_ANNEX_V_TEMPLATE,
    "templates/change-control/v03/Anexo V Seguimiento GC-00-003-03.docx",
    HASHES.annexV,
    "Anexo V",
  );
}

export async function loadChangeAnnexVIITemplate(versionCode = "03") {
  const stored=await loadStoredTemplateAsset(QmsRecordType.CHANGE_CONTROL,DocumentType.CHANGE_ANNEX_VII,versionCode);
  if(stored)return stored;
  requireV03(versionCode, "Anexo VII");
  return loadTemplate(
    process.env.CHANGE_ANNEX_VII_TEMPLATE,
    "templates/change-control/v03/Anexo VII_PNT GC003.03_Listado seguimiento .xlsx",
    HASHES.annexVII,
    "Anexo VII",
  );
}

export const auditedChangeControlTemplateHashes = HASHES;
