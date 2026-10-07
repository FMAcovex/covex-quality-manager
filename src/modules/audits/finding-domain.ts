import type { AuditActionStatus, AuditFindingCriticality, AuditFindingType } from "@prisma/client";

export const findingTypeLabels: Record<AuditFindingType, string> = { FINDING: "Hallazgo", RECOMMENDATION: "Recomendación", CLIENT_OBSERVATION: "Observación de cliente", AUTHORITY_OBSERVATION: "Observación de autoridad" };
export const criticalityLabels: Record<AuditFindingCriticality, string> = { CRITICAL: "Crítica", MAJOR: "Mayor", MINOR: "Menor", NA: "No aplica" };
export const actionStatusLabels: Record<AuditActionStatus, string> = { OPEN: "Abierta", IN_PROGRESS: "En curso", PENDING_VERIFICATION: "Pendiente de verificación", CLOSED: "Cerrada", NOT_APPLICABLE: "No procede" };
export const pendingActionStatuses: AuditActionStatus[] = ["OPEN", "IN_PROGRESS", "PENDING_VERIFICATION"];
export const isTerminalAction = (status: AuditActionStatus) => status === "CLOSED" || status === "NOT_APPLICABLE";
export const findingPrefix = (type: AuditFindingType) => type === "RECOMMENDATION" ? "Rk" : "OBS";
export function nextFindingReference(type: AuditFindingType, reserved: string[]) {
  const prefix = findingPrefix(type), pattern = new RegExp(`^${prefix} (\\d+)$`);
  const max = reserved.reduce((n, reference) => Math.max(n, Number(pattern.exec(reference)?.[1] ?? 0)), 0);
  return `${prefix} ${String(max + 1).padStart(2, "0")}`;
}
export type FindingState = { treatment: string | null; treatmentStatus: AuditActionStatus; actions: { status: AuditActionStatus; isActive: boolean }[] };
export function findingSituation(finding: FindingState) {
  const actions = finding.actions.filter(a => a.isActive);
  if (!actions.length) {
    if (!finding.treatment?.trim()) return "Pendiente de tratamiento";
    if (isTerminalAction(finding.treatmentStatus)) return "Tratado";
    return actionStatusLabels[finding.treatmentStatus];
  }
  if (actions.every(a => isTerminalAction(a.status))) return "Tratado";
  if (actions.some(a => a.status === "OPEN" || a.status === "IN_PROGRESS")) return "En curso";
  return "Pendiente de verificación";
}
export function auditFollowupSituation(audit: { status: string; performedDate: Date | string | null; findings?: (FindingState & { isActive: boolean })[]; followups?: unknown[] }) {
  if (audit.status === "CLOSED") return "Cerrada";
  if (audit.status === "DRAFT") return "Borrador";
  const findings = audit.findings?.filter(f => f.isActive) ?? [];
  // Partial closure describes a recorded local treatment plan, never definitive closure or effectiveness.
  if (findings.length && findings.every(f => Boolean(f.treatment?.trim()) || f.actions.some(a => a.isActive)) && findings.some(f => f.actions.some(a => a.isActive && !isTerminalAction(a.status)))) return "Cierre parcial";
  if (findings.length || audit.followups?.length) return "En seguimiento";
  return audit.performedDate ? "Realizada · informe pendiente" : "Planificada";
}
export const auditAnchor = (kind: "finding" | "action" | "followup", id: string) => `audit-${kind}-${id}`;
