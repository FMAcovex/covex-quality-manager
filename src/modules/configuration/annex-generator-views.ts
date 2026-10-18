import type { DocumentType } from "@prisma/client";
import { extractWordBodyRange } from "@/lib/ooxml/xml";
import { auditExternalPlanXml } from "@/modules/audits/documents/generators";

/**
 * Qué parte de la plantilla usa cada generador y con qué mapeo (D-100). Lo usan los propios
 * generadores y la comprobación de compatibilidad de una versión nueva, para que ambos vean
 * exactamente el mismo contenido.
 *
 * - `mapping`: los generadores con un mapeo distinto según la versión (Reclamaciones III y IV,
 *   Devoluciones III–V) rellenan la v03 de una forma y el resto de versiones de otra.
 * - `range`: el anexo se recorta del PNT completo antes de rellenarlo.
 */
export type AnnexGeneratorView = { mapping: string; range?: { start: string; end?: string } };

const returnRanges: Partial<Record<DocumentType, { start: string; end: string }>> = {
  RETURN_ANNEX_III: { start: "Anexo III:", end: "Anexo IV:" },
  RETURN_ANNEX_IV: { start: "Anexo IV:", end: "Anexo V:" },
  RETURN_ANNEX_V: { start: "Anexo V:", end: "Anexo VI:" },
};

export function annexGeneratorView(documentType: DocumentType, versionCode: string): AnnexGeneratorView {
  const returnRange = returnRanges[documentType];
  if (returnRange) return versionCode === "03" ? { mapping: "v03" } : { mapping: "PNT completo", range: returnRange };
  if (documentType === "COMPLAINT_ANNEX_III") {
    return versionCode === "03" ? { mapping: "v03" } : { mapping: "PNT v02", range: { start: "Anexo III", end: "Anexo IV:" } };
  }
  if (documentType === "COMPLAINT_ANNEX_IV") {
    return versionCode === "03" ? { mapping: "v03" } : { mapping: "PNT v02", range: { start: "Anexo IV:", end: "Anexo V:" } };
  }
  if (documentType === "AUDIT_EXTERNAL_PLAN") return { mapping: "único", range: { start: "Anexo IV: Plan de Auditoría" } };
  return { mapping: "único" };
}

/** Cuerpo del documento tal como lo rellena el generador (recortado del PNT si procede). */
export function annexGeneratorXml(documentType: DocumentType, versionCode: string, documentXml: string) {
  if (documentType === "AUDIT_EXTERNAL_PLAN") return auditExternalPlanXml(documentXml);
  const { range } = annexGeneratorView(documentType, versionCode);
  return range ? extractWordBodyRange(documentXml, range.start, range.end, "last") : documentXml;
}
