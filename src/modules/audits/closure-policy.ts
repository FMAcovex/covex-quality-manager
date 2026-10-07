import type { AuditScenario, AuditActionStatus, CapaEffectivenessStatus } from "@prisma/client";
export type ClosureFinding = {
  id: string; reference: string; isActive: boolean; criticality: string;
  treatment: string | null; treatmentStatus: AuditActionStatus;
  evidence: string | null; evidenceReference: string | null; verificationComment: string | null;
  actions: { isActive: boolean; status: AuditActionStatus; evidence: string | null; evidenceReference: string | null; verificationComment: string | null; verificationResult: CapaEffectivenessStatus; verifiedAt: Date | string | null; verifiedBy: string | null }[];
  relations: { isActive: boolean; qmsRelation: { isActive: boolean; targetRecord: { isActive: boolean; capa: { status: string; effectivenessStatus: CapaEffectivenessStatus } | null } } }[];
};
export type ClosureContext = {
  scenario: AuditScenario | null; status: string; isActive: boolean;
  reportIssued: boolean; conclusion: string | null; primaryDocument: boolean;
  capaPlanEstablishedAt: Date | string | null; reportSentAt: Date | string | null;
  supplierResponseReceivedAt: Date | string | null; responseRequired: boolean;
  responseSentAt: Date | string | null; closureEvidence: string | null;
  findings: ClosureFinding[]; pendingFollowups: boolean; signedPdf: boolean;
};
const terminal = (s: string) => s === "CLOSED" || s === "NOT_APPLICABLE";
export function auditClosureChecklist(c: ClosureContext, exception = false) {
  const internal = c.scenario === "INTERNAL_COVEX" || c.scenario === "INTERNAL_CONTRACTED";
  const received = c.scenario === "CLIENT" || c.scenario === "AUTHORITY";
  const active = c.findings.filter(f => f.isActive), blockers: string[] = [];
  if (!c.isActive) blockers.push("Reactiva el expediente antes de cerrar.");
  if (c.status === "DRAFT") blockers.push("Abre la auditoría antes de cerrar.");
  if (!c.reportIssued) blockers.push("Emite una versión formal del informe.");
  if (!c.conclusion?.trim()) blockers.push("Completa la conclusión del informe.");
  if (received && !c.primaryDocument) blockers.push("Registra el documento externo primario.");
  if (received && c.responseRequired && !c.responseSentAt) blockers.push("Registra el envío de la respuesta requerida.");
  if (received && !c.closureEvidence?.trim()) blockers.push("Registra la evidencia de cierre.");
  if (c.scenario === "SUPPLIER" && !c.reportSentAt) blockers.push("Registra el envío del informe final al proveedor.");
  if (exception) {
    if (c.scenario !== "SUPPLIER") blockers.push("La excepción solo aplica a proveedor/tercero.");
    if (c.supplierResponseReceivedAt) blockers.push("La excepción exige ausencia de respuesta CAPA del proveedor.");
    if (active.some(f => f.criticality === "CRITICAL")) blockers.push("Hay hallazgos críticos: la excepción está prohibida.");
  }
  for (const f of active) {
    const actions = f.actions.filter(a => a.isActive);
    const capas = f.relations.filter(r => r.isActive && r.qmsRelation.isActive).map(r => r.qmsRelation.targetRecord).filter(r => r.capa);
    for (const r of capas) if (!r.isActive || r.capa!.status !== "CLOSED" || !["CONFORMING", "NA"].includes(r.capa!.effectivenessStatus)) blockers.push(`${f.reference}: CAPA formal necesaria abierta, anulada o con eficacia pendiente/no conforme.`);
    if (exception) continue;
    if (!f.treatment?.trim() && !actions.length && !capas.length) blockers.push(`${f.reference}: falta tratamiento o justificación.`);
    if (!actions.length && !capas.length && (!terminal(f.treatmentStatus) || (!f.evidence && !f.evidenceReference && !f.verificationComment))) blockers.push(`${f.reference}: tratamiento/evidencia pendiente.`);
    if (internal && !actions.length && !capas.length && f.treatmentStatus === "CLOSED" && !f.verificationComment?.trim()) blockers.push(`${f.reference}: falta verificación del tratamiento local.`);
    for (const a of actions) {
      if (!terminal(a.status)) blockers.push(`${f.reference}: acción local pendiente.`);
      if (!a.evidence && !a.evidenceReference && !a.verificationComment) blockers.push(`${f.reference}: acción sin evidencia/justificación.`);
      if (!received && (!['CONFORMING','NA'].includes(a.verificationResult) || !a.verifiedAt || !a.verifiedBy?.trim())) blockers.push(`${f.reference}: verificación local pendiente/no conforme.`);
    }
  }
  if (!exception && c.pendingFollowups) blockers.push("Hay seguimiento pendiente: completa su revisión o deja registrada su resolución.");
  return { blockers: [...new Set(blockers)], warnings: !received && !c.signedPdf ? ["PDF firmado esperado no disponible; no es requisito absoluto de cierre en la aplicación."] : [], partial: internal ? Boolean(c.capaPlanEstablishedAt) : c.scenario === "SUPPLIER" ? Boolean(c.reportSentAt) : false };
}
