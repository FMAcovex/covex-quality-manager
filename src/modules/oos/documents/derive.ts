import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { extractWordBodyRange } from "@/lib/ooxml/xml";
import { getZipEntryText, readZip, updateZipEntry, writeZip } from "@/lib/ooxml/zip";
import type { OosAnnexType } from "@/modules/oos/documents/templates";

/** Body range of each annex in PNT GC-10/014/04: the first paragraph that names it, up to the next annex. */
export const oosAnnexRanges: Record<OosAnnexType, { start: string; end?: string; fileName: string }> = {
  OOS_ANNEX_III: { start: "Anexo III", end: "Anexo IV", fileName: "Anexo III OOS Fase I GC-10-014-04.docx" },
  OOS_ANNEX_IV: { start: "Anexo IV", end: "ANEXO V", fileName: "Anexo IV OOS Fase II GC-10-014-04.docx" },
  OOS_ANNEX_VI: { start: "ANEXO VI", fileName: "Anexo VI Listado general OOS GC-10-014-04.docx" },
};

export function deriveOosAnnex(pnt: Buffer, type: OosAnnexType) {
  const entries = readZip(pnt);
  const range = oosAnnexRanges[type];
  updateZipEntry(entries, "word/document.xml", extractWordBodyRange(getZipEntryText(entries, "word/document.xml"), range.start, range.end, "first"));
  sanitizeOfficeMetadata(entries);
  return writeZip(entries);
}
