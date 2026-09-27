import Link from "next/link";
import { notFound } from "next/navigation";
import { addChangeControlFollowupAction } from "@/modules/change-control/actions";
import {
  changeClassificationLabel,changeDecisionLabel,changeEffectivenessLabel,changeExecutionLabel,
  changeRequestStatusLabel,changeStatusLabel,formatDate,scopeLabel,
} from "@/modules/change-control/domain";
import { getChangeControlDetail } from "@/modules/change-control/queries";
import { recordVersionSummary,versionLabel } from "@/lib/qms/versioning";

export const dynamic="force-dynamic";
const tabs=[
  ["summary","Resumen"],["request","Solicitud"],["decision","Dictamen"],["actions","Plan de ejecución"],
  ["followups","Seguimientos"],["versions","Versiones"],["documents","Documentos"],["history","Historial"],
] as const;

export default async function ChangeControlDetailPage({params,searchParams}:{
  params:Promise<{id:string}>;searchParams:Promise<{tab?:string}>;
}) {
  const {id}=await params;
  const {tab:rawTab}=await searchParams;
  const activeTab=tabs.some(([key])=>key===rawTab)?rawTab!:"summary";
  const change=await getChangeControlDetail(id);
  if(!change) notFound();
  const currentVersion=change.qmsRecord.versions.at(-1)??null;

  return <section className="workspace">
    <div className="record-header"><div>
      <p className="eyebrow"><Link href="/changes">← Controles de cambios</Link></p>
      <div className="record-title-line"><h1>{change.qmsRecord.businessCode??"Control sin código"}</h1>
        <span className={`badge ${change.classification==="MAJOR"?"major":"minor"}`}>{changeClassificationLabel(change.classification)}</span>
        <span className={`badge ${change.status==="OPEN"?"open":change.status==="CLOSED"?"closed":"neutral"}`}>{changeStatusLabel(change.status)}</span>
        <span className="badge neutral">{change.departmentCodeSnapshot??"Sin departamento"}</span>
        {currentVersion?<span className="badge neutral">{versionLabel(currentVersion.sequenceNumber)}</span>:null}
        {change.dataQualityStatus!=="COMPLETE"?<span className="badge warning">{change.dataQualityStatus==="INCOMPLETE"?"Dato incompleto":"Revisar dato"}</span>:null}
      </div>
      <p className="muted-note">Solicitud {formatDate(change.requestedAt)} · {changeExecutionLabel(change.executionStatus)} · Eficacia {changeEffectivenessLabel(change.effectivenessStatus)}</p>
    </div><div className="record-actions">
      <Link className="button primary" href={`/changes/${id}/edit`}>Editar</Link>
      <Link className="button" href={`/changes/${id}?tab=followups#new-followup`}>+ Seguimiento</Link>
      <a className="button" href={`/api/changes/${id}/annex-iii-iv`}>Solicitud + Dictamen</a>
    </div></div>

    <nav className="record-tabs">{tabs.map(([key,label])=><Link key={key} className={activeTab===key?"active":""} href={`/changes/${id}?tab=${key}`}>{label}</Link>)}</nav>

    {activeTab==="summary"?<div className="card"><h2>Resumen del expediente</h2><dl className="info-grid">
      <div className="info-item"><dt>Departamento</dt><dd>{change.departmentCodeSnapshot??"—"} · {change.departmentNameSnapshot??""}</dd></div>
      <div className="info-item"><dt>Clasificación</dt><dd>{changeClassificationLabel(change.classification)}</dd></div>
      <div className="info-item"><dt>Solicitud</dt><dd>{changeRequestStatusLabel(change.requestStatus)}</dd></div>
      <div className="info-item"><dt>Dictamen</dt><dd>{changeDecisionLabel(change.decisionResult)}</dd></div>
      <div className="info-item full"><dt>Descripción</dt><dd className="prose-value">{change.description??"—"}</dd></div>
      <div className="info-item wide"><dt>Fecha prevista implantación</dt><dd>{formatDate(change.plannedImplementationAt)}</dd></div>
      <div className="info-item wide"><dt>Responsable seguimiento</dt><dd>{change.followupResponsible??"—"}</dd></div>
      <div className="info-item"><dt>Ejecución</dt><dd>{changeExecutionLabel(change.executionStatus)}</dd></div>
      <div className="info-item"><dt>Fecha ejecución</dt><dd>{formatDate(change.executedAt)}</dd></div>
      <div className="info-item"><dt>Eficacia</dt><dd>{changeEffectivenessLabel(change.effectivenessStatus)}</dd></div>
      <div className="info-item"><dt>Cierre efectivo</dt><dd>{formatDate(change.effectiveClosedAt)}</dd></div>
      <div className="info-item full"><dt>Conclusión</dt><dd className="prose-value">{change.closureConclusion??"—"}</dd></div>
    </dl></div>:null}

    {activeTab==="request"?<div className="card"><h2>Solicitud del cambio</h2><dl className="info-grid">
      <div className="info-item"><dt>Fecha</dt><dd>{formatDate(change.requestedAt)}</dd></div>
      <div className="info-item"><dt>Solicitante</dt><dd>{change.requesterName??"—"}</dd></div>
      <div className="info-item"><dt>Puesto</dt><dd>{change.requesterPosition??"—"}</dd></div>
      <div className="info-item"><dt>Estado solicitud</dt><dd>{changeRequestStatusLabel(change.requestStatus)}</dd></div>
      <div className="info-item full"><dt>Alcance</dt><dd>{change.scopes.map(scopeLabel).join(" · ")||"—"}{change.scopeOther?` · ${change.scopeOther}`:""}</dd></div>
      <div className="info-item full"><dt>Descripción</dt><dd className="prose-value">{change.description??"—"}</dd></div>
      <div className="info-item full"><dt>Justificación</dt><dd className="prose-value">{change.justification??"—"}</dd></div>
      <div className="info-item full"><dt>Documentos aportados</dt><dd className="prose-value">{change.supportingDocuments??"—"}</dd></div>
      <div className="info-item"><dt>Aceptada/denegada por</dt><dd>{change.acceptedByText??"—"}</dd></div>
      <div className="info-item"><dt>Fecha decisión solicitud</dt><dd>{formatDate(change.requestDecisionAt)}</dd></div>
    </dl></div>:null}

    {activeTab==="decision"?<><div className="card"><h2>Dictamen</h2><dl className="info-grid">
      <div className="info-item full"><dt>Evaluación</dt><dd className="prose-value">{change.evaluation??"—"}</dd></div>
      <div className="info-item"><dt>Clasificación</dt><dd>{changeClassificationLabel(change.classification)}</dd></div>
      <div className="info-item"><dt>Fecha prevista</dt><dd>{formatDate(change.plannedImplementationAt)}</dd></div>
      <div className="info-item"><dt>Resultado</dt><dd>{changeDecisionLabel(change.decisionResult)}</dd></div>
      <div className="info-item"><dt>Fecha dictamen</dt><dd>{formatDate(change.decisionAt)}</dd></div>
      <div className="info-item"><dt>Comité</dt><dd>{change.committeeRequired===true?"Sí":change.committeeRequired===false?"No":"—"}</dd></div>
      <div className="info-item wide"><dt>Justificación comité</dt><dd>{change.committeeJustification??"—"}</dd></div>
      <div className="info-item"><dt>Responsable seguimiento</dt><dd>{change.followupResponsible??"—"}</dd></div>
      <div className="info-item"><dt>Aprobado por</dt><dd>{change.approvedByText??"—"}</dd></div>
      <div className="info-item full"><dt>Observaciones</dt><dd className="prose-value">{change.decisionObservations??"—"}</dd></div>
    </dl></div>
    <div className="card"><h2>Implicaciones y requisitos</h2><dl className="info-grid">
      <div className="info-item"><dt>Cliente</dt><dd>{change.clientNotificationRequired===true?"Sí":change.clientNotificationRequired===false?"No":"—"}</dd></div>
      <div className="info-item wide"><dt>Detalle cliente</dt><dd>{change.clientNotificationDetail??"—"}</dd></div>
      <div className="info-item"><dt>Autoridad sanitaria</dt><dd>{change.authorityNotificationRequired===true?"Sí":change.authorityNotificationRequired===false?"No":"—"}</dd></div>
      <div className="info-item wide"><dt>Detalle autoridad</dt><dd>{change.authorityNotificationDetail??"—"}</dd></div>
      <div className="info-item"><dt>PQR</dt><dd>{change.pqrRequirement??"—"}</dd></div>
      <div className="info-item"><dt>Estabilidad</dt><dd>{change.stabilityRequirement??"—"}</dd></div>
      <div className="info-item"><dt>Análisis adicionales</dt><dd>{change.additionalAnalysis??"—"}</dd></div>
      <div className="info-item"><dt>Validación adicional</dt><dd>{change.additionalValidation??"—"}</dd></div>
    </dl></div></>:null}

    {activeTab==="actions"?<div className="card"><h2>Plan de ejecución</h2><div className="table-scroll"><table className="records-table compact-table">
      <thead><tr><th>#</th><th>Departamento</th><th>Acción</th><th>Responsable</th><th>Fecha prevista</th><th>Fecha real</th><th>Estado</th><th>Evidencia / comentario</th></tr></thead>
      <tbody>{change.actions.map((item,index)=><tr key={item.id}><td>{index+1}</td><td>{item.departmentText??"—"}</td><td className="table-cell-wrap">{item.description}</td><td>{item.responsible??"—"}</td><td>{formatDate(item.plannedExecutionDate)}</td><td>{formatDate(item.actualExecutionDate)}</td><td>{item.completed?"Completada":"Pendiente"}</td><td className="table-cell-wrap">{item.evidenceComment??"—"}</td></tr>)}</tbody>
    </table></div></div>:null}

    {activeTab==="followups"?<><div className="card"><div className="section-title-row"><div><h2>Histórico de seguimientos</h2><p className="muted-note">La numeración oficial comienza en 00.</p></div></div>
      {change.followups.length?<div className="timeline">{change.followups.map((item)=><article className="timeline-item" key={item.id}>
        <div className="timeline-marker">{String(item.sequenceNumber).padStart(2,"0")}</div><div><header><strong>{formatDate(item.followupDate)}</strong><span>{item.responsibleText}</span></header>
          <p><strong>Ejecución:</strong> {changeExecutionLabel(item.executionStatus)}{item.executionDate?` · ${formatDate(item.executionDate)}`:""}</p>
          <p><strong>Eficacia:</strong> {changeEffectivenessLabel(item.effectivenessStatus)}</p>
          {item.observations?<p><strong>Observaciones:</strong> {item.observations}</p>:null}
          {item.effectivenessObservations?<p><strong>Comprobación eficacia:</strong> {item.effectivenessObservations}</p>:null}
          {item.openReason?<p><strong>Motivo abierto:</strong> {item.openReason}</p>:null}
          {item.conclusion?<p><strong>Conclusión:</strong> {item.conclusion}</p>:null}
          <small>Próximo seguimiento: {formatDate(item.nextFollowupDate)} · {item.closesChange?"Cierra el cambio":"Continúa abierto"}</small>
          <div className="document-actions">
            {change.qmsRecord.versions.some((version)=>version.sourceEntityId===item.id)
              ? <a className="button small" href={`/api/changes/${id}/annex-v?followup=${item.sequenceNumber}`}>Descargar Anexo V · {String(item.sequenceNumber).padStart(2,"0")}</a>
              : <span className="muted-note">Sin snapshot exacto: no se regenera el documento histórico.</span>}
          </div>
        </div></article>)}</div>:<div className="empty-panel">Todavía no hay seguimientos. El primer informe será el seguimiento 00.</div>}
    </div>
    <div className="card" id="new-followup"><h2>Añadir seguimiento</h2><form action={addChangeControlFollowupAction.bind(null,id)} className="inline-form change-followup-form">
      <label className="field"><span>Fecha *</span><input type="date" name="followupDate" required/></label>
      <label className="field"><span>Responsable *</span><input name="responsibleText" defaultValue={change.followupResponsible??change.requesterName??""} required/></label>
      <label className="field"><span>Estado ejecución</span><select name="executionStatus" defaultValue={change.executionStatus}><option value="NOT_EXECUTED">No ejecutado</option><option value="EXECUTED">Ejecutado</option></select></label>
      <label className="field"><span>Fecha ejecución</span><input type="date" name="executionDate" defaultValue={change.executedAt?.toISOString().slice(0,10)??""}/></label>
      <label className="field"><span>Eficacia</span><select name="effectivenessStatus" defaultValue={change.effectivenessStatus}><option value="PENDING">Pendiente</option><option value="ACCEPTABLE">Aceptable</option><option value="NOT_ACCEPTABLE">No aceptable</option></select></label>
      <label className="field"><span>Próximo seguimiento</span><input type="date" name="nextFollowupDate"/></label>
      <label className="field full"><span>Seguimiento de acciones / observaciones</span><textarea name="observations"/></label>
      <label className="field full"><span>Observaciones de eficacia</span><textarea name="effectivenessObservations"/></label>
      <label className="field full"><span>Si se mantiene abierto, indicar motivo</span><textarea name="openReason"/></label>
      <label className="field full"><span>Motivo del cierre y conclusión</span><textarea name="conclusion"/></label>
      <label className="field"><span>Cierre del seguimiento</span><input name="closedByText"/></label>
      <label className="field"><span>Aprobación cierre</span><input name="closureApprovedByText"/></label>
      <label className="field"><span>¿Se cierra el cambio?</span><span className="checkbox-group"><label><input type="checkbox" name="closesChange"/>Sí</label></span></label>
      <div className="field"><span>&nbsp;</span><button className="button primary">Guardar seguimiento</button></div>
    </form></div></>:null}

    {activeTab==="versions"?<div className="card"><div className="section-title-row"><div><h2>Versiones funcionales</h2><p className="muted-note">V00 conserva la solicitud/dictamen inicial. Cada seguimiento crea la versión funcional siguiente; la numeración oficial del seguimiento sigue siendo 00, 01, 02…</p></div>{currentVersion?<span className="badge neutral">Actual {versionLabel(currentVersion.sequenceNumber)}</span>:null}</div>
      {change.qmsRecord.versions.length?<div className="timeline">{change.qmsRecord.versions.map((item)=>{
        const summary=recordVersionSummary("CHANGE_CONTROL",item.snapshot);
        const followupNumber=item.sequenceNumber===0?null:item.sequenceNumber-1;
        return <article className="timeline-item" key={item.id}><div className="timeline-marker">{String(item.sequenceNumber).padStart(2,"0")}</div><div>
          <header><strong>{versionLabel(item.sequenceNumber)} · {item.sequenceNumber===0?"Solicitud/dictamen inicial":`Seguimiento ${String(followupNumber).padStart(2,"0")}`}</strong>{item.frozenAt?<span className="badge neutral">Histórica</span>:<span className="badge neutral">Vigente</span>}</header>
          <p>Estado {changeStatusLabel(summary.status??"OPEN")} · Eficacia {changeEffectivenessLabel(summary.effectivenessStatus??"PENDING")} · Cierre {formatDate(summary.effectiveClosedAt)}</p>
          <small>{formatDate(item.createdAt)} · {item.createdByText??"Sistema"}{item.reason?` · ${item.reason}`:""}</small>
        </div></article>;
      })}</div>:<div className="empty-panel">No hay versiones persistidas.</div>}
    </div>:null}

    {activeTab==="documents"?<div className="card"><h2>Documentos</h2><div className="document-actions">
      <a className="button" href={`/api/changes/${id}/annex-iii-iv`}>Anexo III + IV · Solicitud y Dictamen</a>
      {change.followups.map((f)=>change.qmsRecord.versions.some((version)=>version.sourceEntityId===f.id)
        ? <a key={f.id} className="button" href={`/api/changes/${id}/annex-v?followup=${f.sequenceNumber}`}>Anexo V · Seguimiento {String(f.sequenceNumber).padStart(2,"0")}</a>
        : <span key={f.id} className="muted-note">Seguimiento {String(f.sequenceNumber).padStart(2,"0")}: sin snapshot exacto</span>)}
    </div></div>:null}

    {activeTab==="history"?<div className="card"><h2>Historial de modificaciones</h2>{change.qmsRecord.history.length?<div className="timeline">{change.qmsRecord.history.map((item)=><article className="timeline-item" key={item.id}><div><header><strong>{item.fieldPath}</strong><span>{formatDate(item.changedAt)}</span></header><p>{item.reason??"Modificación registrada"}</p><small>{item.changedByText??"Sistema"} · {item.source}</small></div></article>)}</div>:<div className="empty-panel">Sin historial.</div>}</div>:null}
  </section>;
}
