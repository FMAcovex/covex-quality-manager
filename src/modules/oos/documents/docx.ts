import { lotColumn, storedAdditionalLots } from "@/lib/qms/additional-lots";
import type { OosInvestigationResult, OosMaterialKind, OosPhaseIDisposition, OosStatus, OosVerdict, QmsRecordType } from "@prisma/client";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { fillWordCellBalanced, fillWordRowCellsBalanced, transformWordRowsBalanced, transformWordTableBalanced } from "@/lib/ooxml/xml";
import { getZipEntryText, readZip, updateZipEntry, writeZip } from "@/lib/ooxml/zip";
import { qmsRecordTypeLabel } from "@/lib/qms/record-links";
import { formatOosDate, oosEvaluationKeys, oosInvestigationResultLabels, readOosEvaluation } from "@/modules/oos/domain";

// D-088, OOS-3: fills the Anexo III, IV and VI tables of PNT GC-10/014/04 without
// redesigning them. Table/row/cell positions are those of the controlled template.

export type OosDocumentRecord = {
  status: OosStatus;
  issueDate: Date | null;
  materialKind: OosMaterialKind | null;
  materialName: string | null;
  lotNumber: string | null;
  batchSize: string | null;
  affectedQuantity: string | null;
  additionalLots?: unknown;
  supplier: string | null;
  supplierLot: string | null;
  process: string | null;
  oosDate: Date | null;
  oosTime: string | null;
  detectedBy: string | null;
  shift: string | null;
  detectionDescription: string | null;
  phaseIEvaluation: unknown;
  phaseIInvestigation: string | null;
  phaseIConclusion: string | null;
  phaseIDisposition: OosPhaseIDisposition | null;
  phaseIVerdict: OosVerdict | null;
  phaseIVerdictQuantity: string | null;
  phaseIDestroyQuantity: string | null;
  phaseIReturnQuantity: string | null;
  phaseIVerdictOther: string | null;
  phaseIIssuedBy: string | null;
  phaseIIssuedAt: Date | null;
  phaseIApprovedBy: string | null;
  phaseIApprovedAt: Date | null;
  phaseIIIssueDate: Date | null;
  phaseIIProductionReview: string | null;
  phaseIIRetesting: string | null;
  phaseIIResampling: string | null;
  phaseIIConclusion: string | null;
  phaseIIVerdict: OosVerdict | null;
  phaseIIVerdictQuantity: string | null;
  phaseIIDestroyQuantity: string | null;
  phaseIIReturnQuantity: string | null;
  phaseIIVerdictOther: string | null;
  phaseIIIssuedBy: string | null;
  phaseIIIssuedAt: Date | null;
  phaseIIAffectedDepartments: string | null;
  investigationResult: OosInvestigationResult | null;
  closedAt: Date | null;
  qmsRecord: { businessCode: string | null; sourceRelations: { targetRecord: { recordType: QmsRecordType; businessCode: string | null; annulledBusinessCode: string | null } }[] };
};

const text = (value: string | null | undefined) => value?.trim() ?? "";
const date = (value: Date | null | undefined) => (value ? formatOosDate(value) : "");
const mark = (on: boolean) => (on ? "X" : "");

function render(template: Buffer, fill: (xml: string) => string) {
  const entries = readZip(template);
  updateZipEntry(entries, "word/document.xml", fill(getZipEntryText(entries, "word/document.xml")));
  sanitizeOfficeMetadata(entries);
  return writeZip(entries);
}

/** «Página n de X»: as in the completed annexes, X is the number of pages of the form (one table each). */
export function completeFormPageCount(xml: string) {
  const total = (xml.match(/Página\s*\d+\s*de/g) ?? []).length;
  if (!total) return xml;
  return xml.replace(/(Página\s*\d+\s*de\s*(?:<\/w:t>(?:(?!<w:t[\s>])[\s\S])*?<w:t(?:\s[^>]*)?>)?)X(?=<\/w:t>)/g, `$1${total}`);
}

type Verdict = { verdict: OosVerdict | null; quantity: string | null; destroy: string | null; returned: string | null; other: string | null };

/** DICTAMEN block, identical in both annexes: APROBADO/CANTIDAD, RECHAZADO/DESTRUIR-DEVOLVER-CANTIDAD, OTROS/INDICAR. */
function fillVerdict(xml: string, table: number, firstRow: number, value: Verdict) {
  let out = xml;
  const cells: [number, number, string][] = [
    [firstRow, 1, mark(value.verdict === "APPROVED")],
    [firstRow, 3, mark(value.verdict === "REJECTED")],
    [firstRow, 5, mark(value.verdict === "OTHER")],
    [firstRow + 1, 1, value.verdict === "APPROVED" ? text(value.quantity) : ""],
    [firstRow + 1, 3, text(value.destroy)],
    [firstRow + 1, 5, value.verdict === "OTHER" ? [text(value.other), value.quantity ? `Cantidad: ${text(value.quantity)}` : ""].filter(Boolean).join("\n") : ""],
    [firstRow + 2, 3, text(value.returned)],
    [firstRow + 3, 3, value.verdict === "REJECTED" ? text(value.quantity) : ""],
  ];
  for (const [row, cell, content] of cells) out = fillWordCellBalanced(out, table, row, cell, content);
  return out;
}

/** Anexo III — Fase I: investigación en el laboratorio (three pages, one table each). */
export function fillOosAnnexIII(template: Buffer, record: OosDocumentRecord) {
  return render(template, (source) => {
    let xml = source;
    const set = (table: number, row: number, cell: number, value: string, options?: Parameters<typeof fillWordCellBalanced>[5]) => { xml = fillWordCellBalanced(xml, table, row, cell, value, options); };
    // Página 1: datos iniciales y detección.
    set(0, 1, 0, text(record.qmsRecord.businessCode));
    set(0, 1, 1, date(record.issueDate));
    const block = record.materialKind === "FINISHED_PRODUCT" ? 3 : record.materialKind === "RAW_OR_PACKAGING_MATERIAL" ? 6 : null;
    if (block !== null) {
      // D-094: los otros lotes van en las mismas casillas, uno por línea.
      const lots = storedAdditionalLots(record.additionalLots);
      set(0, block, 1, text(lotColumn(record.materialName, lots, "name")));
      set(0, block, 3, text(lotColumn(record.lotNumber, lots, "lot")));
      set(0, block + 1, 3, text(lotColumn(record.batchSize, lots, "size")));
      set(0, block + 2, 3, text(lotColumn(record.affectedQuantity, lots, "quantity")));
    }
    if (record.materialKind === "RAW_OR_PACKAGING_MATERIAL") {
      set(0, 9, 1, text(record.supplier));
      set(0, 9, 3, text(record.supplierLot));
    }
    set(0, 10, 1, text(record.process));
    set(0, 11, 1, date(record.oosDate), { replaceHint: true });
    set(0, 11, 2, text(record.oosTime), { replaceHint: true });
    set(0, 11, 4, text(record.detectedBy), { replaceHint: true });
    set(0, 11, 5, text(record.shift), { replaceHint: true });
    set(0, 13, 0, text(record.detectionDescription), { mode: "paragraphs" });
    // Página 2: los 21 parámetros de la evaluación, en el orden del anexo.
    const evaluation = readOosEvaluation(record.phaseIEvaluation);
    oosEvaluationKeys.forEach((key, index) => set(1, 3 + index, 2, text(evaluation[key])));
    // Página 3: investigación, conclusiones, disposición, dictamen y emisión.
    set(2, 2, 0, text(record.phaseIInvestigation), { mode: "paragraphs" });
    set(2, 4, 0, text(record.phaseIConclusion), { mode: "paragraphs" });
    set(2, 6, 1, mark(record.phaseIDisposition === "LAB_ERROR"));
    set(2, 7, 1, mark(record.phaseIDisposition === "FULL_SCALE"));
    xml = fillVerdict(xml, 2, 9, { verdict: record.phaseIVerdict, quantity: record.phaseIVerdictQuantity, destroy: record.phaseIDestroyQuantity, returned: record.phaseIReturnQuantity, other: record.phaseIVerdictOther });
    set(2, 13, 0, text(record.phaseIIssuedBy), { mode: "paragraphs" });
    set(2, 13, 2, date(record.phaseIIssuedAt), { replaceHint: true });
    set(2, 14, 0, text(record.phaseIApprovedBy), { mode: "paragraphs" });
    set(2, 14, 2, date(record.phaseIApprovedAt), { replaceHint: true });
    return completeFormPageCount(xml);
  });
}

/** Anexo IV — Fase II: investigación a gran escala (two pages). */
export function fillOosAnnexIV(template: Buffer, record: OosDocumentRecord) {
  return render(template, (source) => {
    let xml = source;
    const set = (table: number, row: number, cell: number, value: string, options?: Parameters<typeof fillWordCellBalanced>[5]) => { xml = fillWordCellBalanced(xml, table, row, cell, value, options); };
    set(0, 1, 0, text(record.qmsRecord.businessCode));
    set(0, 1, 1, date(record.phaseIIIssueDate));
    set(0, 3, 0, text(record.phaseIIProductionReview), { mode: "paragraphs" });
    set(0, 5, 0, text(record.phaseIIRetesting), { mode: "paragraphs" });
    set(0, 7, 0, text(record.phaseIIResampling), { mode: "paragraphs" });
    set(1, 2, 0, text(record.phaseIIConclusion), { mode: "paragraphs" });
    xml = fillVerdict(xml, 1, 4, { verdict: record.phaseIIVerdict, quantity: record.phaseIIVerdictQuantity, destroy: record.phaseIIDestroyQuantity, returned: record.phaseIIReturnQuantity, other: record.phaseIIVerdictOther });
    set(1, 8, 0, text(record.phaseIIIssuedBy), { mode: "paragraphs" });
    set(1, 8, 2, date(record.phaseIIIssuedAt), { replaceHint: true });
    set(1, 9, 0, text(record.phaseIIAffectedDepartments), { mode: "paragraphs" });
    return completeFormPageCount(xml);
  });
}

/** INVESTIGACIÓN / CAPA: result of the investigation and the derived CAPA / deviations. */
export function oosInvestigationSummary(record: Pick<OosDocumentRecord, "status" | "phaseIDisposition" | "investigationResult" | "qmsRecord">) {
  const state = record.investigationResult
    ? oosInvestigationResultLabels[record.investigationResult]
    : record.status === "OPEN" ? `En curso · Fase ${record.phaseIDisposition === "FULL_SCALE" ? "II" : "I"}` : "";
  const related = record.qmsRecord.sourceRelations.map(({ targetRecord }) => `${qmsRecordTypeLabel(targetRecord.recordType)} ${targetRecord.businessCode ?? targetRecord.annulledBusinessCode ?? ""}`.trim());
  return [state, ...related].filter(Boolean).join("\n");
}

const templateDataRows = 13;
/** §5.2: amarillo = pendiente, verde = cerrado. */
export const oosListingShades = { pending: "FFFF00", closed: "92D050" } as const;

/** Anexo VI — Listado general de OOS de un año, para imprimir y firmar a mano (§5.2). */
export function fillOosAnnexVI(template: Buffer, year: number, records: OosDocumentRecord[]) {
  return render(template, (source) => {
    let xml = transformWordTableBalanced(source, 0, (table) => {
      let replaced = false;
      // «AÑO:____»: the first underscore run takes the year, the remaining blanks are cleared.
      return table.replace(/(<w:t(?:\s[^>]*)?>)([^<]*_[^<]*)(<\/w:t>)/g, (_match, open: string, content: string, close: string) => {
        const value = replaced ? content.replace(/_+/g, "") : content.replace(/_+/, ` ${year}`).replace(/_+/g, "");
        replaced = true;
        return `${open.includes("xml:space") ? open : open.replace("<w:t", '<w:t xml:space="preserve"')}${value}${close}`;
      });
    });
    // The template rows are filled in place; more OOS than rows repeat the last template row.
    xml = transformWordRowsBalanced(xml, 0, 4, 4 + templateDataRows - 1, (rows) => {
      const filled = records.map((record, index) => fillWordRowCellsBalanced(rows[Math.min(index, rows.length - 1)], {
        0: text(record.qmsRecord.businessCode),
        1: date(record.issueDate),
        2: [text(record.materialName), ...[record.lotNumber, ...storedAdditionalLots(record.additionalLots).map((lot) => lot.lot)].filter(Boolean).map((lot) => `Lote ${text(lot)}`)].filter(Boolean).join("\n"),
        3: text(record.detectionDescription),
        4: oosInvestigationSummary(record),
        5: date(record.closedAt),
      }, { replaceHint: true, shade: record.status === "CLOSED" ? oosListingShades.closed : oosListingShades.pending }));
      return [...filled, ...rows.slice(filled.length)];
    });
    return xml;
  });
}
