import { receivedAuditScenario } from "./domain";
import type { ReportAudit } from "./report-service";
export function auditIntegrityIssues(a: ReportAudit, versionCount: number, signedPdf: boolean) {
  const issues: string[]=[], received=receivedAuditScenario(a.scenario);
  // D-110 (R5D): cliente e inspección no tienen informe COVEX ni conclusión propia; basta el informe recibido.
  if(!received&&a.performedDate&&!versionCount)issues.push('Auditoría realizada sin informe formal emitido.');
  if(!received&&a.reportDate&&!versionCount)issues.push('Datos de informe sin versión formal.');
  if(!received&&a.status==='CLOSED'&&!a.conclusion?.trim())issues.push('Cierre sin conclusión.');
  for(const f of a.findings.filter(f=>f.isActive)){
    if(!f.treatment?.trim()&&!f.actions.some(x=>x.isActive)&&!f.relations.some(r=>r.isActive&&r.qmsRelation.isActive))issues.push(`${f.reference}: elemento activo sin tratamiento.`);
    for(const x of f.actions.filter(x=>x.isActive&&x.status==='CLOSED'))if(!x.evidence&&!x.evidenceReference&&!x.verificationComment)issues.push(`${f.reference}: acción cerrada sin evidencia.`);
  }
  if(versionCount&&!signedPdf&&!received)issues.push('PDF firmado esperado ausente en la versión vigente.');
  if(received&&!a.qmsRecord.generatedDocuments.some(d=>d.documentType==='AUDIT_RECEIVED'))issues.push('Documento externo primario sin registrar.');
  if(a.supplierException&&(!a.supplierExceptionReason||!a.supplierExceptionBy||!a.supplierExceptionAt||!a.verifyAtNextAudit))issues.push('Excepción de proveedor incompleta.');
  return issues;
}
