import { createHash } from "node:crypto";
import { z } from "zod";
import { canonicalAuditJson } from "@/lib/audit/canonical-json";
import { safeSignedPdfFileName } from "@/lib/qms/signed-version-document";
import { dateInput } from "./finding-validation";
import type { AuditReportSnapshot } from "./report-service";

/** D-110 (R5C): numeración propia del CAPA plan, 00, 01…, independiente del informe. */
export const capaPlanSequenceLabel = (sequence: number) => String(sequence).padStart(2, "0");
export const capaPlanFileName = (code: string | null, sequence: number) =>
  safeSignedPdfFileName(`${code || "Auditoria_sin_codigo"}_CAPA_PLAN_${capaPlanSequenceLabel(sequence)}.xlsx`);
/** Al establecer la 00 se propone la fecha del CAPA plan ya registrada (expedientes antiguos) o la de hoy. */
export const capaPlanDefaultDate = (existing: Date | null, today: string) => existing ? existing.toISOString().slice(0, 10) : today;
/** Fecha de hoy en Madrid (no en UTC): entre las 00:00 y las 02:00 la fecha UTC aún es la de ayer. */
export const capaPlanToday = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
export const capaPlanKindLabels = { ESTABLISHED: "Establecido", FOLLOWUP: "Seguimiento" } as const;

type SnapshotFinding = AuditReportSnapshot["audit"]["findings"][number];
const pick = <T extends object, K extends keyof T>(value: T, keys: readonly K[]) => Object.fromEntries(keys.map(key => [key, value[key] ?? null]));
const findingKeys = ["reference", "findingType", "criticality", "description", "treatment", "treatmentStatus", "closedAt", "evidence", "evidenceReference", "verificationComment"] as const;
const actionKeys = ["description", "responsible", "targetDate", "status", "closedAt", "evidence", "evidenceReference", "verificationComment"] as const;
/** Contenido del CAPA plan (hallazgos, acciones y vínculos activos), sin autoría ni fechas de edición. */
export function capaPlanFingerprint(snapshot: AuditReportSnapshot) {
  const findings = snapshot.audit.findings.filter(f => f.isActive).map((f: SnapshotFinding) => ({
    ...pick(f, findingKeys),
    actions: f.actions.filter(a => a.isActive).map(a => pick(a, actionKeys)),
    links: f.relations.filter(r => r.isActive && r.qmsRelation.isActive).map(r => ({
      code: r.qmsRelation.targetRecord.businessCode ?? r.qmsRelation.targetRecord.annulledBusinessCode ?? r.qmsRelation.targetRecord.id,
      capa: r.qmsRelation.targetRecord.capa?.status ?? null, deviation: r.qmsRelation.targetRecord.deviation?.status ?? null,
    })),
  }));
  return createHash("sha256").update(canonicalAuditJson({ capaPlanDate: snapshot.audit.capaPlanDate ?? null, findings })).digest("hex");
}
export const establishCapaPlanSchema = z.object({
  requestId: z.string().uuid("Solicitud no válida. Recarga la auditoría."),
  capaPlanDate: dateInput.refine(Boolean, "Indica la fecha del CAPA plan."),
  actor: z.string().trim().min(1, "Indica el responsable.").max(200),
});

// R5C2: seguimiento del CAPA plan. El formulario envía una fila por acción activa
// (a.<id>.<campo>) y por hallazgo activo sin acciones (f.<id>.<campo>).
const actionFields = ["status", "closedAt", "targetDate", "evidenceReference", "evidence", "updatedAt"] as const;
const findingFields = ["treatmentStatus", "treatment", "closedAt", "evidenceReference", "evidence", "updatedAt"] as const;
export type CapaPlanActionRow = { id: string } & Record<typeof actionFields[number], string>;
export type CapaPlanFindingRow = { id: string } & Record<typeof findingFields[number], string>;
function rows<K extends string>(fd: Record<string, string>, prefix: string, fields: readonly K[]) {
  const ids = [...new Set(Object.keys(fd).filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length).split(".")[0]))];
  // El estado se conserva tal cual (un valor no canónico es inválido); los textos se recortan y usan saltos \n.
  const clean = (field: string, value: string) => /status$/i.test(field) ? value : value.replace(/\r\n?/g, "\n").trim();
  return ids.map(id => ({ id, ...Object.fromEntries(fields.map(field => [field, clean(field, fd[`${prefix}${id}.${field}`] ?? "")])) }) as { id: string } & Record<K, string>);
}
export function parseCapaPlanFollowupForm(fd: Record<string, string>) {
  const text = (key: string) => (fd[key] ?? "").trim();
  return { followupDate: text("followupDate"), nextReviewDate: text("nextReviewDate"), observations: text("observations"), changeReason: text("changeReason"), actor: text("actor"), requestId: text("requestId"),
    actions: rows(fd, "a.", actionFields) as CapaPlanActionRow[], findings: rows(fd, "f.", findingFields) as CapaPlanFindingRow[] };
}
export const capaPlanFollowupSchema = z.object({
  requestId: z.string().uuid("Solicitud no válida. Recarga la auditoría."),
  followupDate: dateInput.refine(Boolean, "Indica la fecha del seguimiento."),
  nextReviewDate: dateInput,
  observations: z.string().max(20000),
  changeReason: z.string().max(20000),
  actor: z.string().min(1, "Indica el responsable.").max(200),
});
const statuses = ["OPEN", "IN_PROGRESS", "PENDING_VERIFICATION", "CLOSED", "NOT_APPLICABLE"];
const terminal = (status: string) => status === "CLOSED" || status === "NOT_APPLICABLE";
/** Validaciones de cierre de siempre (finding-validation) aplicadas a una fila; `treatment` solo en hallazgos. */
export function capaPlanRowProblem(row: { status: string; closedAt: string; evidence: string; evidenceReference: string; verificationComment: string; treatment?: string; targetDate?: string }) {
  if (!statuses.includes(row.status)) return "Estado no válido.";
  if (row.targetDate && !dateInput.safeParse(row.targetDate).success) return "Fecha objetivo no válida.";
  if (row.closedAt && !dateInput.safeParse(row.closedAt).success) return "Fecha de cierre no válida.";
  if (row.status === "CLOSED" && !row.closedAt) return "El cierre requiere fecha.";
  if (terminal(row.status) && !row.evidence && !row.evidenceReference && !row.verificationComment) return "El cierre o la no aplicación requieren evidencia, referencia o comentario.";
  if (terminal(row.status) && row.treatment !== undefined && !row.treatment) return "Indica el tratamiento o justificación del hallazgo.";
  return null;
}
/** Una fila cambió en la base desde que se abrió el formulario: hay que recargar antes de guardar. */
export class CapaPlanStaleError extends Error {}
/** Cambios que el audit trail trata como decisión crítica y exigen motivo. */
export function isCriticalRowChange(before: { status: string; closedAt: string | null; evidence?: string | null }, after: { status: string; closedAt: string | null; evidence?: string | null }) {
  if (before.status !== after.status && (terminal(before.status) || terminal(after.status))) return true;
  if (Boolean(before.closedAt) && before.closedAt !== after.closedAt) return true;
  // La evidencia es campo crítico en la captura B2: corregir una ya registrada exige motivo.
  return Boolean(before.evidence) && (before.evidence ?? null) !== (after.evidence ?? null);
}
