import type { ChangeControl, ChangeControlTask, QmsRecord } from "@prisma/client";
import { orderedTextTables, storedTextTables } from "@/lib/forms/text-tables";
import type { parseChangeControlForm } from "./validation";
import { CHANGE_CONTROL_TABLE_FIELDS } from "./text-tables";
import { scopeLabels } from "./domain";
import { cleanText } from "@/lib/forms/bullets";

type FormValues = ReturnType<typeof parseChangeControlForm>["values"];
type TaskLike = {
  departmentId: string | null;
  description: string;
  responsible: string | null;
  responsibleUserId?: string | null;
  plannedDate: string;
};

const day = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;
const SCOPE_ORDER = Object.keys(scopeLabels);
/** Alcance en el orden del formulario (el navegador envía las casillas en ese orden). */
const orderedScope = <T extends string>(scope: T[]) => [...scope].sort((a, b) => SCOPE_ORDER.indexOf(a) - SCOPE_ORDER.indexOf(b));

/**
 * Textos en la forma en que llegan del formulario: saltos de línea LF (el envío los convierte en CRLF),
 * sin viñetas vacías ni espacios en los extremos. Así no cuentan como cambio los datos guardados fuera del
 * formulario (semillas, importación).
 */
function normalizeTexts<T extends Record<string, unknown>>(snapshot: T): T {
  return Object.fromEntries(Object.entries(snapshot).map(([key, value]) =>
    [key, typeof value === "string" ? cleanText(value.replace(/\r\n?/g, "\n")) : value])) as T;
}

/** Acciones del dictamen para el historial: sin identificadores (se recrean al guardar) y con la misma forma. */
function taskSnapshot(tasks: TaskLike[]) {
  return tasks.map((item) => ({
    departmentId: item.departmentId ?? "",
    description: item.description,
    responsible: item.responsible ?? "",
    responsibleUserId: item.responsibleUserId ?? null,
    plannedDate: item.plannedDate,
  }));
}

/** Valores del formulario que se comparan para el historial de modificaciones (operativo, no audit trail GMP). */
export function scalarSnapshot(v: FormValues) {
  return normalizeTexts({
    businessCode: v.businessCode,
    departmentId: v.departmentId,
    requestDate: v.requestDate,
    requesterName: v.requesterName,
    requesterPosition: v.requesterPosition,
    scope: orderedScope(v.scope),
    otherScope: v.otherScope,
    description: v.description,
    justification: v.justification,
    providedDocuments: v.providedDocuments,
    requestDecision: v.requestDecision,
    requestDecisionResponsible: v.requestDecisionResponsible,
    requestDecisionResponsibleUserId: v.requestDecisionResponsibleUserId,
    requestDecisionRole: v.requestDecisionRole,
    requestDecisionDate: v.requestDecisionDate,
    evaluation: v.evaluation,
    classification: v.classification,
    plannedImplementationDate: v.plannedImplementationDate,
    committeeRequired: v.committeeRequired,
    committeeDetails: v.committeeDetails,
    clientNotificationRequired: v.clientNotificationRequired,
    clientNotificationDetails: v.clientNotificationDetails,
    authorityRequired: v.authorityRequired,
    authorityDetails: v.authorityDetails,
    pqrRequired: v.pqrRequired,
    pqrProducts: v.pqrProducts,
    pqrPeriod: v.pqrPeriod,
    stabilityRequired: v.stabilityRequired,
    stabilityAccelerated: v.stabilityAccelerated,
    stabilityOngoing: v.stabilityOngoing,
    additionalAnalysisRequired: v.additionalAnalysisRequired,
    additionalAnalysisDetails: v.additionalAnalysisDetails,
    additionalValidationRequired: v.additionalValidationRequired,
    additionalValidationDetails: v.additionalValidationDetails,
    otherImplicationRequired: v.otherImplicationRequired,
    otherImplicationDetails: v.otherImplicationDetails,
    dictamenResult: v.dictamenResult,
    dictamenDate: v.dictamenDate,
    followupResponsible: v.followupResponsible,
    followupResponsibleUserId: v.followupResponsibleUserId,
    dictamenObservations: v.dictamenObservations,
    internalObservations: v.internalObservations,
    textTables: orderedTextTables(v.textTables, CHANGE_CONTROL_TABLE_FIELDS),
    signedDocumentAvailable: v.signedDocumentAvailable,
    dataQualityStatus: v.dataQualityStatus,
    finalStatus: v.finalStatus,
    tasks: taskSnapshot(v.tasks),
  });
}

/**
 * Lo guardado con la misma forma que `scalarSnapshot`: mismas claves, fechas como AAAA-MM-DD, tablas
 * normalizadas y acciones del dictamen sin identificadores. Guardar sin cambios no anota nada.
 */
export function storedScalarSnapshot(
  existing: ChangeControl & { qmsRecord: Pick<QmsRecord, "businessCode">; tasks: ChangeControlTask[] },
): ReturnType<typeof scalarSnapshot> {
  return normalizeTexts({
    businessCode: existing.qmsRecord.businessCode,
    departmentId: existing.departmentId,
    requestDate: day(existing.requestDate),
    requesterName: existing.requesterName,
    requesterPosition: existing.requesterPosition,
    scope: orderedScope(existing.scope),
    otherScope: existing.otherScope,
    description: existing.description,
    justification: existing.justification,
    providedDocuments: existing.providedDocuments,
    requestDecision: existing.requestDecision,
    requestDecisionResponsible: existing.requestDecisionResponsible,
    requestDecisionResponsibleUserId: existing.requestDecisionResponsibleUserId,
    requestDecisionRole: existing.requestDecisionRole,
    requestDecisionDate: day(existing.requestDecisionDate),
    evaluation: existing.evaluation,
    classification: existing.classification,
    plannedImplementationDate: day(existing.plannedImplementationDate),
    committeeRequired: existing.committeeRequired,
    committeeDetails: existing.committeeDetails,
    clientNotificationRequired: existing.clientNotificationRequired,
    clientNotificationDetails: existing.clientNotificationDetails,
    authorityRequired: existing.authorityRequired,
    authorityDetails: existing.authorityDetails,
    pqrRequired: existing.pqrRequired,
    pqrProducts: existing.pqrProducts,
    pqrPeriod: existing.pqrPeriod,
    stabilityRequired: existing.stabilityRequired,
    stabilityAccelerated: existing.stabilityAccelerated,
    stabilityOngoing: existing.stabilityOngoing,
    additionalAnalysisRequired: existing.additionalAnalysisRequired,
    additionalAnalysisDetails: existing.additionalAnalysisDetails,
    additionalValidationRequired: existing.additionalValidationRequired,
    additionalValidationDetails: existing.additionalValidationDetails,
    otherImplicationRequired: existing.otherImplicationRequired,
    otherImplicationDetails: existing.otherImplicationDetails,
    dictamenResult: existing.dictamenResult,
    dictamenDate: day(existing.dictamenDate),
    followupResponsible: existing.followupResponsible,
    followupResponsibleUserId: existing.followupResponsibleUserId,
    dictamenObservations: existing.dictamenObservations,
    internalObservations: existing.internalObservations,
    // Normalizado para comparar sin el orden de claves de JSONB (un objeto sin tablas válidas es «sin tablas»);
    // si no es un objeto, el valor bruto.
    textTables: orderedTextTables(storedTextTables(existing.textTables), CHANGE_CONTROL_TABLE_FIELDS)
      ?? (existing.textTables && typeof existing.textTables === "object" && !Array.isArray(existing.textTables) ? null : (existing.textTables as never) ?? null),
    signedDocumentAvailable: existing.signedDocumentAvailable,
    dataQualityStatus: existing.dataQualityStatus,
    finalStatus: existing.finalStatus,
    tasks: taskSnapshot(existing.tasks
      .filter((item) => item.origin === "DICTAMEN")
      .map((item) => ({ ...item, plannedDate: day(item.plannedDate) ?? "" }))),
  });
}
