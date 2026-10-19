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
