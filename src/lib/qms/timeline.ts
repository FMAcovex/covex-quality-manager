import "server-only";
import type { DocumentType, RecordVersionDocumentKind, RecordVersionKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { qmsRecordDisplayCode, qmsRecordTypeLabel } from "@/lib/qms/record-links";

export type TimelineEntryKind = "CHANGE" | "VERSION" | "DOCUMENT" | "SIGNED_DOCUMENT" | "RELATION";

export type TimelineEntry = Readonly<{
  id: string;
  at: Date;
  kind: TimelineEntryKind;
  title: string;
  detail: string | null;
  actor: string | null;
}>;

export const TIMELINE_KIND_LABELS: Readonly<Record<TimelineEntryKind, string>> = {
  CHANGE: "Modificación",
  VERSION: "Versión",
  DOCUMENT: "Documento generado",
  SIGNED_DOCUMENT: "Documento recibido",
  RELATION: "Relación",
};

const versionKindLabels: Readonly<Record<RecordVersionKind, string>> = {
  INITIAL: "Versión inicial",
  REOPENING: "Reapertura",
  FOLLOWUP: "Seguimiento",
  AUDIT_REVISION: "Revisión del informe",
  HISTORICAL_STATE: "Estado histórico",
};

const signedKindLabels: Readonly<Record<RecordVersionDocumentKind, string>> = {
  SIGNED_PDF: "PDF firmado",
  RETURN_ANNEX_III_SIGNED: "Anexo III firmado",
  RETURN_ANNEX_V_SIGNED: "Anexo V firmado",
  OOS_ANNEX_III_SIGNED: "Anexo III firmado",
  OOS_ANNEX_IV_SIGNED: "Anexo IV firmado",
};

const auditDocumentLabels: Readonly<Record<string, string>> = {
  AUDIT_ANNUAL_INTERNAL_PROGRAMME: "Programa anual de auditorías internas",
  AUDIT_ANNUAL_EXTERNAL_PROGRAMME: "Programa anual de auditorías externas",
  AUDIT_INTERNAL_REPORT: "Informe de auditoría interna",
  AUDIT_EXTERNAL_REPORT: "Informe de auditoría externa",
  AUDIT_CAPA_PLAN: "Plan CAPA de auditoría",
  AUDIT_EXTERNAL_PLAN: "Plan de auditoría externa",
  AUDIT_RECEIVED: "Documento recibido de auditoría",
  AUDIT_RESPONSE: "Respuesta de auditoría",
  AUDIT_EVIDENCE: "Evidencia de auditoría",
};

/** «DEVIATION_ANNEX_III» → «Anexo III»; «CAPA_SIMPLE_LIST» → «Listado simple». */
export function documentTypeLabel(type: DocumentType | string): string {
  const annex = /ANNEX_([IVX]+)$/.exec(type);
  if (annex) return `Anexo ${annex[1]}`;
  if (type.endsWith("SIMPLE_LIST")) return "Listado simple";
  return auditDocumentLabels[type] ?? type;
}

// Marcadores técnicos del historial; el resto de fieldPath se muestra tal cual, como en «Historial».
const technicalFieldLabels: Readonly<Record<string, string>> = {
  __created__: "Alta del expediente",
  __edit__: "Edición",
  __version__: "Versión",
  __signed_document__: "Documento firmado",
  __administrative_status__: "Estado administrativo (anulación o reactivación)",
  __historical_import__: "Importación histórica",
  relations: "Relaciones",
  followups: "Seguimientos",
};
export const historyFieldLabel = (fieldPath: string) => technicalFieldLabels[fieldPath] ?? fieldPath;

const versionLabel = (sequence: number) => `V${String(sequence).padStart(2, "0")}`;

/** Máximo de entradas por fuente: la cronología es una vista de consulta, no una exportación. */
export const TIMELINE_LIMIT_PER_SOURCE = 200;

/**
 * Cronología operativa de un expediente QmsRecord: historial de cambios, versiones y
 * seguimientos, documentos generados y recibidos, y relaciones. Solo lectura. No es el
 * audit trail GMP (que vive en su propia pestaña) y no sustituye a ninguna de esas fuentes.
 */
export async function getRecordTimeline(qmsRecordId: string): Promise<TimelineEntry[]> {
  const take = TIMELINE_LIMIT_PER_SOURCE;
  const [history, versions, generated, signed, relations] = await Promise.all([
    prisma.changeHistory.findMany({
      where: { qmsRecordId },
      select: { id: true, changedAt: true, changedByText: true, fieldPath: true, reason: true, source: true },
      orderBy: { changedAt: "desc" },
      take,
    }),
    prisma.qmsRecordVersion.findMany({
      where: { qmsRecordId },
      select: { id: true, createdAt: true, createdByText: true, sequenceNumber: true, kind: true, reason: true, frozenAt: true },
      orderBy: { createdAt: "desc" },
      take,
    }),
    prisma.generatedDocument.findMany({
      where: { qmsRecordId },
      select: { id: true, generatedAt: true, generatedByText: true, documentType: true, fileName: true, recordVersion: { select: { sequenceNumber: true } } },
      orderBy: { generatedAt: "desc" },
      take,
    }),
    prisma.recordVersionDocument.findMany({
      where: { recordVersion: { qmsRecordId } },
      select: { id: true, uploadedAt: true, uploadedByText: true, kind: true, fileName: true, recordVersion: { select: { sequenceNumber: true } } },
      orderBy: { uploadedAt: "desc" },
      take,
    }),
    prisma.qmsRelation.findMany({
      where: { OR: [{ sourceRecordId: qmsRecordId }, { targetRecordId: qmsRecordId }] },
      select: {
        id: true, createdAt: true, createdByText: true, isActive: true, sourceRecordId: true,
        sourceRecord: { select: { recordType: true, businessCode: true, annulledBusinessCode: true } },
        targetRecord: { select: { recordType: true, businessCode: true, annulledBusinessCode: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
    }),
  ]);

  const entries: TimelineEntry[] = [
    ...history.map((row) => ({
      id: `change:${row.id}`, at: row.changedAt, kind: "CHANGE" as const, actor: row.changedByText,
      title: historyFieldLabel(row.fieldPath),
      detail: [row.reason ? `Motivo: ${row.reason}` : null, row.source !== "UI" ? `Origen: ${row.source}` : null].filter(Boolean).join(" · ") || null,
    })),
    ...versions.map((row) => ({
      id: `version:${row.id}`, at: row.createdAt, kind: "VERSION" as const, actor: row.createdByText,
      title: `${versionLabel(row.sequenceNumber)} · ${versionKindLabels[row.kind]}`,
      detail: [row.reason, row.frozenAt ? "Versión congelada" : null].filter(Boolean).join(" · ") || null,
    })),
    ...generated.map((row) => ({
      id: `document:${row.id}`, at: row.generatedAt, kind: "DOCUMENT" as const, actor: row.generatedByText,
      title: documentTypeLabel(row.documentType) + (row.recordVersion ? ` · ${versionLabel(row.recordVersion.sequenceNumber)}` : ""),
      detail: row.fileName,
    })),
    ...signed.map((row) => ({
      id: `signed:${row.id}`, at: row.uploadedAt, kind: "SIGNED_DOCUMENT" as const, actor: row.uploadedByText,
      title: `${signedKindLabels[row.kind]} · ${versionLabel(row.recordVersion.sequenceNumber)}`,
      detail: row.fileName,
    })),
    ...relations.map((row) => {
      const other = row.sourceRecordId === qmsRecordId ? row.targetRecord : row.sourceRecord;
      return {
        id: `relation:${row.id}`, at: row.createdAt, kind: "RELATION" as const, actor: row.createdByText,
        title: `${qmsRecordTypeLabel(other.recordType)} ${qmsRecordDisplayCode(other)}`,
        detail: row.isActive ? null : "Relación retirada después (la fecha es la de creación)",
      };
    }),
  ];
  return entries.sort((a, b) => b.at.getTime() - a.at.getTime());
}
