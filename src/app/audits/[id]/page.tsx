import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuditDetail } from "@/modules/audits/queries";
import { auditDate, auditTypeLabels, auditScenarioLabels, auditStatusLabels, auditSituation, auditModalityLabels, auditRoleLabels, auditQualityLabels } from "@/modules/audits/domain";
import { qmsRecordDisplayCode } from "@/lib/qms/record-links";
import { QmsAdministrativeStatus } from "@/components/qms-administrative-status";
export const dynamic = "force-dynamic";
export default async function AuditPage({ params, searchParams }: { params: Promise<{id:string}>; searchParams: Promise<{tab?:string}> }) {
  const {id} = await params, tab = (await searchParams).tab === "history" ? "history" : "information";
  const audit = await getAuditDetail(id); if (!audit) notFound();
  const qms = audit.qmsRecord, code = qmsRecordDisplayCode(qms, "Sin código"), departments = audit.departments.filter(d => d.isActive), participants = audit.participants.filter(p => p.isActive).sort((a,b) => a.sortOrder-b.sortOrder);
  const fields = [
    ["Tipo", audit.auditType ? auditTypeLabels[audit.auditType] : "—"], ["Escenario", audit.scenario ? auditScenarioLabels[audit.scenario] : "—"], ["Estado", auditStatusLabels[audit.status]], ["Situación", auditSituation(audit)],
    ["Objeto", audit.title], ["Alcance", audit.scope], ["Referencias / normas", audit.referenceText], ["Referencia externa", audit.externalReference],
    ["Entidad auditada", audit.auditedEntityName || (audit.scenario !== "SUPPLIER" ? "COVEX" : null)], ["Dirección / lugar", audit.auditedEntityAddress], ["Entidad auditora / organismo", audit.auditingEntityName], ["Código entidad", audit.entityCode],
    ["Departamentos / áreas", departments.map(d => `${d.departmentCodeSnapshot} · ${d.departmentNameSnapshot}`).join("; ")], ["Área de referencia para codificación", audit.codingDepartmentCodeSnapshot],
    ["Fecha prevista", auditDate(audit.plannedDate)], ["Fecha realizada", auditDate(audit.performedDate)], ["Fecha apertura", auditDate(audit.openedAt)], ["Fecha cierre", auditDate(audit.closedAt)], ["Modalidad", audit.modality ? auditModalityLabels[audit.modality] : "—"], ["Control del dato", auditQualityLabels[audit.dataQualityStatus]], ["Observaciones internas", audit.internalObservations],
  ];
  return <section className="workspace"><div className="page-heading"><div><Link href="/audits">← Auditorías</Link><p className="eyebrow">Expediente de auditoría</p><h1>{code === "Sin código" ? audit.title || "Auditoría sin código" : code}</h1><p>{auditStatusLabels[audit.status]} · {auditSituation(audit)}</p></div><div className="heading-actions">{qms.isActive && audit.status !== "CLOSED" ? <Link className="button primary" href={`/audits/${id}/edit`}>Editar</Link> : null}<button className="button" disabled title="Disponible cuando se complete la política de R3B/R3C">Cerrar auditoría</button></div></div>
    <QmsAdministrativeStatus qmsRecordId={qms.id} isActive={qms.isActive} code={code} annulledAt={qms.annulledAt?.toISOString()} annulledByText={qms.annulledByText} annulledReason={qms.annulledReason} defaultActor="Usuario demo" reservesHistoricalCode/>
    <nav className="tabs"><Link className={`tab ${tab === "information" ? "active" : ""}`} href={`/audits/${id}`}>Información</Link><Link className={`tab ${tab === "history" ? "active" : ""}`} href={`/audits/${id}?tab=history`}>Historial</Link></nav>
    {tab === "information" ? <><section className="card"><h2>Información</h2><dl className="audit-detail-grid">{fields.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}</dl><small className="muted-note">Identificador QMS: {qms.id}</small></section><section className="card"><h2>Equipo y participantes</h2>{participants.length ? <ul className="audit-team">{participants.map(p => <li key={p.id}><strong>{p.displayName}</strong><span>{auditRoleLabels[p.role]}{p.position ? ` · ${p.position}` : ""}{p.organization ? ` · ${p.organization}` : ""}</span></li>)}</ul> : <p>Sin participantes registrados.</p>}</section></> : <section className="card"><h2>Historial operativo</h2><p className="muted-note">Registro operativo; no constituye un audit trail GMP validado.</p><ol className="audit-history">{qms.history.map(h => <li key={h.id}><strong>{auditHistoryLabel(h.fieldPath)}</strong><p>{h.reason}</p><small>{auditDate(h.changedAt)} · {h.changedByText || "Sin actor"}</small><details><summary>Valores registrados</summary><pre>{JSON.stringify({ anterior: h.oldValue, nuevo: h.newValue },null,2)}</pre></details></li>)}</ol></section>}
  </section>;
}
function auditHistoryLabel(path: string) {
  const labels: Record<string,string> = { __created__: "Creación", __administrative_status__: "Estado administrativo", businessCode: "Codificación", "audit.status": "Apertura / estado", "audit.auditType": "Tipo", "audit.scenario": "Escenario", "audit.plannedDate": "Fecha prevista", "audit.performedDate": "Fecha realizada", "audit.scope": "Alcance", "audit.departments": "Áreas/departamentos", "audit.participants": "Participantes" };
  return labels[path] ?? "Cambio del expediente";
}
