import type { AuditStatus, DocumentType } from "@prisma/client";

/**
 * Motivo por el que no se puede generar un documento de auditoría, o null si se puede (R5A).
 * El CAPA Plan del estado actual es un documento de trabajo: se genera también en borrador.
 */
export function auditDocumentBlocker({ status, type, sequence }: { status: AuditStatus; type: DocumentType; sequence: number | null }): string | null {
  const currentCapaPlan = type === "AUDIT_CAPA_PLAN" && sequence === null;
  if (status === "DRAFT" && !currentCapaPlan) return "Abre la auditoría antes de generar documentos operativos.";
  if (sequence === null && type !== "AUDIT_CAPA_PLAN" && type !== "AUDIT_EXTERNAL_PLAN") return "El informe se genera desde una versión formal concreta.";
  return null;
}
