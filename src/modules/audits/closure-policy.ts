import type { AuditScenario, AuditActionStatus } from "@prisma/client";
export type ClosureFinding = {
  id: string; reference: string; isActive: boolean; criticality: string;
  treatment: string | null; treatmentStatus: AuditActionStatus;
  evidence: string | null; evidenceReference: string | null; verificationComment: string | null;
  actions: { isActive: boolean; status: AuditActionStatus; evidence: string | null; evidenceReference: string | null; verificationComment: string | null }[];
};
export type ClosureContext = {
  scenario: AuditScenario | null; status: string; isActive: boolean;
  reportIssued: boolean; primaryDocument: boolean;
  capaPlanEstablishedAt: Date | string | null; reportSentAt: Date | string | null;
  supplierResponseReceivedAt: Date | string | null; responseRequired: boolean;
  responseSentAt: Date | string | null;
  findings: ClosureFinding[]; capaPlanVersions: number; capaPlanOutdated: boolean; signedPdf: boolean;
};
const terminal = (s: string) => s === "CLOSED" || s === "NOT_APPLICABLE";
const evidenced = (x: { evidence: string | null; evidenceReference: string | null; verificationComment: string | null }) => Boolean(x.evidence?.trim() || x.evidenceReference?.trim() || x.verificationComment?.trim());
/**
 * D-110 (R5C2): basta con las acciones activas cerradas o no aplicables con evidencia,
 * referencia o justificación, y cada hallazgo tratado. Las Desviaciones y CAPA vinculadas
 * siguen su propio ciclo y no bloquean; tampoco la verificación de cada acción.
 */
export function auditClosureChecklist(c: ClosureContext, exception = false) {
  const internal = c.scenario === "INTERNAL_COVEX" || c.scenario === "INTERNAL_CONTRACTED";
  const received = c.scenario === "CLIENT" || c.scenario === "AUTHORITY";
  const active = c.findings.filter(f => f.isActive), blockers: string[] = [], warnings: string[] = [];
  if (!c.isActive) blockers.push("Reactiva el expediente antes de cerrar.");
  if (c.status === "DRAFT") blockers.push("Abre la auditoría antes de cerrar.");
  if (!received && !c.reportIssued) blockers.push("Emite una versión formal del informe.");
  if (received && !c.primaryDocument) blockers.push("Adjunta el informe o acta recibido (documento primario).");
  if (received && c.responseRequired && !c.responseSentAt) blockers.push("Registra el envío de la respuesta requerida.");
  if (exception) {
    if (c.scenario !== "SUPPLIER") blockers.push("La excepción solo aplica a proveedor/tercero.");
    if (c.supplierResponseReceivedAt) blockers.push("La excepción exige ausencia de respuesta CAPA del proveedor.");
    if (active.some(f => f.criticality === "CRITICAL")) blockers.push("Hay hallazgos críticos: la excepción está prohibida.");
  } else {
    if (active.length && !c.capaPlanVersions) blockers.push("Establece el CAPA plan (versión 00) en Seguimiento.");
    for (const f of active) {
      const actions = f.actions.filter(a => a.isActive);
      for (const a of actions) {
        if (!terminal(a.status)) blockers.push(`${f.reference}: acción pendiente de cerrar o dar por no aplicable.`);
        else if (!evidenced(a)) blockers.push(`${f.reference}: acción sin evidencia, referencia ni justificación.`);
      }
      if (!actions.length && (!terminal(f.treatmentStatus) || !f.treatment?.trim() || !evidenced(f))) blockers.push(`${f.reference}: sin acciones; registra el tratamiento o la justificación, cerrado o no aplicable, con evidencia o referencia.`);
    }
    if (c.capaPlanVersions && c.capaPlanOutdated) warnings.push("La última versión del CAPA plan no refleja el estado actual: se recomienda registrar un seguimiento final antes de cerrar.");
  }
  if (!received && !c.signedPdf) warnings.push("PDF firmado esperado no disponible; no es requisito absoluto de cierre en la aplicación.");
  return { blockers: [...new Set(blockers)], warnings, partial: internal ? Boolean(c.capaPlanEstablishedAt) : c.scenario === "SUPPLIER" ? Boolean(c.reportSentAt) : false };
}
