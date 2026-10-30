import { lotColumn, storedAdditionalLots } from "@/lib/qms/additional-lots";
import { getZipEntryText, readZip, updateZipEntry, writeZip } from "@/lib/ooxml/zip";
import {
  appendWordCellText,
  applyValueMarks,
  escapeXml,
  markValue,
  markFirstCheckbox,
  replaceWordRowWithCopies,
  setTriStateCell,
  setWordCellText,
  setWordSdtCheckbox,
  transformWordCell,
  insertWordCellTables,
} from "@/lib/ooxml/xml";
import { DEFAULT_DEVIATION_ANNEX_III_VERSION, loadAnnexIIITemplate } from "@/modules/deviations/documents/templates";
import { dispositionAnnexMarks, dispositionChoice } from "@/modules/deviations/disposition";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { appendFiguresPage, type DocumentFigure } from "@/lib/ooxml/figures";
import { rootCauseAnnexText, storedInvestigationTools } from "@/modules/deviations/investigation-tools";
import { storedTextTables } from "@/lib/forms/text-tables";
import { deviationAnnexTablePlacements } from "@/modules/deviations/text-tables";

type AnnexIIIRecord = {
  qmsRecord: { businessCode: string | null };
  recordVersionLabel?: string | null;
  departmentCodeSnapshot: string | null;
  departmentNameSnapshot: string | null;
  issueDate: Date | null;
  eventDateTime: Date | null;
  detectedBy: string | null;
  shift: string | null;
  materialProcessAffected: string | null;
  processEquipmentSystem: string | null;
  finishedProductSystem: string | null;
  productLot: string | null;
  lotSize: string | null;
  affectedQuantity: string | null;
  client: string | null;
  rawOrPackagingMaterial: string | null;
  materialLot: string | null;
  materialLotSize: string | null;
  materialAffectedQuantity: string | null;
  supplier: string | null;
  supplierLot: string | null;
  additionalLots?: unknown;
  affectedEquipmentLine: string | null;
  otherOrigin: string | null;
  affectedDocumentation: string | null;
  whatHappened: string | null;
  whoInvolved: string | null;
  whenHappened: string | null;
  whereHappened: string | null;
  howHappened: string | null;
  investigation: string | null;
  investigationConclusive: string | null;
  investigationMethods: string[];
  rootCause: string | null;
  /** D-124: herramientas de análisis; se imprimen debajo de la causa raíz. */
  investigationTools?: unknown;
  textTables?: unknown;
  recurrentRootCause: string | null;
  recurrenceDetails: string | null;
  classification: string | null;
  validationImpact: string | null;
  registrationImpact: string | null;
  stabilityImpact: string | null;
  otherProcessesImpact: string | null;
  otherProcessesImpactDetails: string | null;
  capaRequired: boolean | null;
  conclusion: string | null;
  disposition: string | null;
  dispositionQuantity: string | null;
  dispositionComments: string | null;
  clientNotification: string | null;
  immediateActions: Array<{ description: string; executedBy: string | null; executedAt: Date | null }>;
  capaPlans: Array<{
    actionType: string;
    description: string;
    plannedExecutionDate: Date | null;
    responsible: string | null;
    businessCapaCode: string | null;
    linkedCapaRecord: { businessCode: string | null } | null;
  }>;
  anexoIIITemplateVersion: { versionCode: string } | null;
};

function date(value: Date | null) {
  return value ? new Intl.DateTimeFormat("es-ES").format(value) : "";
}

function time(value: Date | null) {
  return value ? new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(value) : "";
}

function value(text: string | null | undefined) {
  return text ?? "";
}

// Fila «fecha | hora | … | turno» de la tabla 0: el valor sustituye la indicación de la plantilla (D-116).
export function fillEventRow(xml: string, record: Pick<AnnexIIIRecord, "eventDateTime" | "shift">) {
  xml = setWordCellText(xml, 0, 5, 1, date(record.eventDateTime));
  xml = setWordCellText(xml, 0, 5, 2, time(record.eventDateTime));
  return setWordCellText(xml, 0, 5, 5, value(record.shift));
}

// D-124: casilla «Causa raíz» (tabla 2, fila 14): la causa raíz y, debajo, el análisis de todas las
// herramientas usadas. Se cumplimenta la casilla existente; la plantilla no cambia.
export function fillRootCauseCell(xml: string, record: Pick<AnnexIIIRecord, "rootCause" | "investigationTools">) {
  return setWordCellText(xml, 2, 14, 0, rootCauseAnnexText(record.rootCause, storedInvestigationTools(record.investigationTools)));
}

function markOrigin(xml: string, row: number, hasValue: boolean) {
  return setWordSdtCheckbox(xml, 0, row, 0, hasValue);
}

function markClassification(xml: string, classification: string | null) {
  xml = setWordSdtCheckbox(xml, 3, 1, 0, classification === "CRITICAL");
  xml = setWordSdtCheckbox(xml, 3, 2, 0, classification === "MAJOR");
  xml = setWordSdtCheckbox(xml, 3, 3, 0, classification === "MINOR");
  return xml;
}

// Disposición (D-098): casillas y cantidad según la opción registrada; el texto anterior no
// estándar se conserva como «Otro». Las etiquetas de la plantilla no se reescriben.
export function fillDispositionCell(
  xml: string,
  record: Pick<AnnexIIIRecord, "disposition" | "dispositionQuantity" | "dispositionComments">,
) {
  const { option, legacyText } = dispositionChoice(record.disposition);
  const marks = dispositionAnnexMarks(option);
  marks.checkboxes.forEach((checked, index) => {
    xml = setWordSdtCheckbox(xml, 4, 3, index, checked);
  });
  const quantity = record.dispositionQuantity?.trim();
  if (quantity && marks.quantityLine !== null) {
    xml = transformWordCell(xml, 4, 3, 0, (cell) => {
      let seen = 0;
      return cell.replace(/(>Cantidad )_+(<)/g, (match, start: string, end: string) => (seen++ === marks.quantityLine ? `${start}${markValue(escapeXml(quantity))}${end}` : match));
    });
    xml = applyValueMarks(xml);
  } else if (quantity) {
    xml = appendWordCellText(xml, 4, 3, 0, `Cantidad: ${quantity}`);
  }
  if (legacyText) xml = appendWordCellText(xml, 4, 3, 0, legacyText);
  if (record.dispositionComments) xml = appendWordCellText(xml, 4, 3, 0, record.dispositionComments);
  return xml;
}

// Marca SI/NO/NA en las casillas de la plantilla sin reescribir su texto (cada celda tiene 3 casillas).
export function setImpactCell(xml: string, row: number, cell: number, state: string | null, detail?: string | null) {
  ["YES", "NO", "NA"].forEach((option, index) => {
    xml = setWordSdtCheckbox(xml, 3, row, cell * 3 + index, state === option);
  });
  return detail ? appendWordCellText(xml, 3, row, cell, detail) : xml;
}

/** D-127: las tablas de cada texto, al final de la casilla de su apartado. Va después de rellenar el resto. */
export function fillTextTables(xml: string, record: Pick<AnnexIIIRecord, "textTables">) {
  return insertWordCellTables(xml, deviationAnnexTablePlacements(storedTextTables(record.textTables)));
}

/** `figures` (D-125): hoja «Figuras» tras la última página; la plantilla no se modifica. */
export async function generateAnnexIII(record: AnnexIIIRecord, figures: readonly DocumentFigure[] = []) {
  const templateVersion = record.anexoIIITemplateVersion?.versionCode ?? DEFAULT_DEVIATION_ANNEX_III_VERSION;
  const entries = readZip(await loadAnnexIIITemplate(templateVersion));
  let xml = getZipEntryText(entries, "word/document.xml");

  xml = setWordCellText(xml, 0, 1, 1, value(record.qmsRecord.businessCode));
  xml = setWordCellText(xml, 0, 1, 3, date(record.issueDate));
  xml = setWordCellText(
    xml,
    0,
    2,
    1,
    [record.departmentCodeSnapshot, record.departmentNameSnapshot].filter(Boolean).join(" - "),
  );
  xml = setWordCellText(xml, 0, 2, 3, record.recordVersionLabel ?? "V00");
  xml = setWordCellText(xml, 0, 3, 1, value(record.materialProcessAffected || record.processEquipmentSystem));
  xml = fillEventRow(xml, record);
  xml = setWordCellText(xml, 0, 4, 4, value(record.detectedBy));

  // D-094: los otros lotes van en la misma casilla que el principal, uno por línea.
  const extraLots = storedAdditionalLots(record.additionalLots);
  const productLots = extraLots.filter((lot) => lot.kind !== "MATERIAL");
  const materialLots = extraLots.filter((lot) => lot.kind === "MATERIAL");
  xml = markOrigin(xml, 7, Boolean(record.finishedProductSystem) || productLots.length > 0);
  xml = setWordCellText(xml, 0, 7, 2, value(lotColumn(record.finishedProductSystem, productLots, "name")));
  xml = setWordCellText(xml, 0, 7, 4, value(lotColumn(record.productLot, productLots, "lot")));
  xml = setWordCellText(xml, 0, 8, 4, value(lotColumn(record.lotSize, productLots, "size")));
  xml = setWordCellText(xml, 0, 9, 4, value(lotColumn(record.affectedQuantity, productLots, "quantity")));
  xml = markOrigin(xml, 10, Boolean(record.client));
  xml = setWordCellText(xml, 0, 10, 2, value(record.client));
  xml = markOrigin(xml, 11, Boolean(record.rawOrPackagingMaterial) || materialLots.length > 0);
  xml = setWordCellText(xml, 0, 11, 2, value(lotColumn(record.rawOrPackagingMaterial, materialLots, "name")));
  xml = setWordCellText(xml, 0, 11, 4, value(lotColumn(record.materialLot, materialLots, "lot")));
  xml = setWordCellText(xml, 0, 12, 4, value(lotColumn(record.materialLotSize, materialLots, "size")));
  xml = setWordCellText(xml, 0, 13, 4, value(lotColumn(record.materialAffectedQuantity, materialLots, "quantity")));
  xml = markOrigin(xml, 14, Boolean(record.supplier));
  xml = setWordCellText(xml, 0, 14, 2, value(record.supplier));
  xml = setWordCellText(xml, 0, 14, 4, value(record.supplierLot));
  xml = markOrigin(xml, 15, Boolean(record.affectedEquipmentLine));
  xml = setWordCellText(xml, 0, 15, 2, value(record.affectedEquipmentLine));
  xml = markOrigin(xml, 16, Boolean(record.otherOrigin));
  xml = setWordCellText(xml, 0, 16, 2, value(record.otherOrigin));
  xml = setWordCellText(xml, 0, 18, 0, value(record.affectedDocumentation));

  xml = setWordCellText(xml, 1, 2, 0, value(record.whatHappened));
  xml = setWordCellText(xml, 1, 4, 0, value(record.whoInvolved));
  xml = setWordCellText(xml, 1, 6, 0, value(record.whenHappened));
  xml = setWordCellText(xml, 1, 8, 0, value(record.whereHappened));
  xml = setWordCellText(xml, 1, 10, 0, value(record.howHappened));

  if (!record.immediateActions.length) xml = markFirstCheckbox(xml, 2, 1, 0, true);

  xml = setWordCellText(xml, 2, 6, 0, value(record.investigation));
  xml = setTriStateCell(xml, 2, 7, 1, record.investigationConclusive);
  const methods = new Set(record.investigationMethods);
  xml = setWordSdtCheckbox(xml, 2, 9, 0, methods.has("BRAINSTORMING"));
  xml = setWordSdtCheckbox(xml, 2, 10, 0, methods.has("FIVE_WHYS"));
  xml = setWordSdtCheckbox(xml, 2, 11, 0, methods.has("FTA"));
  xml = setWordSdtCheckbox(xml, 2, 12, 0, methods.has("ISHIKAWA"));
  xml = fillRootCauseCell(xml, record);
  xml = setTriStateCell(xml, 2, 15, 1, record.recurrentRootCause);
  xml = setWordCellText(xml, 2, 16, 1, value(record.recurrenceDetails));
  if (record.immediateActions.length) {
    xml = replaceWordRowWithCopies(
      xml,
      2,
      3,
      record.immediateActions.map((action) => [
        action.description,
        value(action.executedBy),
        date(action.executedAt),
      ]),
    );
  }

  xml = markClassification(xml, record.classification);
  xml = setImpactCell(xml, 5, 0, record.validationImpact);
  xml = setImpactCell(xml, 5, 1, record.registrationImpact);
  xml = setImpactCell(xml, 6, 0, record.stabilityImpact);
  xml = setImpactCell(xml, 6, 1, record.otherProcessesImpact, record.otherProcessesImpactDetails);
  xml = setWordSdtCheckbox(xml, 3, 7, 0, record.capaRequired === true);
  xml = setWordSdtCheckbox(xml, 3, 8, 0, record.capaRequired === false);
  xml = markFirstCheckbox(xml, 3, 10, 0, record.capaPlans.some((plan) => plan.actionType === "CORRECTIVE"));
  xml = markFirstCheckbox(xml, 3, 10, 1, record.capaPlans.some((plan) => plan.actionType === "PREVENTIVE"));
  if (record.capaPlans.length) {
    xml = replaceWordRowWithCopies(
      xml,
      3,
      12,
      record.capaPlans.map((plan) => [
        plan.businessCapaCode || plan.linkedCapaRecord?.businessCode || "",
        plan.description,
        date(plan.plannedExecutionDate),
        value(plan.responsible),
      ]),
    );
  }

  xml = setWordCellText(xml, 4, 1, 0, value(record.conclusion));
  xml = fillDispositionCell(xml, record);
  xml = setTriStateCell(xml, 4, 4, 1, record.clientNotification);

  xml = fillTextTables(xml, record);
  updateZipEntry(entries, "word/document.xml", xml);
  appendFiguresPage(entries, figures, value(record.qmsRecord.businessCode));
  sanitizeOfficeMetadata(entries);
  return writeZip(entries);
}
