import {
  getZipEntryText,
  readZip,
  updateZipEntry,
  writeZip,
} from "@/lib/ooxml/zip";
import {
  replaceWordRowWithCopies,
  setWordCellText,
  setWordSdtCheckbox,
} from "@/lib/ooxml/xml";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { loadCapaAnnexIIITemplate } from "@/modules/capa/documents/templates";

type CapaAnnexRecord = {
  qmsRecord: { businessCode: string | null };
  actionType: string;
  openedAt: Date | null;
  originType: string | null;
  originCode: string | null;
  applicableTo: string | null;
  defectDescription: string | null;
  rootCause: string | null;
  status: string;
  cancellationReason: string | null;
  effectivenessStatus: string;
  effectivenessCriteria: string | null;
  effectivenessAssessment: string | null;
  effectivenessEvidence: string | null;
  operationalClosedAt: Date | null;
  effectiveClosedAt: Date | null;
  conclusion: string | null;
  approvalNames: string | null;
  plannedActions: Array<{
    description: string;
    responsible: string | null;
    plannedExecutionDate: Date | null;
    impact: string | null;
  }>;
  followups: Array<{
    sequenceNumber: number;
    followupDate: Date;
    reason: string | null;
    description: string;
    observations: string | null;
    evidenceReference: string | null;
    nextFollowupDate: Date | null;
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

export async function generateCapaAnnexIII(record: CapaAnnexRecord) {
  const version = record.annexIIITemplateVersion?.versionCode ?? "05";
  const entries = readZip(await loadCapaAnnexIIITemplate(version));
  let xml = getZipEntryText(entries, "word/document.xml");

  xml = setWordSdtCheckbox(xml, 0, 1, 0, record.actionType === "CORRECTIVE");
  xml = setWordSdtCheckbox(xml, 0, 1, 1, record.actionType === "PREVENTIVE");
  xml = setWordCellText(xml, 0, 2, 1, record.qmsRecord.businessCode ?? "");
  xml = setWordCellText(xml, 0, 2, 3, date(record.openedAt));

  const latest = record.followups[0] ?? null;
  xml = setWordCellText(
    xml,
    0,
    3,
    1,
    latest ? String(latest.sequenceNumber).padStart(2, "0") : "00",
  );
  xml = setWordCellText(xml, 0, 3, 3, latest ? date(latest.followupDate) : date(record.openedAt));
  xml = setWordCellText(xml, 0, 4, 1, latest?.reason ?? "Emisión inicial");

  const group = originGroup(record.originType);
  const checkbox = {
    AUDIT: [6, 0],
    INSPECTION: [6, 1],
    DEVIATION: [7, 0],
    RETURN: [7, 1],
    COMPLAINT: [8, 0],
    OTHER: [8, 1],
  }[group]!;
  xml = setWordSdtCheckbox(xml, 0, checkbox[0], checkbox[1], true);
  const originText = [record.originType, record.originCode].filter(Boolean).join(" · ");
  xml = setWordCellText(xml, 0, 5, 0, `ORIGEN\n${originText}`);

  xml = setWordCellText(xml, 0, 10, 0, record.applicableTo ?? "");
  xml = setWordCellText(xml, 0, 12, 0, record.defectDescription ?? "");
  xml = setWordCellText(xml, 0, 14, 0, record.rootCause ?? "");

  if (record.plannedActions.length) {
    xml = replaceWordRowWithCopies(
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

  if (record.followups.length) {
    const chronological = [...record.followups].sort(
      (a, b) => a.sequenceNumber - b.sequenceNumber,
    );
    xml = replaceWordRowWithCopies(
      xml,
      1,
      2,
      chronological.map((followup) => [
        date(followup.followupDate),
        [
          `Seguimiento ${String(followup.sequenceNumber).padStart(2, "0")}: ${followup.description}`,
          followup.evidenceReference ? `Evidencia: ${followup.evidenceReference}` : "",
        ].filter(Boolean).join("\n"),
      ]),
    );
    xml = setWordCellText(
      xml,
      1,
      4,
      0,
      chronological
        .map((followup) =>
          followup.observations
            ? `${String(followup.sequenceNumber).padStart(2, "0")}: ${followup.observations}`
            : "",
        )
        .filter(Boolean)
        .join("\n"),
    );
  }

  xml = setWordSdtCheckbox(xml, 1, 6, 0, record.status === "OPEN");
  xml = setWordSdtCheckbox(xml, 1, 6, 1, record.status === "CLOSED");
  xml = setWordSdtCheckbox(xml, 1, 6, 2, record.status === "CANCELLED");
  xml = setWordCellText(xml, 1, 7, 0, record.cancellationReason ?? "");

  xml = setWordSdtCheckbox(xml, 1, 9, 0, record.effectivenessStatus === "CONFORMING");
  xml = setWordSdtCheckbox(xml, 1, 9, 1, record.effectivenessStatus === "NONCONFORMING");
  xml = setWordSdtCheckbox(xml, 1, 9, 2, record.effectivenessStatus === "PENDING");
  xml = setWordCellText(
    xml,
    1,
    10,
    0,
    [
      record.effectivenessCriteria ? `Criterio: ${record.effectivenessCriteria}` : "",
      record.effectivenessAssessment ? `Valoración: ${record.effectivenessAssessment}` : "",
      record.effectivenessEvidence ? `Evidencia: ${record.effectivenessEvidence}` : "",
    ].filter(Boolean).join("\n"),
  );
  xml = setWordCellText(xml, 1, 12, 0, record.conclusion ?? "");

  const next = record.followups.find((item) => item.nextFollowupDate)?.nextFollowupDate ?? null;
  xml = setWordCellText(xml, 1, 13, 1, date(next));
  xml = setWordCellText(xml, 1, 14, 1, date(record.operationalClosedAt));
  xml = setWordCellText(xml, 1, 15, 1, date(record.effectiveClosedAt));
  xml = setWordCellText(xml, 2, 1, 0, record.approvalNames ?? "");
  xml = setWordCellText(xml, 2, 3, 0, record.approvalNames ?? "");

  updateZipEntry(entries, "word/document.xml", xml);
  sanitizeOfficeMetadata(entries);
  return writeZip(entries);
}
