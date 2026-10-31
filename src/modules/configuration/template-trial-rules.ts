import type { DocumentType } from "@prisma/client";

/**
 * D-129: «Probar con un expediente». Qué pide la prueba de cada anexo antes de generarse:
 * - record: un expediente del módulo (por defecto, el último modificado que no esté en borrador ni anulado);
 * - year: un año (listados anuales y programas de auditoría; por defecto, el año en curso).
 * Los tipos que no están aquí (listados simples, adjuntos, evidencias) no tienen plantilla que probar.
 */
const TRIAL_KINDS: Partial<Record<DocumentType, "record" | "year">> = {
  DEVIATION_ANNEX_III: "record",
  DEVIATION_ANNEX_V: "year",
  CAPA_ANNEX_III: "record",
  CAPA_ANNEX_IV: "year",
  CHANGE_ANNEX_III: "record",
  CHANGE_ANNEX_IV: "record",
  CHANGE_ANNEX_V: "record",
  CHANGE_ANNEX_VII: "year",
  COMPLAINT_ANNEX_III: "record",
  COMPLAINT_ANNEX_IV: "record",
  COMPLAINT_ANNEX_V: "year",
  RETURN_ANNEX_III: "record",
  RETURN_ANNEX_IV: "record",
  RETURN_ANNEX_V: "record",
  RETURN_ANNEX_VI: "year",
  OOS_ANNEX_III: "record",
  OOS_ANNEX_IV: "record",
  OOS_ANNEX_VI: "year",
  AUDIT_INTERNAL_REPORT: "record",
  AUDIT_EXTERNAL_REPORT: "record",
  AUDIT_CAPA_PLAN: "record",
  AUDIT_EXTERNAL_PLAN: "record",
  AUDIT_ANNUAL_INTERNAL_PROGRAMME: "year",
  AUDIT_ANNUAL_EXTERNAL_PROGRAMME: "year",
};

export function trialKind(documentType: DocumentType) {
  return TRIAL_KINDS[documentType] ?? null;
}

export class TemplateTrialError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
  }
}

export type TrialReference = { kind: "record"; code: string | null } | { kind: "year"; year: number; explicit: boolean };

/** Lee lo que escribe el usuario: un código de expediente o un año. Vacío = valor por defecto. */
export function parseTrialReference(documentType: DocumentType, raw: string | null, now = new Date()): TrialReference {
  const kind = trialKind(documentType);
  if (!kind) throw new TemplateTrialError("Este documento no tiene una plantilla que se pueda probar con un expediente.", 400);
  const value = (raw ?? "").trim();
  if (kind === "record") {
    if (value.length > 80) throw new TemplateTrialError("El código del expediente es demasiado largo.", 400);
    return { kind, code: value || null };
  }
  if (!value) return { kind, year: now.getFullYear(), explicit: false };
  const year = /^\d{4}$/.test(value) ? Number(value) : NaN;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new TemplateTrialError("Indica un año válido (por ejemplo, 2026).", 400);
  return { kind, year, explicit: true };
}

/** Nombre del archivo de prueba: empieza por «PRUEBA» para que no se confunda con un documento del expediente. */
export function trialFileName(documentType: DocumentType, versionCode: string, subject: string, extension: "docx" | "xlsx") {
  const safe = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return `PRUEBA_${documentType}_v${safe(versionCode)}_${safe(subject) || "sin_codigo"}.${extension}`;
}
