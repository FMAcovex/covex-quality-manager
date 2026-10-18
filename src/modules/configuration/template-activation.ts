import "server-only";
import type { DocumentType, QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { loadStoredTemplateAsset } from "@/modules/configuration/template-assets";
import { checkTemplateActivation, type TemplateActivationCheck } from "@/modules/configuration/template-compatibility";

type TemplateRow = {
  id: string;
  module: QmsRecordType;
  documentType: DocumentType;
  versionCode: string;
  effectiveFrom: Date;
  isActive: boolean;
  checksum: string | null;
  fileName: string | null;
};

async function storedFile(row: Pick<TemplateRow, "module" | "documentType" | "versionCode">) {
  try {
    return await loadStoredTemplateAsset(row.module, row.documentType, row.versionCode);
  } catch {
    return undefined;
  }
}

/**
 * D-100: comprobación de una versión inactiva frente a la versión activa del mismo anexo.
 * Sin versión activa con archivo no hay referencia y la activación se permite como hasta ahora.
 */
export async function templateActivationCheck(candidate: TemplateRow): Promise<TemplateActivationCheck> {
  const active = await prisma.templateVersion.findFirst({
    where: { module: candidate.module, documentType: candidate.documentType, isActive: true, id: { not: candidate.id } },
    orderBy: { effectiveFrom: "desc" },
    select: { module: true, documentType: true, versionCode: true, fileName: true },
  });
  const candidateData = await storedFile(candidate);
  if (candidateData === undefined) return { status: "incompatible", referenceVersion: active?.versionCode ?? "—", differences: ["No se puede leer el archivo de esta versión o no coincide con su SHA-256 registrado."] };
  const referenceData = active ? await storedFile(active) : null;
  if (!candidateData) return active && referenceData ? { status: "incompatible", referenceVersion: active.versionCode, differences: ["Esta versión no tiene archivo de plantilla."] } : { status: "first" };
  return checkTemplateActivation({
    module: candidate.module,
    documentType: candidate.documentType,
    candidate: { versionCode: candidate.versionCode, data: candidateData, fileName: candidate.fileName, checksum: candidate.checksum },
    reference: active && referenceData ? { versionCode: active.versionCode, data: referenceData, fileName: active.fileName } : null,
  });
}

/** Comprobación de las versiones que se podrían activar (inactivas y posteriores a la activa). */
export async function pendingTemplateActivationChecks(templates: TemplateRow[]) {
  const checks = new Map<string, TemplateActivationCheck>();
  for (const template of templates) {
    if (template.isActive) continue;
    const active = templates.find((item) => item.isActive && item.module === template.module && item.documentType === template.documentType);
    if (active && template.effectiveFrom <= active.effectiveFrom) continue;
    checks.set(template.id, await templateActivationCheck(template));
  }
  return checks;
}

export const templateActivationBlocked = (check: TemplateActivationCheck) => check.status === "incompatible";
