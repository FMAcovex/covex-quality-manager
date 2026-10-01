import Link from "next/link";
import { notFound } from "next/navigation";
import { addComplaintRelationAction,unlinkComplaintRelationAction } from "@/modules/complaints/actions";
import {
  complaintClassificationLabel,
  complaintEffectivenessLabel,
  complaintFollowupState,
  complaintOperationalSituation,
  complaintOperationalSituationLabel,
  complaintOperationalSituationTone,
  complaintStatusLabel,
  complaintTypeLabel,
  formatDate,
  investigationResultLabel,
} from "@/modules/complaints/domain";
import { getComplaintDetail } from "@/modules/complaints/queries";
import { qmsRecordHref, qmsRecordTypeLabel, qmsRecordDisplayCode } from "@/lib/qms/record-links";
import { capaPlanNavigation, capaProposalStatusLabel } from "@/modules/capa/proposal-ui";
import { OperationalRelationForm } from "@/components/operational-relation-form";
import { QmsAdministrativeStatus } from "@/components/qms-administrative-status";
import { versionLabel } from "@/lib/qms/versioning";

export const dynamic="force-dynamic";
const tabs=[
 ["summary","Resumen"],["part-i","Parte I"],["part-ii","Parte II"],["versions","Versiones"],
 ["relations","Relaciones"],["documents","Documentos"],["history","Historial"]
] as const;
const txt=(v:string|null|undefined)=>v||"—";
const yesNo=(v:string|null|undefined)=>v==="YES"?"Sí":v==="NO"?"No":v==="NA"?"N/A":"—";
const bool=(v:boolean|null|undefined)=>v===true?"Sí":v===false?"No":"—";
const resolutionLabels:Record<string,string>={
 RETURN:"Devolución",CORRECTIVE_ACTION:"Acc. correctora",PREVENTIVE_ACTION:"Acc. preventiva",
 IMMEDIATE_ACTION:"Acc. inmediata",RECALL:"Retirada del mercado",CREDIT:"Abono",REPLACEMENT:"Reposición",OTHER:"Otros"
};
const joinLabels=(values:string[],labels:Record<string,string>)=>values.map(x=>labels[x]??x).join(" · ")||"—";
const sourceLabels:Record<string,string>={CUSTOMER:"Cliente",DISTRIBUTOR:"Distribuidor",MAH:"Titular / MAH",CONSUMER:"Consumidor / usuario",AUTHORITY:"Autoridad / entidad sanitaria",SUPPLIER:"Proveedor",CARRIER:"Transportista / operador logístico",SUBCONTRACTOR:"Subcontrata",INTERNAL:"Detección interna",RECALL:"Retirada",OTHER:"Otro"};
const scopeLabels:Record<string,string>={MEDICINE:"Medicamento",API:"API",SUPPLEMENT:"Complemento alimenticio",COSMETIC:"Cosmética",MEDICAL_DEVICE:"Producto sanitario",ENVIRONMENT:"Medio ambiente",OTHER:"Otro"};
const objectLabels:Record<string,string>={PRODUCT_MATERIAL:"Producto / material",SERVICE:"Servicio",EQUIPMENT_SYSTEM:"Equipo / sistema",TRANSPORT:"Transporte",SUBCONTRACTED_ACTIVITY:"Actividad subcontratada",OTHER:"Otro"};
const categoryLabels:Record<string,string>={PRODUCT_QUALITY:"Calidad del producto",SPECIFICATIONS_TESTING:"Especificaciones / análisis",PACKAGING:"Acondicionamiento / envase",LABELLING_DOCUMENTATION:"Etiquetado / documentación",QUANTITY_CONTENT:"Cantidad / contenido",TRANSPORT_STORAGE:"Transporte / almacenamiento",SERVICE_SUPPLY:"Servicio / suministro",EQUIPMENT_SYSTEM:"Equipo / sistema",ENVIRONMENT:"Medio ambiente",OTHER:"Otro"};
const containmentLabels:Record<string,string>={QUARANTINE:"Bloqueo / cuarentena",SUSPEND_USE_DISTRIBUTION:"Suspender uso / distribución",NOTIFY_PARTIES:"Aviso a partes",NONE:"Ninguna",OTHER:"Otra"};

export default async function ComplaintDetailPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{tab?:string}>}){
 const {id}=await params;const {tab:raw}=await searchParams;const tab=tabs.some(([k])=>k===raw)?raw!:"summary";
 const r=await getComplaintDetail(id);if(!r)notFound();
 const situation=complaintOperationalSituation(r);
 const followupState=complaintFollowupState(r);
 const currentVersion=r.qmsRecord.versions.at(-1)??null;
 const derived=r.qmsRecord.sourceRelations.filter(x=>x.relationType==="GENERATES"&&(x.targetRecord.recordType==="CAPA"||x.targetRecord.recordType==="RETURN")).map(x=>x.targetRecord);
 const derivedReturns=derived.filter(x=>x.recordType==="RETURN");
 const derivedCapas=derived.filter(x=>x.recordType==="CAPA");

 return <section className="workspace">
  <div className="record-header"><div><p className="eyebrow"><Link href="/complaints">← Reclamaciones</Link></p><div className="record-title-line">
   <h1>{qmsRecordDisplayCode(r.qmsRecord)}</h1>
   <span className={`badge ${r.status==="DRAFT"?"neutral":r.status==="OPEN"?"open":"closed"}`}>{complaintStatusLabel(r.status)}</span>
   <span className={`badge ${complaintOperationalSituationTone(situation)}`}>{complaintOperationalSituationLabel(situation)}</span>
   <span className={`badge ${r.classification?.toLowerCase()??"neutral"}`}>{complaintClassificationLabel(r.classification)}</span>
   <span className="badge neutral">{complaintTypeLabel(r.complaintType)}</span>
   {currentVersion?<span className="badge neutral">{versionLabel(currentVersion.sequenceNumber)}</span>:null}
  </div><p className="muted-note">Apertura {formatDate(r.openedAt)} · {txt(r.partyName)}</p></div>
  <div className="record-actions"><Link className="button primary" href={`/complaints/${id}/edit`}>Editar / nueva versión / seguimiento</Link></div></div>

  {r.status==="DRAFT"?<div className="analytics-note"><strong>Borrador:</strong> todavía no es una reclamación operativa. Al abrirla se validarán todos los campos aplicables del Anexo III.</div>:null}
  {r.status==="OPEN"&&followupState==="OVERDUE"?<div className="form-errors"><strong>Seguimiento vencido:</strong> la fecha prevista era {formatDate(r.nextFollowupDate)}.</div>:null}
  {r.status==="OPEN"&&followupState==="MISSING"?<div className="form-errors"><strong>Control:</strong> reclamación abierta sin fecha de próximo seguimiento.</div>:null}

  <QmsAdministrativeStatus
   qmsRecordId={r.qmsRecord.id} isActive={r.qmsRecord.isActive} code={qmsRecordDisplayCode(r.qmsRecord)}
   annulledAt={r.qmsRecord.annulledAt?.toISOString()??null} annulledByText={r.qmsRecord.annulledByText}
   annulledReason={r.qmsRecord.annulledReason} defaultActor={process.env.DEFAULT_ACTOR_NAME||"Usuario demo"}
  />

  <nav className="record-tabs">{tabs.map(([k,l])=><Link key={k} className={tab===k?"active":""} href={`/complaints/${id}?tab=${k}`}>{l}</Link>)}</nav>

  {tab==="summary"?<>
   <div className="card"><div className="section-title-row"><div><h2>Resumen del expediente</h2><p className="muted-note">Situación actual y próximos pasos de la reclamación.</p></div>{currentVersion?<span className="badge neutral">Actual {versionLabel(currentVersion.sequenceNumber)}</span>:null}</div>
    <dl className="info-grid">
     <div className="info-item"><dt>Tipo</dt><dd>{complaintTypeLabel(r.complaintType)}</dd></div>
     <div className="info-item"><dt>Cliente / proveedor</dt><dd>{txt(r.partyName)}</dd></div>
     <div className="info-item"><dt>Clasificación</dt><dd>{complaintClassificationLabel(r.classification)}</dd></div>
     <div className="info-item"><dt>Situación</dt><dd><span className={`badge ${complaintOperationalSituationTone(situation)}`}>{complaintOperationalSituationLabel(situation)}</span></dd></div>
     <div className="info-item"><dt>Eficacia</dt><dd>{complaintEffectivenessLabel(r.effectivenessStatus)}</dd></div>
     <div className="info-item"><dt>Próximo seguimiento</dt><dd>{r.status==="OPEN"?formatDate(r.nextFollowupDate):"—"}</dd></div>
     <div className="info-item"><dt>Fecha cierre</dt><dd>{formatDate(r.closedAt)}</dd></div>
     <div className="info-item"><dt>Acciones derivadas</dt><dd>{r.hasDerivedActions===true?"Sí":r.hasDerivedActions===false?"No":"Pendiente"}</dd></div>
     <div className="info-item full"><dt>Descripción</dt><dd className="prose-value">{txt(r.description)}</dd></div>
     <div className="info-item full"><dt>Conclusión Parte I</dt><dd className="prose-value">{txt(r.conclusion)}</dd></div>
     {r.closeConclusion?<div className="info-item full"><dt>Conclusión de cierre</dt><dd className="prose-value">{r.closeConclusion}</dd></div>:null}
    </dl>
   </div>
   <div className="card"><h2>Expedientes relacionados</h2>
    {derived.length?<div className="linked-record-grid">{derived.map(x=><article className="linked-record-card" key={x.id}><div className="linked-record-main"><strong>{qmsRecordDisplayCode(x,qmsRecordTypeLabel(x.recordType))}</strong><p>{qmsRecordTypeLabel(x.recordType)} generado/vinculado desde esta reclamación.</p></div><div className="linked-record-action"><Link className="button small" href={qmsRecordHref(x.recordType,x.id)}>Abrir expediente</Link></div></article>)}</div>:<div className="empty-panel">No hay CAPA ni devoluciones relacionadas.</div>}
   </div>
  </>:null}

  {tab==="part-i"?<>
   <div className="card"><h2>Identificación</h2><dl className="info-grid">
    <div className="info-item"><dt>Fecha apertura</dt><dd>{formatDate(r.openedAt)}</dd></div><div className="info-item"><dt>Fecha detección</dt><dd>{formatDate(r.detectionDate)}</dd></div><div className="info-item"><dt>Fecha recepción</dt><dd>{formatDate(r.receptionDate)}</dd></div><div className="info-item"><dt>Departamento</dt><dd>{r.departmentCodeSnapshot??r.department?.code??"—"}</dd></div>
    <div className="info-item"><dt>Tipo</dt><dd>{complaintTypeLabel(r.complaintType)}</dd></div><div className="info-item"><dt>Origen / fuente</dt><dd>{joinLabels(r.sourceTypes,sourceLabels)}</dd></div><div className="info-item"><dt>Ámbito</dt><dd>{joinLabels(r.scopeTypes,scopeLabels)}</dd></div><div className="info-item"><dt>Objeto afectado</dt><dd>{joinLabels(r.affectedObjectTypes,objectLabels)}</dd></div>
    <div className="info-item"><dt>Cliente / proveedor</dt><dd>{txt(r.partyName)}</dd></div><div className="info-item"><dt>Contacto</dt><dd>{txt(r.contact)}</dd></div>
    <div className="info-item"><dt>Referencia</dt><dd>{txt(r.reference)}</dd></div><div className="info-item"><dt>Lote</dt><dd>{txt(r.lotReference)}</dd></div><div className="info-item"><dt>Cantidad</dt><dd>{txt(r.quantity)}</dd></div><div className="info-item"><dt>Caducidad / reanálisis</dt><dd>{txt(r.expiryReanalysis)}</dd></div>
   </dl></div>

   <div className="card"><h2>A) Descripción de la reclamación</h2><dl className="info-grid">
    <div className="info-item full"><dt>Descripción</dt><dd className="prose-value">{txt(r.description)}</dd></div><div className="info-item full"><dt>Categoría / motivo</dt><dd>{joinLabels(r.categoryTypes,categoryLabels)}</dd></div>
    <div className="info-item"><dt>Recurrente</dt><dd>{bool(r.recurrent)}</dd></div><div className="info-item"><dt>Referencia recurrencia</dt><dd>{txt(r.recurrenceReference)}</dd></div>
    <div className="info-item full"><dt>Evidencias / documentación</dt><dd className="prose-value">{txt(r.attachedDocumentation)}</dd></div><div className="info-item"><dt>Emitido por</dt><dd>{txt(r.emittedBy)}</dd></div><div className="info-item"><dt>Validado por GC</dt><dd>{txt(r.qaValidatedBy)}</dd></div>
   </dl></div>

   <div className="card"><h2>B) Evaluación inicial, investigación e impacto</h2><dl className="info-grid">
    <div className="info-item"><dt>Calidad / GMP</dt><dd>{yesNo(r.impactQualityGmp)}</dd></div><div className="info-item"><dt>Seguridad / eficacia</dt><dd>{yesNo(r.impactSafetyEfficacy)}</dd></div><div className="info-item"><dt>Regulatorio</dt><dd>{yesNo(r.impactRegulatory)}</dd></div><div className="info-item"><dt>Medio ambiente</dt><dd>{yesNo(r.impactEnvironment)}</dd></div>
    <div className="info-item"><dt>Otros lotes / clientes</dt><dd>{yesNo(r.impactOtherSimilar)}</dd></div><div className="info-item full"><dt>Medidas de contención</dt><dd>{joinLabels(r.containmentActions,containmentLabels)}</dd></div>
    <div className="info-item full"><dt>Justificación de riesgo / alcance</dt><dd className="prose-value">{txt(r.riskJustification)}</dd></div><div className="info-item full"><dt>Investigación</dt><dd className="prose-value">{txt(r.investigation)}</dd></div><div className="info-item full"><dt>Conclusión del impacto</dt><dd className="prose-value">{txt(r.impactAssessment)}</dd></div><div className="info-item"><dt>Resultado</dt><dd>{investigationResultLabel(r.investigationResult)}</dd></div>
   </dl></div>

   <div className="card"><h2>C) Análisis de causa raíz</h2><p className="prose-value">{txt(r.rootCause)}</p></div>
   <div className="card"><h2>D) Clasificación de la reclamación</h2><span className={`badge ${r.classification?.toLowerCase()??"neutral"}`}>{complaintClassificationLabel(r.classification)}</span></div>
   <div className="card"><h2>E) Evaluación regulatoria</h2><dl className="info-grid">
    <div className="info-item"><dt>Puede requerir retirada</dt><dd>{yesNo(r.potentialRecall)}</dd></div><div className="info-item"><dt>Activar GC-00/029</dt><dd>{yesNo(r.recallProcedureRequired)}</dd></div><div className="info-item"><dt>Notificación autoridad</dt><dd>{yesNo(r.authorityNotificationRequired)}</dd></div><div className="info-item"><dt>Comunicación titular / cliente</dt><dd>{yesNo(r.responsiblePartyCommunicationRequired)}</dd></div><div className="info-item full"><dt>Justificación</dt><dd className="prose-value">{txt(r.regulatoryJustification)}</dd></div>
   </dl></div>
   <div className="card"><h2>F) Líneas de actuación y resolución</h2><p className="prose-value">{txt(r.resolutionLines)}</p></div>

   <div className="card"><h2>G) Acciones derivadas</h2><p><strong>¿Existen acciones?</strong> {r.hasDerivedActions===true?"Sí":r.hasDerivedActions===false?"No":"Pendiente"}</p>
    {r.hasDerivedActions?<><p>{joinLabels(r.resolutionActions,resolutionLabels)}</p>
     {r.capaPlans.length?<><h3>CAPA propuestas / vinculadas</h3><div className="linked-record-grid">{r.capaPlans.map(x=>{const navigation=capaPlanNavigation(x);return <article className="linked-record-card" key={x.id}><div className="linked-record-main"><div className="linked-record-heading"><strong>{x.actionType==="CORRECTIVE"?"Correctora":"Preventiva"}</strong><span className="badge neutral">{capaProposalStatusLabel(x.proposalStatus)}</span></div><p>{x.description}</p><small>{txt(x.responsible)} · {formatDate(x.plannedExecutionDate)} · {x.businessCapaCode??"Pendiente de CAPA"}</small></div><div className="linked-record-action">{navigation.kind==="OPEN"?<Link className="button small" href={qmsRecordHref("CAPA",navigation.recordId)}>Abrir CAPA</Link>:navigation.kind==="CREATE"?<Link className="button small primary" href={`/capa/new?fromComplaintPlanId=${x.id}`}>Crear CAPA</Link>:null}</div></article>})}</div></>:null}
     {r.derivedActions.length?<><h3>Otras acciones / registros</h3><div className="table-scroll"><table><thead><tr><th>Tipo</th><th>Código</th><th>Acción / evidencia</th><th>Responsable</th><th>Fecha prevista</th></tr></thead><tbody>{r.derivedActions.map(x=><tr key={x.id}><td>{resolutionLabels[x.actionType]??x.actionType}</td><td>{txt(x.businessCode)}</td><td>{txt(x.description)}</td><td>{txt(x.responsible)}</td><td>{formatDate(x.plannedExecutionDate)}</td></tr>)}</tbody></table></div></>:null}
     {derived.length?<><h3>Relaciones QMS activas</h3><div className="relation-chips">{derived.map(x=><Link key={x.id} className="relation-chip" href={qmsRecordHref(x.recordType,x.id)}>{qmsRecordDisplayCode(x,qmsRecordTypeLabel(x.recordType))}</Link>)}</div></>:null}
    </>:<div className="empty-panel">No se han definido acciones derivadas.</div>}
   </div>

   <div className="card"><h2>H) Comunicación</h2><dl className="info-grid"><div className="info-item"><dt>Fecha</dt><dd>{formatDate(r.communicationDate)}</dd></div><div className="info-item"><dt>Medio</dt><dd>{txt(r.communicationMedium)}</dd></div><div className="info-item"><dt>Emisor / destinatario</dt><dd>{txt(r.communicationParties)}</dd></div><div className="info-item full"><dt>Resumen</dt><dd className="prose-value">{txt(r.communicationSummary)}</dd></div></dl></div>
   <div className="card"><h2>I) Conclusión Parte I y seguimiento</h2><dl className="info-grid"><div className="info-item"><dt>Decisión Parte II</dt><dd>{r.partIIRequired===true?"Continúa en Parte II":r.partIIRequired===false?"No procede · cierre en Parte I":"Pendiente de decisión / seguimiento"}</dd></div><div className="info-item"><dt>Próximo seguimiento</dt><dd>{r.status==="OPEN"?formatDate(r.nextFollowupDate):"—"}</dd></div><div className="info-item full"><dt>Conclusión / pendientes</dt><dd className="prose-value">{txt(r.conclusion)}</dd></div></dl></div>
  </>:null}

  {tab==="part-ii"?<div className="card"><h2>Parte II · Seguimiento y cierre</h2>
   {r.partIIRequired!==true?<div className="analytics-note">{r.partIIRequired===false?"Parte II no procede. El expediente puede cerrarse en Parte I.":"Parte II pendiente de decisión/seguimiento."}</div>:<>
    <h3>A) Respuesta del proveedor o al / del cliente</h3><dl className="info-grid"><div className="info-item"><dt>Fecha respuesta</dt><dd>{formatDate(r.responseDate)}</dd></div><div className="info-item"><dt>Medio</dt><dd>{txt(r.responseMedium)}</dd></div><div className="info-item"><dt>Respuesta suficiente</dt><dd>{bool(r.responseSufficient)}</dd></div><div className="info-item full"><dt>Resumen / compromisos</dt><dd className="prose-value">{txt(r.responseSummary)}</dd></div></dl>
    <h3>B) Verificación de eficacia</h3><dl className="info-grid"><div className="info-item"><dt>Resultado</dt><dd>{complaintEffectivenessLabel(r.effectivenessStatus)}</dd></div><div className="info-item full"><dt>Valoración</dt><dd className="prose-value">{txt(r.effectivenessAssessment)}</dd></div></dl>
    <h3>C) Cierre</h3><dl className="info-grid"><div className="info-item"><dt>Estado acciones</dt><dd>{r.closeActionStatus==="COMPLETED"?"Completadas":r.closeActionStatus==="LINKED"?"Vinculadas a seguimiento independiente":r.closeActionStatus==="PENDING"?"Pendientes":"—"}</dd></div><div className="info-item"><dt>Referencias / responsable</dt><dd>{txt(r.closeActionReferences)}</dd></div><div className="info-item"><dt>Estado final</dt><dd>{complaintStatusLabel(r.status)}</dd></div><div className="info-item"><dt>Fecha cierre</dt><dd>{formatDate(r.closedAt)}</dd></div><div className="info-item full"><dt>Conclusión</dt><dd className="prose-value">{txt(r.closeConclusion)}</dd></div></dl>
   </>}
  </div>:null}

  {tab==="versions"?<div className="card"><div className="section-title-row"><div><h2>Versiones del expediente</h2><p className="muted-note">La versión inicial existente se muestra aquí. La creación explícita de V01/V02… se completa en el bloque documental de versionado.</p></div>{currentVersion?<span className="badge neutral">Actual {versionLabel(currentVersion.sequenceNumber)}</span>:null}</div>
   {r.qmsRecord.versions.length?<div className="timeline">{[...r.qmsRecord.versions].reverse().map(item=><article className="timeline-item record-version-item" key={item.id}><header><strong>{versionLabel(item.sequenceNumber)}</strong><span className="badge neutral">{item.frozenAt?"Histórica":"Vigente"}</span></header><small>Registrada {formatDate(item.createdAt)} · {item.createdByText??"Sistema"}</small>{item.reason?<p>Motivo: {item.reason}</p>:null}</article>)}</div>:<div className="empty-panel">Este expediente todavía no tiene snapshot persistido.</div>}
  </div>:null}

  {tab==="relations"?(r.status==="DRAFT"?<div className="empty-panel">Las relaciones operativas estarán disponibles cuando la reclamación pase a estado Abierta.</div>:<div className="card"><div className="section-title-row"><div><h2>Relaciones QMS</h2><p className="section-help">Una reclamación puede generar CAPA y devoluciones. La relación canónica se conserva sin duplicar relaciones inversas.</p></div><div className="heading-actions"><Link className="button small" href={`/capa/new?fromComplaintId=${id}`}>Crear CAPA</Link><Link className="button small" href={`/returns/new?fromComplaintId=${id}`}>Crear devolución</Link></div></div>
   {derived.length?<div className="relation-list">{derived.map(x=><div className="relation-card" key={x.id}><span>{x.recordType==="CAPA"?"CAPA derivada":"Devolución derivada"}</span><Link href={qmsRecordHref(x.recordType,x.id)}><strong>{qmsRecordDisplayCode(x,qmsRecordTypeLabel(x.recordType))}{!x.isActive?" · Anulado":""}</strong></Link><small>{qmsRecordTypeLabel(x.recordType)}</small><form action={unlinkComplaintRelationAction.bind(null,id,x.id)}><input type="hidden" name="actor" value={r.createdByText??process.env.DEFAULT_ACTOR_NAME??"Usuario demo"}/><button className="button danger small" type="submit">Desvincular</button></form></div>)}</div>:<div className="empty-panel">Todavía no hay CAPA ni devoluciones vinculadas.</div>}
   <OperationalRelationForm action={addComplaintRelationAction.bind(null,id)} title="Vincular expediente existente" codeLabel="Codificación" buttonLabel="Vincular expediente" defaultActor={process.env.DEFAULT_ACTOR_NAME||"Usuario demo"} targetOptions={[{value:"CAPA",label:"CAPA"},{value:"RETURN",label:"Devolución"}]} currentRecordId={r.qmsRecord.id} currentRecordType="COMPLAINT"/>
  </div>):null}

  {tab==="documents"?(r.status==="DRAFT"?<div className="empty-panel">Los documentos oficiales estarán disponibles cuando la reclamación pase a estado Abierta.</div>:<div className="card"><h2>Documentos</h2><div className="document-grid">
   <div className="document-block"><h3>Anexo III · Informe de reclamación</h3><p>La maquetación oficial v03 se mantiene. El versionado histórico del Anexo III se completa en R2.</p><div className="document-actions">{r.annexIIITemplateVersion?.id?<a className="button" href={`/api/settings/templates/${r.annexIIITemplateVersion.id}/download`}>Descargar plantilla oficial</a>:<span className="muted-note">Plantilla pendiente de cargar.</span>}<a className="button primary" href={`/api/complaints/${id}/annex-iii`}>Generar Anexo III cumplimentado</a></div></div>
   {r.annexIIITemplateVersion?.versionCode==="02"?<div className="document-block"><h3>Anexo IV · Respuesta · histórico v02</h3><p>Solo para expedientes vinculados a la revisión 02.</p><div className="document-actions">{r.annexIVTemplateVersion?.id?<a className="button" href={`/api/settings/templates/${r.annexIVTemplateVersion.id}/download`}>Descargar plantilla oficial</a>:null}<a className="button" href={`/api/complaints/${id}/annex-iv`}>Generar respuesta v02</a></div></div>:null}
   <div className="document-block"><h3>Anexo V · Listado de reclamaciones</h3><p>Listado oficial anual validado. Se genera desde la pantalla principal.</p><Link className="button" href="/complaints">Ir al listado y descargar Anexo V</Link></div>
  </div>
  {r.qmsRecord.generatedDocuments.length?<><h3>Generaciones registradas</h3><div className="timeline">{r.qmsRecord.generatedDocuments.map(x=><div className="timeline-item document-generation-item" key={x.id}><strong className="document-generation-type">{x.documentType}</strong><small className="muted-note document-generation-meta">Generado {formatDate(x.generatedAt)} · {x.generatedByText??"Usuario no informado"}</small></div>)}</div></>:null}
  </div>):null}

  {tab==="history"?<div className="card"><h2>Historial interno de modificaciones</h2><p className="muted-note">Historial administrativo de cambios; no constituye un audit trail GMP validado.</p>{r.qmsRecord.history.length?<div className="timeline">{r.qmsRecord.history.map(x=><div className="timeline-item history-entry" key={x.id}><header className="history-entry-header"><strong>{formatDate(x.changedAt)}</strong><span>{x.changedByText??"Sistema"}</span><span className="badge neutral">{x.source}</span></header><p className="history-entry-detail"><strong>{x.fieldPath}</strong>{x.reason?<span> · Motivo: {x.reason}</span>:null}</p></div>)}</div>:<div className="empty-panel">Sin cambios registrados.</div>}</div>:null}
 </section>;
}
