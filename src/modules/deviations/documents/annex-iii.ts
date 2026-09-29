import { getZipEntryText, readZip, updateZipEntry, writeZip } from "@/lib/ooxml/zip";
import {
  appendWordCellText,
  markFirstCheckbox,
  replaceWordRowWithCopies,
  setTriStateCell,
  setWordCellText,
  setWordSdtCheckbox,
} from "@/lib/ooxml/xml";
import { loadAnnexIIITemplate } from "@/modules/deviations/documents/templates";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";

type AnnexIIIRecord = {
  qmsRecord: { businessCode: string | null };
  recordVersionLabel?: string | null;
  departmentCodeSnapshot: string | null;
  departmentNameSnapshot: string | null;
  issueDate: Date | null;
  eventDateTime: Date | null;
  detectedBy: string | null;
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

function markOrigin(xml: string, row: number, hasValue: boolean) {
  return setWordSdtCheckbox(xml, 0, row, 0, hasValue);
}

function markClassification(xml: string, classification: string | null) {
  xml = setWordSdtCheckbox(xml, 3, 1, 0, classification === "CRITICAL");
  xml = setWordSdtCheckbox(xml, 3, 2, 0, classification === "MAJOR");
  xml = setWordSdtCheckbox(xml, 3, 3, 0, classification === "MINOR");
  return xml;
}

function setImpactCell(xml: string, row: number, cell: number, label: string, state: string | null, detail?: string | null) {
  const boxes =
    state === "YES" ? "SI ☒           NO ☐          NA ☐" :
    state === "NO" ? "SI ☐           NO ☒          NA ☐" :
    state === "NA" ? "SI ☐           NO ☐          NA ☒" :
    "SI ☐           NO ☐          NA ☐";
  return setWordCellText(xml, 3, row, cell, detail ? `${label}\n${boxes}\n${detail}` : `${label}\n${boxes}`);
}

export async function generateAnnexIII(record: AnnexIIIRecord) {
  const templateVersion = record.anexoIIITemplateVersion?.versionCode ?? "06";
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
  xml = setWordCellText(xml, 0, 5, 1, date(record.eventDateTime));
  xml = setWordCellText(xml, 0, 5, 2, time(record.eventDateTime));
  xml = setWordCellText(xml, 0, 4, 4, value(record.detectedBy));

  xml = markOrigin(xml, 7, Boolean(record.finishedProductSystem));
  xml = setWordCellText(xml, 0, 7, 2, value(record.finishedProductSystem));
  xml = setWordCellText(xml, 0, 7, 4, value(record.productLot));
  xml = setWordCellText(xml, 0, 8, 4, value(record.lotSize));
  xml = setWordCellText(xml, 0, 9, 4, value(record.affectedQuantity));
  xml = markOrigin(xml, 10, Boolean(record.client));
  xml = setWordCellText(xml, 0, 10, 2, value(record.client));
  xml = markOrigin(xml, 11, Boolean(record.rawOrPackagingMaterial));
  xml = setWordCellText(xml, 0, 11, 2, value(record.rawOrPackagingMaterial));
  xml = setWordCellText(xml, 0, 11, 4, value(record.materialLot));
  xml = setWordCellText(xml, 0, 12, 4, value(record.materialLotSize));
  xml = setWordCellText(xml, 0, 13, 4, value(record.materialAffectedQuantity));
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
  xml = setWordCellText(xml, 2, 14, 0, value(record.rootCause));
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
  xml = setImpactCell(xml, 5, 0, "Impacto sobre el status de validación", record.validationImpact);
  xml = setImpactCell(xml, 5, 1, "Impacto sobre el status de registro", record.registrationImpact);
  xml = setImpactCell(xml, 6, 0, "Impacto sobre el status de estabilidad", record.stabilityImpact);
  xml = setImpactCell(
    xml,
    6,
    1,
    "Impacto sobre otros procesos/productos",
    record.otherProcessesImpact,
    record.otherProcessesImpactDetails,
  );
  xml = setWordCellText(xml, 3, 7, 1, record.capaRequired === true ? "☒ SI" : "☐ SI");
  xml = setWordCellText(xml, 3, 8, 1, record.capaRequired === false ? "☒ NO" : "☐ NO");
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
  const disposition = (record.disposition ?? "").toLocaleUpperCase("es-ES");
  const dispositionOptions = ["APROBADO", "RECHAZADO", "DESTRUIR", "DEVOLVER", "OTRO"];
  dispositionOptions.forEach((option, index) => {
    xml = setWordSdtCheckbox(xml, 4, 3, index, disposition.includes(option));
  });
  if (record.dispositionQuantity) xml = appendWordCellText(xml, 4, 3, 0, `Cantidad registrada: ${record.dispositionQuantity}`);
  if (record.dispositionComments) xml = appendWordCellText(xml, 4, 3, 0, record.dispositionComments);
  xml = setTriStateCell(xml, 4, 4, 1, record.clientNotification);

  updateZipEntry(entries, "word/document.xml", xml);
  sanitizeOfficeMetadata(entries);
  return writeZip(entries);
}
