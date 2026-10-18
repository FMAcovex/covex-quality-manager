import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { extractWordBodyRange } from "@/lib/ooxml/xml";
import { getZipEntryText, readZip, updateZipEntry, writeZip } from "@/lib/ooxml/zip";
import type { OosAnnexType } from "@/modules/oos/documents/templates";

/**
 * Body range of each annex in PNT GC-10/014/04, as Calidad uses them: from the
 * form's own caption («Anexo III del PNT GC-10/014/04»), without the PNT headings
 * before it, up to the next annex.
 */
export const oosAnnexRanges: Record<OosAnnexType, { start: string; end?: string; fileName: string }> = {
  OOS_ANNEX_III: { start: "Anexo III del PNT", end: "Anexo IV", fileName: "Anexo III OOS Fase I GC-10-014-04.docx" },
  OOS_ANNEX_IV: { start: "Anexo IV del PNT", end: "ANEXO V", fileName: "Anexo IV OOS Fase II GC-10-014-04.docx" },
  OOS_ANNEX_VI: { start: "LISTADO GENERAL DE OOS AÑO", fileName: "Anexo VI Listado general OOS GC-10-014-04.docx" },
};

export function deriveOosAnnex(pnt: Buffer, type: OosAnnexType) {
  const entries = readZip(pnt);
  const range = oosAnnexRanges[type];
  const xml = extractWordBodyRange(getZipEntryText(entries, "word/document.xml"), range.start, range.end, "first")
    // The completed annexes have no PNT header or footer; their only numbering is
    // the form's own «Página n de X» row.
    .replace(/<w:(?:header|footer)Reference\b[^>]*\/>/g, "");
  updateZipEntry(entries, "word/document.xml", xml);
  sanitizeOfficeMetadata(entries);
  return writeZip(entries);
}
