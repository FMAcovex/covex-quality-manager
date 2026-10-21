import {
  getZipEntryText,
  readZip,
  updateZipEntry,
  writeZip,
} from "@/lib/ooxml/zip";
import {
  appendWordVariableCellText,
  replaceWordRowWithVariableCopies,
  setWordSdtCheckbox,
  setWordVariableCellText,
} from "@/lib/ooxml/xml";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { DEFAULT_CAPA_ANNEX_III_VERSION, loadCapaAnnexIIITemplate } from "@/modules/capa/documents/templates";

type CapaAnnexRecord = {
  qmsRecord: { businessCode: string | null };
  recordVersionSequenceNumber?: number | null;
  recordVersionReason?: string | null;
  versionFollowupDate?: Date | null;
  actionType: string;
  openedAt: Date | null;
  originType: string | null;
  originCode: string | null;
  origins?: Array<{
    recordType: string | null;
    businessCode: string | null;
  }>;
  applicableTo: string | null;
  defectDescription: string | null;
  rootCause: string | null;
  status: string;
  operationalStatusDescription: string | null;
  cancellationReason: string | null;
  effectivenessStatus: string;
  effectivenessAssessment: string | null;
  operationalClosedAt: Date | null;
  effectiveClosedAt: Date | null;
  conclusion: string | null;
  nextFollowupDate: Date | null;
  actionFollowupObservations: string | null;
  plannedActions: Array<{
    description: string;
    responsible: string | null;
    plannedExecutionDate: Date | null;
    impact: string | null;
  }>;
  actionFollowups: Array<{
    followupDate: Date | null;
    description: string | null;
  }>;
  annexIIITemplateVersion: { versionCode: string } | null;
};

function date(value: Date | null | undefined) {
  return value ? new Intl.DateTimeFormat("es-ES").format(value) : "";
}

function originGroup(value: string | null) {
  const normalized = (value ?? "").toLocaleLowerCase("es-ES");
  if (normalized.includes("auditor")) return "AUDIT";
  if (normalized.includes("inspe")) return "INSPECTION";
  if (normalized.includes("desvi")) return "DEVIATION";
  if (normalized.includes("rechaz") || normalized.includes("devol")) return "RETURN";
  if (normalized.includes("reclam")) return "COMPLAINT";
  return "OTHER";
}

function normalizedOrigins(record: CapaAnnexRecord) {
  const canonical = (record.origins ?? []).filter((item) => item.businessCode);
  if (canonical.length) return canonical;
  if (!record.originCode) return [];
  return [{
    recordType: originGroup(record.originType),
    businessCode: record.originCode,
  }];
}

function matchesOriginType(value: string | null, type: "DEVIATION" | "COMPLAINT") {
  const normalized = (value ?? "").toLocaleUpperCase("es-ES");
  if (type === "DEVIATION") {
    return normalized === "DEVIATION" || normalized.includes("DESVI");
  }
  return normalized === "COMPLAINT" || normalized.includes("RECLAM");
}

export async function generateCapaAnnexIII(record: CapaAnnexRecord) {
  const version = record.annexIIITemplateVersion?.versionCode ?? DEFAULT_CAPA_ANNEX_III_VERSION;
  const entries = readZip(await loadCapaAnnexIIITemplate(version));
  let xml = getZipEntryText(entries, "word/document.xml");

  xml = setWordSdtCheckbox(xml, 0, 1, 0, record.actionType === "CORRECTIVE");
  xml = setWordSdtCheckbox(xml, 0, 1, 1, record.actionType === "PREVENTIVE");
  xml = setWordVariableCellText(xml, 0, 2, 1, record.qmsRecord.businessCode ?? "");
  xml = setWordVariableCellText(xml, 0, 2, 3, date(record.openedAt));

  const sequenceNumber = record.recordVersionSequenceNumber ?? 0;
  xml = setWordVariableCellText(
    xml,
    0,
    3,
    1,
    String(sequenceNumber).padStart(2, "0"),
  );
  xml = setWordVariableCellText(
    xml,
    0,
    3,
    3,
    date(sequenceNumber === 0 ? record.openedAt : record.versionFollowupDate),
  );
  xml = setWordVariableCellText(
    xml,
    0,
    4,
    1,
    sequenceNumber === 0 ? "" : record.recordVersionReason ?? "",
  );

  const origins = normalizedOrigins(record);
  const deviationCodes = origins
    .filter((item) => matchesOriginType(item.recordType, "DEVIATION"))
    .map((item) => item.businessCode)
    .filter((value): value is string => Boolean(value));
  const complaintCodes = origins
    .filter((item) => matchesOriginType(item.recordType, "COMPLAINT"))
    .map((item) => item.businessCode)
    .filter((value): value is string => Boolean(value));

  xml = setWordSdtCheckbox(xml, 0, 7, 0, deviationCodes.length > 0);
  xml = setWordSdtCheckbox(xml, 0, 8, 0, complaintCodes.length > 0);
  if (deviationCodes.length) {
    xml = appendWordVariableCellText(xml, 0, 7, 0, deviationCodes.join("\n"));
  }
  if (complaintCodes.length) {
    xml = appendWordVariableCellText(xml, 0, 8, 0, complaintCodes.join("\n"));
  }

  if (!deviationCodes.length && !complaintCodes.length && record.originCode) {
    const group = originGroup(record.originType);
    const target = {
      AUDIT: { row: 6, checkbox: 0, cell: 0 },
      INSPECTION: { row: 6, checkbox: 1, cell: 1 },
      RETURN: { row: 7, checkbox: 1, cell: 1 },
      OTHER: { row: 8, checkbox: 1, cell: 1 },
    }[group as "AUDIT" | "INSPECTION" | "RETURN" | "OTHER"];
    if (target) {
      xml = setWordSdtCheckbox(xml, 0, target.row, target.checkbox, true);
      xml = appendWordVariableCellText(xml, 0, target.row, target.cell, record.originCode);
    }
  }

  xml = setWordVariableCellText(xml, 0, 10, 0, record.applicableTo ?? "");
  xml = setWordVariableCellText(xml, 0, 12, 0, record.defectDescription ?? "");
  xml = setWordVariableCellText(xml, 0, 14, 0, record.rootCause ?? "");

  if (record.plannedActions.length) {
    xml = replaceWordRowWithVariableCopies(
      xml,
      0,
      17,
      record.plannedActions.map((action) => [
        action.description,
        action.responsible ?? "",
        date(action.plannedExecutionDate),
        action.impact ?? "",
      ]),
    );
  }

  xml = setWordVariableCellText(
    xml,
    1,
    4,
    0,
    record.actionFollowupObservations ?? "",
  );

  xml = setWordSdtCheckbox(xml, 1, 6, 0, record.status === "OPEN");
  xml = setWordSdtCheckbox(xml, 1, 6, 1, record.status === "CLOSED");
  xml = setWordSdtCheckbox(xml, 1, 6, 2, record.status === "CANCELLED");
  xml = setWordVariableCellText(
    xml,
    1,
    7,
    0,
    record.operationalStatusDescription ?? record.cancellationReason ?? "",
  );

  xml = setWordSdtCheckbox(xml, 1, 9, 0, record.effectivenessStatus === "CONFORMING");
  xml = setWordSdtCheckbox(xml, 1, 9, 1, record.effectivenessStatus === "NONCONFORMING");
  xml = setWordSdtCheckbox(xml, 1, 9, 2, record.effectivenessStatus === "PENDING");
  if (record.effectivenessAssessment) {
    xml = appendWordVariableCellText(xml, 1, 10, 0, record.effectivenessAssessment);
  }
  xml = setWordVariableCellText(xml, 1, 12, 0, record.conclusion ?? "");

  xml = setWordVariableCellText(xml, 1, 13, 1, date(record.nextFollowupDate));
  xml = setWordVariableCellText(xml, 1, 14, 1, date(record.operationalClosedAt));
  xml = setWordVariableCellText(xml, 1, 15, 1, date(record.effectiveClosedAt));

  if (record.actionFollowups.length) {
    xml = replaceWordRowWithVariableCopies(
      xml,
      1,
      2,
      record.actionFollowups.map((followup) => [
        date(followup.followupDate),
        followup.description ?? "",
      ]),
    );
  }

  updateZipEntry(entries, "word/document.xml", xml);
  sanitizeOfficeMetadata(entries);
  return writeZip(entries);
}
