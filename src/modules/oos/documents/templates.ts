import { DocumentType, QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { loadStoredTemplateAsset, TemplateAssetError, templateInstallHint } from "@/modules/configuration/template-assets";
import { oosAnnexRanges } from "@/modules/oos/documents/derive";
import { templateAssetReady } from "@/modules/configuration/template-asset-ready";

// D-088, OOS-3: the annexes are taken from the PNT GC-10/014/04 itself, with the
// annex header corrected by Calidad from 03 to 04 (catálogo de plantillas, D-099).

export type OosAnnexType = "OOS_ANNEX_III" | "OOS_ANNEX_IV" | "OOS_ANNEX_VI";

export class OosTemplateUnavailableError extends TemplateAssetError {}

/** Plantilla vigente en la fecha de emisión del OOS (o la más reciente sin fecha); si ninguna lo estaba, la primera. */
export function pickOosTemplate<T extends { effectiveFrom: Date }>(candidates: T[], issueDate: Date | null): T | undefined {
  const inForce = issueDate ? candidates.filter((item) => item.effectiveFrom <= issueDate).at(-1) : candidates.at(-1);
  return inForce ?? candidates[0];
}

/** TPL1: si la plantilla que usará la generación de este OOS tiene su archivo instalado. */
export async function oosTemplateReady(documentType: OosAnnexType, issueDate: Date | null) {
  const candidates = await prisma.templateVersion.findMany({
    where: { module: QmsRecordType.OOS, documentType: DocumentType[documentType] },
    select: { effectiveFrom: true, fileName: true, filePath: true, checksum: true },
    orderBy: { effectiveFrom: "asc" },
  });
  return templateAssetReady(pickOosTemplate(candidates, issueDate));
}

/**
 * Template in force on the OOS issue date, so a record keeps the PNT revision it
 * was created under after a new revision is installed (AGENTS.md).
 */
export async function loadOosTemplate(documentType: OosAnnexType, issueDate: Date | null) {
  const candidates = await prisma.templateVersion.findMany({
    where: { module: QmsRecordType.OOS, documentType: DocumentType[documentType] },
    select: { id: true, versionCode: true, effectiveFrom: true },
    orderBy: { effectiveFrom: "asc" },
  });
  const selected = pickOosTemplate(candidates, issueDate);
  const buffer = selected ? await loadStoredTemplateAsset(QmsRecordType.OOS, DocumentType[documentType], selected.versionCode) : null;
  if (!selected || !buffer) {
    throw new OosTemplateUnavailableError(`Plantilla ${oosAnnexRanges[documentType].fileName} no instalada. ${templateInstallHint}`);
  }
  return { buffer, templateVersionId: selected.id, versionCode: selected.versionCode };
}
