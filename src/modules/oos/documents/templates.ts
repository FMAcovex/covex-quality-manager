import { DocumentType, QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { loadStoredTemplateAsset, TemplateAssetError } from "@/modules/configuration/template-assets";
import { oosAnnexRanges } from "@/modules/oos/documents/derive";

// D-088, OOS-3: the annexes are taken from the PNT GC-10/014/04 itself, with the
// annex header corrected by Calidad from 03 to 04. The binary is not versioned in Git.
export const oosPntV04Sha = "1dc7d0a7f0937f90b75f6ba94f3cdbaf0cfdd3b6558503c2f1658d1fd837ad40";
export const oosPntV04EffectiveFrom = "2025-06-15";

export type OosAnnexType = "OOS_ANNEX_III" | "OOS_ANNEX_IV" | "OOS_ANNEX_VI";

export class OosTemplateUnavailableError extends TemplateAssetError {}

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
  const inForce = issueDate ? candidates.filter((item) => item.effectiveFrom <= issueDate).at(-1) : candidates.at(-1);
  const selected = inForce ?? candidates[0];
  const buffer = selected ? await loadStoredTemplateAsset(QmsRecordType.OOS, DocumentType[documentType], selected.versionCode) : null;
  if (!selected || !buffer) {
    throw new OosTemplateUnavailableError(`Plantilla ${oosAnnexRanges[documentType].fileName} no instalada. Instálala con «pnpm templates:oos:install -- <PNT GC-10-014-04.docx>».`);
  }
  return { buffer, templateVersionId: selected.id, versionCode: selected.versionCode };
}
