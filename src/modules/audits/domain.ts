import { auditFollowupSituation } from "./finding-domain";
import type { FindingState } from "./finding-domain";
import type { AuditFindingType, AuditScenario, AuditStatus, AuditType } from "@prisma/client";

export const auditTypeLabels = { INTERNAL: "Interna", EXTERNAL: "Externa" } as const;
export const auditScenarioLabels = {
  INTERNAL_COVEX: "Interna · personal COVEX",
  INTERNAL_CONTRACTED: "Interna · auditor externo contratado",
  SUPPLIER: "COVEX a proveedor/tercero",
  CLIENT: "Cliente a COVEX",
  AUTHORITY: "Inspección de autoridad/organismo",
} as const;
export const auditModalityLabels = { ONSITE: "Presencial", REMOTE: "Remota", HYBRID: "Mixta" } as const;
export const auditStatusLabels = { DRAFT: "Borrador", OPEN: "Abierta", CLOSED: "Cerrada" } as const;
/** Color del estado en listados y cabecera, como en Desviaciones. */
export const auditStatusBadgeClass = (status: keyof typeof auditStatusLabels) => status === "DRAFT" ? "neutral" : status === "OPEN" ? "open" : "closed";
export const auditRoleLabels = { LEAD_AUDITOR: "Auditor jefe", AUDITOR: "Auditor", AUDITEE: "Personal auditado / interlocutor" } as const;
export const auditQualityLabels = { COMPLETE: "Completo", INCOMPLETE: "Incompleto", REVIEW_REQUIRED: "Requiere revisión" } as const;

export function compatibleAuditScenario(type: AuditType | null, scenario: AuditScenario | null) {
  if (!type || !scenario) return true; // Partial drafts; opening validates both.
  return type === "INTERNAL" ? ["INTERNAL_COVEX", "INTERNAL_CONTRACTED"].includes(scenario) : ["SUPPLIER", "CLIENT", "AUTHORITY"].includes(scenario);
}
export function hasAuditBusinessSeries(scenario: AuditScenario | null) {
  return scenario === "INTERNAL_COVEX" || scenario === "INTERNAL_CONTRACTED" || scenario === "SUPPLIER";
}
export function auditSituation(audit: { status: AuditStatus; performedDate: Date | string | null; findings?: (FindingState & {isActive:boolean})[]; followups?: unknown[]; reportIssued?: boolean; capaPlanEstablishedAt?: Date | string | null; reportSentAt?: Date | string | null; scenario?: AuditScenario | null }) {
  if (audit.status === "CLOSED") return "Cerrada";
  // D-110: el cierre parcial es el CAPA plan establecido (internas) o el informe enviado (proveedor).
  if (audit.status !== "DRAFT" && (audit.scenario === "SUPPLIER" ? audit.reportSentAt : audit.scenario?.startsWith("INTERNAL") && audit.capaPlanEstablishedAt)) return "Cierre parcial";
  if (audit.reportIssued) {
    if (audit.findings?.some(f=>f.isActive && f.actions.some(a=>a.isActive && !["CLOSED","NOT_APPLICABLE"].includes(a.status))) || audit.followups?.length) return "En seguimiento";
    return "Informe emitido";
  }
  if (audit.reportIssued === false) return audit.status === "DRAFT" ? "Borrador" : audit.performedDate ? "Realizada · informe pendiente" : "Planificada";
  return auditFollowupSituation(audit);
}
export function auditDate(value: Date | string | null | undefined) {
  return value ? new Intl.DateTimeFormat("es-ES", { timeZone: "UTC" }).format(new Date(value)) : "—";
}
export function auditCodeYear(values: { plannedDate: string; openedAt: string; performedDate: string }) {
  const date = values.plannedDate || values.openedAt || values.performedDate;
  return date ? Number(date.slice(0, 4)) : null;
}
/** D-110 (R5D): en cliente e inspección el informe es el recibido; no se emite informe COVEX. */
export const receivedAuditScenario = (scenario: AuditScenario | null | undefined) => scenario === "CLIENT" || scenario === "AUTHORITY";
/** Tipos de hallazgo que se registran a mano en cada escenario (D-110, R5D). */
export function allowedFindingTypes(scenario: AuditScenario | null | undefined): AuditFindingType[] {
  if (scenario === "CLIENT") return ["CLIENT_OBSERVATION", "RECOMMENDATION"];
  if (scenario === "AUTHORITY") return ["AUTHORITY_OBSERVATION", "RECOMMENDATION"];
  return ["FINDING", "RECOMMENDATION"];
}
