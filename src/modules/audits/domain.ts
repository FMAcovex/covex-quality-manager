import type { AuditScenario, AuditStatus, AuditType } from "@prisma/client";

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
export const auditRoleLabels = { LEAD_AUDITOR: "Auditor jefe", AUDITOR: "Auditor", AUDITEE: "Personal auditado / interlocutor" } as const;
export const auditQualityLabels = { COMPLETE: "Completo", INCOMPLETE: "Incompleto", REVIEW_REQUIRED: "Requiere revisión" } as const;

export function compatibleAuditScenario(type: AuditType | null, scenario: AuditScenario | null) {
  if (!type || !scenario) return true; // Partial drafts; opening validates both.
  return type === "INTERNAL" ? ["INTERNAL_COVEX", "INTERNAL_CONTRACTED"].includes(scenario) : ["SUPPLIER", "CLIENT", "AUTHORITY"].includes(scenario);
}
export function hasAuditBusinessSeries(scenario: AuditScenario | null) {
  return scenario === "INTERNAL_COVEX" || scenario === "INTERNAL_CONTRACTED" || scenario === "SUPPLIER";
}
export function auditSituation(audit: { status: AuditStatus; performedDate: Date | string | null }) {
  if (audit.status === "CLOSED") return "Cerrada";
  if (audit.status === "DRAFT") return "Borrador";
  return audit.performedDate ? "Realizada" : "Planificada";
}
export function auditDate(value: Date | string | null | undefined) {
  return value ? new Intl.DateTimeFormat("es-ES", { timeZone: "UTC" }).format(new Date(value)) : "—";
}
export function auditCodeYear(values: { plannedDate: string; openedAt: string; performedDate: string }) {
  const date = values.plannedDate || values.openedAt || values.performedDate;
  return date ? Number(date.slice(0, 4)) : null;
}
