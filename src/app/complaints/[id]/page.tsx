import { FormattedText } from "@/components/formatted-text";
import { TextTablesView } from "@/components/text-tables-view";
import { numberTextTables, storedTextTables } from "@/lib/forms/text-tables";
import { COMPLAINT_TABLE_FIELDS } from "@/modules/complaints/text-tables";
import { storedAdditionalLots } from "@/lib/qms/additional-lots";
import { PreviewLink } from "@/components/preview-link";
import { ResponsibleUserNote } from "@/components/responsible-user-note";
import { rootCauseCategoryLabel } from "@/lib/qms/root-cause-categories";
import { RecordEvidencePanel } from "@/components/record-evidence-panel";
import { uploadComplaintEvidenceAction } from "@/lib/qms/record-evidence-actions";
import { RecordTimeline } from "@/components/record-timeline";
import { ActorField } from "@/components/permissions";
import { PermissionGate } from "@/components/permissions";
import { currentActor } from "@/lib/auth/presentation";
import { AuditTrailPanel } from "@/components/audit-trail-panel";

import { CsrfField } from "@/components/csrf";
import { authorizedPage } from "@/lib/auth/page-guard";
import Link from "next/link";
import { qmsListingReturnTo, qmsWithReturnTo } from "@/lib/qms/list-return-navigation";
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
import { RecordHeader } from "@/components/record-header";
import { RecordKeyFacts } from "@/components/record-key-facts";
import { dueTone } from "@/lib/qms/key-facts";
import { complaintSnapshotVersionFollowupDate,recordVersionSummary,versionLabel } from "@/lib/qms/versioning";
import { uploadComplaintSignedPdfAction } from "@/modules/complaints/signed-document-actions";
import { SignedVersionDocumentForm } from "@/components/signed-version-document-form";
import {
 ReviewDrawer,ReviewMarker,ReviewModeToggle,ReviewStatusSummary,ReviewThreadList,ReviewWorkspaceProvider
} from "@/components/review";
import { getReviewThreadsForDisplay } from "@/lib/qms/review/ui-queries";
import { activeReviewCount,reviewModeHref,reviewTabHref,reviewVersionLabel } from "@/lib/qms/review/ui-model";
import { reviewTargetWithValue } from "@/lib/qms/review/targets/catalog";
import { complaintCapaPlanReviewTarget,complaintReviewTargets } from "@/lib/qms/review/targets/complaints";

export const dynamic="force-dynamic";
const tabs=[
 ["summary","Resumen"],["part-i","Parte I"],["part-ii","Parte II"],
 ["relations","Relaciones"],["documents","Documentos"],["evidence","Evidencias"],["versions","Versiones"],["review","Revisión"],["timeline","Cronología"],["audit-trail","Audit Trail"]
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

function complaintFollowupLabel(sequenceNumber: number) {
  return sequenceNumber === 0
    ? "V00 · Apertura"
    : `${versionLabel(sequenceNumber)} · Seguimiento`;
}

async function ComplaintDetailPageAuthenticatedContent({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{tab?:string;review?:string;thread?:string;returnTo?:string;auditPage?:string}>}){
 const {id}=await params;const {tab:raw,review,thread, returnTo,auditPage}=await searchParams;const tab=tabs.some(([k])=>k===raw)?raw!:"summary";
 const onSummary=tab==="summary";
 const r=await getComplaintDetail(id);if(!r)notFound();
 const textTables=numberTextTables(storedTextTables(r.textTables),COMPLAINT_TABLE_FIELDS);
 const situation=complaintOperationalSituation(r);
 const followupState=complaintFollowupState(r);
 const currentVersion=r.qmsRecord.versions.at(-1)??null;
 const currentSignedDocument=currentVersion?.documents.find(document=>document.kind==="SIGNED_PDF")??null;
 const signedVersionCount=r.qmsRecord.versions.filter(version=>version.documents.some(document=>document.kind==="SIGNED_PDF")).length;
 const derived=r.qmsRecord.sourceRelations.filter(x=>x.relationType==="GENERATES"&&(x.targetRecord.recordType==="CAPA"||x.targetRecord.recordType==="RETURN")).map(x=>x.targetRecord);
 const effectiveHasActions=r.hasDerivedActions===true||derived.length>0||r.capaPlans.length>0||r.derivedActions.length>0;
 const reviewMode=review==="1";
 const basePath=`/complaints/${id}`;
 const reviewThreads=await getReviewThreadsForDisplay(r.qmsRecord.id);
 const reviewActiveCount=activeReviewCount({
  PENDING:reviewThreads.filter(item=>item.status==="PENDING").length,
  ACCEPTED:reviewThreads.filter(item=>item.status==="ACCEPTED").length
 });
 const reviewTarget={
  description:reviewTargetWithValue(complaintReviewTargets.description,r.description),
  investigation:reviewTargetWithValue(complaintReviewTargets.investigation,r.investigation),
  impactAssessment:reviewTargetWithValue(complaintReviewTargets.impactAssessment,r.impactAssessment),
  rootCause:reviewTargetWithValue(complaintReviewTargets.rootCause,r.rootCause),
  regulatoryJustification:reviewTargetWithValue(complaintReviewTargets.regulatoryJustification,r.regulatoryJustification),
  resolutionLines:reviewTargetWithValue(complaintReviewTargets.resolutionLines,r.resolutionLines),
  derivedActions:reviewTargetWithValue(complaintReviewTargets.derivedActions,{hasDerivedActions:effectiveHasActions,actionCount:r.capaPlans.length+r.derivedActions.length}),
  communicationSummary:reviewTargetWithValue(complaintReviewTargets.communicationSummary,r.communicationSummary),
  conclusion:reviewTargetWithValue(complaintReviewTargets.conclusion,r.conclusion),
  responseSummary:reviewTargetWithValue(complaintReviewTargets.responseSummary,r.responseSummary),
  effectivenessAssessment:reviewTargetWithValue(complaintReviewTargets.effectivenessAssessment,r.effectivenessAssessment),
  closeConclusion:reviewTargetWithValue(complaintReviewTargets.closeConclusion,r.closeConclusion)
 };
 const staticReviewTargets=Object.values(reviewTarget);
 const capaPlanReviewTargets=r.capaPlans.map(item=>complaintCapaPlanReviewTarget(item.id,item.description));
 const reviewTargets=[...staticReviewTargets,...capaPlanReviewTargets];
 const capaPlanTargetById=new Map(capaPlanReviewTargets.map(target=>[target.targetEntityId!,target]));

 return <ReviewWorkspaceProvider qmsRecordId={r.qmsRecord.id} module="COMPLAINT" versionLabelMode="FOLLOWUP" basePath={basePath} currentVersionLabel={reviewVersionLabel(currentVersion?.sequenceNumber??null,"FOLLOWUP")} defaultActor={currentActor()} reviewMode={reviewMode} targets={reviewTargets} threads={reviewThreads} initialThreadId={thread}>
 <section className={`workspace${reviewMode?" review-mode-active":""}`}>
  <RecordHeader
   back={{ href: qmsListingReturnTo("/complaints", returnTo), label: "Reclamaciones" }}
   title={qmsRecordDisplayCode(r.qmsRecord)}
   chips={<>
    <span className={`badge ${r.status==="DRAFT"?"neutral":r.status==="OPEN"?"open":"closed"}`}>{complaintStatusLabel(r.status)}</span>
    {/* D-117 (H-05): en el resumen, situación, clasificación, tipo, versión, apertura y cliente están en la franja o en la tarjeta. */}
    {onSummary?null:<>
     <span className={`badge ${complaintOperationalSituationTone(situation)}`}>{complaintOperationalSituationLabel(situation)}</span>
     <span className={`badge ${r.classification?.toLowerCase()??"neutral"}`}>{complaintClassificationLabel(r.classification)}</span>
     <span className="badge neutral">{complaintTypeLabel(r.complaintType)}</span>
     {currentVersion?<span className="badge neutral">{versionLabel(currentVersion.sequenceNumber)}</span>:null}
    </>}
   </>}
   subtitle={onSummary?undefined:<>Apertura {formatDate(r.openedAt)} · {txt(r.partyName)}</>}
   annul={<QmsAdministrativeStatus part="action"
   qmsRecordId={r.qmsRecord.id} isActive={r.qmsRecord.isActive} code={qmsRecordDisplayCode(r.qmsRecord)}
   annulledAt={r.qmsRecord.annulledAt?.toISOString()??null} annulledByText={r.qmsRecord.annulledByText}
   annulledReason={r.qmsRecord.annulledReason} defaultActor={currentActor()}
  />}
   actions={<><PermissionGate permission="REVIEW"><ReviewModeToggle active={reviewMode} href={qmsWithReturnTo(reviewModeHref(basePath,tab,reviewMode), "/complaints", returnTo)}/></PermissionGate><PermissionGate permission="EDIT" form><Link className="button primary" href={qmsWithReturnTo(`/complaints/${id}/edit?tab=${tab}`, "/complaints", returnTo)}>Editar / seguimiento</Link></PermissionGate></>}
  />
  <QmsAdministrativeStatus part="banner"
   qmsRecordId={r.qmsRecord.id} isActive={r.qmsRecord.isActive} code={qmsRecordDisplayCode(r.qmsRecord)}
   annulledAt={r.qmsRecord.annulledAt?.toISOString()??null} annulledByText={r.qmsRecord.annulledByText}
   annulledReason={r.qmsRecord.annulledReason} defaultActor={currentActor()}
  />

  {r.status==="DRAFT"?<div className="analytics-note"><strong>Borrador:</strong> todavía no es una reclamación operativa. Al abrirla se validarán todos los campos aplicables del Anexo III.</div>:null}
  {r.status==="OPEN"&&followupState==="OVERDUE"?<div className="form-errors"><strong>Seguimiento vencido:</strong> la fecha prevista era {formatDate(r.nextFollowupDate)}.</div>:null}
  {r.status==="OPEN"&&followupState==="MISSING"?<div className="form-errors"><strong>Control:</strong> reclamación abierta sin fecha de próximo seguimiento.</div>:null}


  <nav className="record-tabs">{tabs.map(([k,l])=><Link key={k} className={tab===k?"active":""} href={qmsWithReturnTo(reviewTabHref(basePath,k,reviewMode), "/complaints", returnTo)}>{k==="review"?`${l} (${reviewActiveCount})`:l}</Link>)}</nav>

  {tab==="summary"?<>
   <RecordKeyFacts facts={[
    { label: "Situación", value: complaintOperationalSituationLabel(situation), badgeClass: complaintOperationalSituationTone(situation) },
    { label: "Apertura", value: formatDate(r.openedAt) },
    { label: "Próximo seguimiento", value: formatDate(r.nextFollowupDate), tone: dueTone(r.nextFollowupDate, new Date(), r.status !== "OPEN") },
    { label: "Respuesta", value: formatDate(r.responseDate) },
    { label: "Cierre", value: formatDate(r.closedAt) },
   ]} />
   <div className="card"><div className="section-title-row"><div><h2>Resumen del expediente</h2><p className="muted-note">Situación actual y próximos pasos de la reclamación.</p></div>{currentVersion?<span className="badge neutral">Actual {complaintFollowupLabel(currentVersion.sequenceNumber)}</span>:null}</div>
    <dl className="info-grid">
     <div className="info-item"><dt>Objeto afectado</dt><dd>{joinLabels(r.affectedObjectTypes,objectLabels)}</dd></div>
     <div className="info-item"><dt>Tipo</dt><dd>{complaintTypeLabel(r.complaintType)}</dd></div>
     <div className="info-item"><dt>Cliente / proveedor</dt><dd>{txt(r.partyName)}</dd></div>
     <div className="info-item"><dt>Clasificación</dt><dd>{complaintClassificationLabel(r.classification)}</dd></div>
     <div className="info-item"><dt>Eficacia</dt><dd>{complaintEffectivenessLabel(r.effectivenessStatus)}</dd></div>
     <div className="info-item"><dt>Acciones derivadas</dt><dd>{effectiveHasActions?"Sí":r.hasDerivedActions===false?"No":"Pendiente"}</dd></div>
     <div className="complaint-reference-panel">
      <div className="complaint-reference-heading"><span>Material / servicio / equipo afectado</span></div>
      <dl className="complaint-reference-grid">
       <div><dt>Referencia del material / servicio / equipo</dt><dd>{txt(r.reference)}</dd></div>
       <div><dt>N.º lote</dt><dd>{txt(r.lotReference)}</dd></div>
       <div><dt>Cantidad</dt><dd>{txt(r.quantity)}</dd></div>
       <div><dt>Caducidad / reanálisis</dt><dd>{txt(r.expiryReanalysis)}</dd></div>
       {storedAdditionalLots(r.additionalLots).length?<div><dt>Otros lotes afectados</dt><dd>{storedAdditionalLots(r.additionalLots).map(lot=>[lot.name,`lote ${lot.lot}`,lot.quantity&&`cantidad ${lot.quantity}`].filter(Boolean).join(" · ")).join("; ")}</dd></div>:null}
      </dl>
     </div>
     <div className="info-item full"><dt>Descripción</dt><dd className="prose-value"><FormattedText value={r.description} /></dd></div>
     <div className="info-item full"><dt>Conclusión Parte I</dt><dd className="prose-value"><FormattedText value={r.conclusion} /></dd></div>
     {r.closeConclusion?<div className="info-item full"><dt>Conclusión de cierre</dt><dd className="prose-value"><FormattedText value={r.closeConclusion} /></dd></div>:null}
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
    <div id={reviewTarget.description.anchorId} className="info-item full review-target"><dt><span>Descripción</span><ReviewMarker target={reviewTarget.description}/></dt><dd className="prose-value"><FormattedText value={r.description} /><TextTablesView items={textTables.description} /></dd></div><div className="info-item full"><dt>Categoría / motivo</dt><dd>{joinLabels(r.categoryTypes,categoryLabels)}</dd></div>
    <div className="info-item"><dt>Recurrente</dt><dd>{bool(r.recurrent)}</dd></div><div className="info-item"><dt>Referencia recurrencia</dt><dd>{txt(r.recurrenceReference)}</dd></div>
    <div className="info-item full"><dt>Evidencias / documentación</dt><dd className="prose-value"><FormattedText value={r.attachedDocumentation} /><TextTablesView items={textTables.attachedDocumentation} /></dd></div><div className="info-item"><dt>Emitido por</dt><dd>{txt(r.emittedBy)}</dd></div><div className="info-item"><dt>Validado por GC</dt><dd>{txt(r.qaValidatedBy)}</dd></div>
   </dl></div>

   <div className="card"><h2>B) Evaluación inicial, investigación e impacto</h2><dl className="info-grid">
    <div className="info-item"><dt>Calidad / GMP</dt><dd>{yesNo(r.impactQualityGmp)}</dd></div><div className="info-item"><dt>Seguridad / eficacia</dt><dd>{yesNo(r.impactSafetyEfficacy)}</dd></div><div className="info-item"><dt>Regulatorio</dt><dd>{yesNo(r.impactRegulatory)}</dd></div><div className="info-item"><dt>Medio ambiente</dt><dd>{yesNo(r.impactEnvironment)}</dd></div>
    <div className="info-item"><dt>Otros lotes / clientes</dt><dd>{yesNo(r.impactOtherSimilar)}</dd></div><div className="info-item full"><dt>Medidas de contención</dt><dd>{joinLabels(r.containmentActions,containmentLabels)}</dd></div>
    <div className="info-item full"><dt>Justificación de riesgo / alcance</dt><dd className="prose-value"><FormattedText value={r.riskJustification} /><TextTablesView items={textTables.riskJustification} /></dd></div><div id={reviewTarget.investigation.anchorId} className="info-item full review-target"><dt><span>Investigación</span><ReviewMarker target={reviewTarget.investigation}/></dt><dd className="prose-value"><FormattedText value={r.investigation} /><TextTablesView items={textTables.investigation} /></dd></div><div id={reviewTarget.impactAssessment.anchorId} className="info-item full review-target"><dt><span>Conclusión del impacto</span><ReviewMarker target={reviewTarget.impactAssessment}/></dt><dd className="prose-value"><FormattedText value={r.impactAssessment} /><TextTablesView items={textTables.impactAssessment} /></dd></div><div className="info-item"><dt>Resultado</dt><dd>{investigationResultLabel(r.investigationResult)}</dd></div>
   </dl></div>

   <div id={reviewTarget.rootCause.anchorId} className="card review-target"><div className="review-target-heading"><h2>C) Análisis de causa raíz</h2><ReviewMarker target={reviewTarget.rootCause}/></div><div className="prose-value prose-block"><FormattedText value={r.rootCause} /><TextTablesView items={textTables.rootCause} /></div><p className="muted-note"><strong>Categoría (6M):</strong> {r.rootCauseCategories.length?r.rootCauseCategories.map(v=>rootCauseCategoryLabel(v,true)).join(", "):"No informada"}</p></div>
   <div className="card"><h2>D) Clasificación de la reclamación</h2><span className={`badge ${r.classification?.toLowerCase()??"neutral"}`}>{complaintClassificationLabel(r.classification)}</span></div>
   <div className="card"><h2>E) Evaluación regulatoria</h2><dl className="info-grid">
    <div className="info-item"><dt>Puede requerir retirada</dt><dd>{yesNo(r.potentialRecall)}</dd></div><div className="info-item"><dt>Activar GC-00/029</dt><dd>{yesNo(r.recallProcedureRequired)}</dd></div><div className="info-item"><dt>Notificación autoridad</dt><dd>{yesNo(r.authorityNotificationRequired)}</dd></div><div className="info-item"><dt>Comunicación titular / cliente</dt><dd>{yesNo(r.responsiblePartyCommunicationRequired)}</dd></div><div id={reviewTarget.regulatoryJustification.anchorId} className="info-item full review-target"><dt><span>Justificación</span><ReviewMarker target={reviewTarget.regulatoryJustification}/></dt><dd className="prose-value"><FormattedText value={r.regulatoryJustification} /><TextTablesView items={textTables.regulatoryJustification} /></dd></div>
   </dl></div>
   <div id={reviewTarget.resolutionLines.anchorId} className="card review-target"><div className="review-target-heading"><h2>F) Líneas de actuación y resolución</h2><ReviewMarker target={reviewTarget.resolutionLines}/></div><div className="prose-value prose-block"><FormattedText value={r.resolutionLines} /><TextTablesView items={textTables.resolutionLines} /></div></div>

   <div id={reviewTarget.derivedActions.anchorId} className="card review-target"><div className="review-target-heading"><h2>G) Acciones derivadas</h2><ReviewMarker target={reviewTarget.derivedActions}/></div><p><strong>¿Existen acciones?</strong> {effectiveHasActions?"Sí":r.hasDerivedActions===false?"No":"Pendiente"}</p>
    {effectiveHasActions?<><p>{joinLabels(r.resolutionActions,resolutionLabels)}</p>
     {r.capaPlans.length?<><h3>CAPA propuestas / vinculadas</h3><div className="linked-record-grid">{r.capaPlans.map(x=>{const navigation=capaPlanNavigation(x);const target=capaPlanTargetById.get(x.id)!;return <article id={target.anchorId} className="linked-record-card review-target" key={x.id}><div className="linked-record-main"><div className="linked-record-heading"><strong>{x.actionType==="CORRECTIVE"?"Correctora":"Preventiva"}</strong><span className="badge neutral">{capaProposalStatusLabel(x.proposalStatus)}</span><ReviewMarker target={target}/></div><p>{x.description}</p><small>{txt(x.responsible)}{x.responsibleUser?` (usuario: ${x.responsibleUser.displayName})`:""} · {formatDate(x.plannedExecutionDate)} · {x.businessCapaCode??"Pendiente de CAPA"}</small></div><div className="linked-record-action">{navigation.kind==="OPEN"?<Link className="button small" href={qmsRecordHref("CAPA",navigation.recordId)}>Abrir CAPA</Link>:navigation.kind==="CREATE"?<PermissionGate permission="EDIT"><PermissionGate permission="CREATE" module="CAPA"><Link className="button small primary" href={`/capa/new?fromComplaintPlanId=${x.id}`}>Crear CAPA</Link></PermissionGate></PermissionGate>:null}</div></article>})}</div></>:null}
     {r.derivedActions.some(x=>x.actionType==="RETURN")?<><h3>Devoluciones propuestas / vinculadas</h3><div className="table-scroll"><table><thead><tr><th>Código</th><th>Acción / detalle</th><th>Responsable</th><th>Fecha prevista</th><th>Acción</th></tr></thead><tbody>{r.derivedActions.filter(x=>x.actionType==="RETURN").map(x=>{const linked=derived.find(record=>record.recordType==="RETURN"&&record.businessCode===x.businessCode);return <tr key={x.id}><td>{txt(x.businessCode)}</td><td>{txt(x.description)}</td><td>{txt(x.responsible)}<ResponsibleUserNote user={x.responsibleUser}/></td><td>{formatDate(x.plannedExecutionDate)}</td><td>{linked?<Link className="button small" href={qmsRecordHref("RETURN",linked.id)}>Abrir devolución</Link>:!x.businessCode?<PermissionGate permission="EDIT"><PermissionGate permission="CREATE" module="RETURN"><Link className="button small primary" href={`/returns/new?fromComplaintId=${id}`}>Crear devolución</Link></PermissionGate></PermissionGate>:<span className="muted-note">Pendiente de vincular</span>}</td></tr>})}</tbody></table></div></>:null}
     {(r.immediateActionDetails||r.recallActionDetails||r.creditActionDetails||r.replacementActionDetails||r.otherResolutionDetails)?<><h3>Detalle de otras acciones</h3><dl className="info-grid">
      {r.immediateActionDetails||textTables.immediateActionDetails?<div className="info-item wide"><dt>Acción inmediata</dt><dd className="prose-value"><FormattedText value={r.immediateActionDetails} /><TextTablesView items={textTables.immediateActionDetails} /></dd></div>:null}
      {r.recallActionDetails||textTables.recallActionDetails?<div className="info-item wide"><dt>Retirada del mercado</dt><dd className="prose-value"><FormattedText value={r.recallActionDetails} /><TextTablesView items={textTables.recallActionDetails} /></dd></div>:null}
      {r.creditActionDetails||textTables.creditActionDetails?<div className="info-item wide"><dt>Abono</dt><dd className="prose-value"><FormattedText value={r.creditActionDetails} /><TextTablesView items={textTables.creditActionDetails} /></dd></div>:null}
      {r.replacementActionDetails||textTables.replacementActionDetails?<div className="info-item wide"><dt>Reposición</dt><dd className="prose-value"><FormattedText value={r.replacementActionDetails} /><TextTablesView items={textTables.replacementActionDetails} /></dd></div>:null}
      {r.otherResolutionDetails||textTables.otherResolutionDetails?<div className="info-item wide"><dt>Otros</dt><dd className="prose-value"><FormattedText value={r.otherResolutionDetails} /><TextTablesView items={textTables.otherResolutionDetails} /></dd></div>:null}
     </dl></>:null}
     {derived.length?<><h3>Relaciones QMS activas</h3><div className="relation-chips">{derived.map(x=><Link key={x.id} className="relation-chip" href={qmsRecordHref(x.recordType,x.id)}>{qmsRecordDisplayCode(x,qmsRecordTypeLabel(x.recordType))}</Link>)}</div></>:null}
    </>:<div className="empty-panel">No se han definido acciones derivadas.</div>}
   </div>

   <div className="card"><h2>H) Comunicación</h2><dl className="info-grid"><div className="info-item"><dt>Fecha</dt><dd>{formatDate(r.communicationDate)}</dd></div><div className="info-item"><dt>Medio</dt><dd>{txt(r.communicationMedium)}</dd></div><div className="info-item"><dt>Emisor / destinatario</dt><dd>{txt(r.communicationParties)}</dd></div><div id={reviewTarget.communicationSummary.anchorId} className="info-item full review-target"><dt><span>Resumen</span><ReviewMarker target={reviewTarget.communicationSummary}/></dt><dd className="prose-value"><FormattedText value={r.communicationSummary} /><TextTablesView items={textTables.communicationSummary} /></dd></div></dl></div>
   <div className="card"><h2>I) Conclusión Parte I y seguimiento</h2><dl className="info-grid"><div className="info-item"><dt>Decisión Parte II</dt><dd>{r.partIIRequired===true?"Continúa en Parte II":r.partIIRequired===false?"No procede · cierre en Parte I":"Pendiente de decisión / seguimiento"}</dd></div><div className="info-item"><dt>Próximo seguimiento</dt><dd>{r.status==="OPEN"?formatDate(r.nextFollowupDate):"—"}</dd></div><div id={reviewTarget.conclusion.anchorId} className="info-item full review-target"><dt><span>Conclusión / pendientes</span><ReviewMarker target={reviewTarget.conclusion}/></dt><dd className="prose-value"><FormattedText value={r.conclusion} /><TextTablesView items={textTables.conclusion} /></dd></div></dl></div>
  </>:null}

  {tab==="part-ii"?<div className="card"><h2>Parte II · Seguimiento y cierre</h2>
   {r.partIIRequired!==true?<div className="analytics-note">{r.partIIRequired===false?"Parte II no procede. El expediente puede cerrarse en Parte I.":"Parte II pendiente de decisión/seguimiento."}</div>:<>
    <h3>A) Respuesta del proveedor o al / del cliente</h3><dl className="info-grid"><div className="info-item"><dt>Fecha respuesta</dt><dd>{formatDate(r.responseDate)}</dd></div><div className="info-item"><dt>Medio</dt><dd>{txt(r.responseMedium)}</dd></div><div className="info-item"><dt>Respuesta suficiente</dt><dd>{bool(r.responseSufficient)}</dd></div><div id={reviewTarget.responseSummary.anchorId} className="info-item full review-target"><dt><span>Resumen / compromisos</span><ReviewMarker target={reviewTarget.responseSummary}/></dt><dd className="prose-value"><FormattedText value={r.responseSummary} /><TextTablesView items={textTables.responseSummary} /></dd></div></dl>
    <h3>B) Verificación de eficacia</h3><dl className="info-grid"><div className="info-item"><dt>Resultado</dt><dd>{complaintEffectivenessLabel(r.effectivenessStatus)}</dd></div><div id={reviewTarget.effectivenessAssessment.anchorId} className="info-item full review-target"><dt><span>Valoración</span><ReviewMarker target={reviewTarget.effectivenessAssessment}/></dt><dd className="prose-value"><FormattedText value={r.effectivenessAssessment} /><TextTablesView items={textTables.effectivenessAssessment} /></dd></div></dl>
    <h3>C) Cierre</h3><dl className="info-grid"><div className="info-item"><dt>Estado acciones</dt><dd>{r.closeActionStatus==="COMPLETED"?"Completadas":r.closeActionStatus==="LINKED"?"Vinculadas a seguimiento independiente":r.closeActionStatus==="PENDING"?"Pendientes":"—"}</dd></div><div className="info-item"><dt>Referencias / responsable</dt><dd>{txt(r.closeActionReferences)}</dd></div><div className="info-item"><dt>Próximo seguimiento</dt><dd>{formatDate(r.nextFollowupDate)}</dd></div><div className="info-item"><dt>Estado final</dt><dd>{complaintStatusLabel(r.status)}</dd></div><div className="info-item"><dt>Fecha cierre</dt><dd>{formatDate(r.closedAt)}</dd></div><div id={reviewTarget.closeConclusion.anchorId} className="info-item full review-target"><dt><span>Conclusión</span><ReviewMarker target={reviewTarget.closeConclusion}/></dt><dd className="prose-value"><FormattedText value={r.closeConclusion} /><TextTablesView items={textTables.closeConclusion} /></dd></div></dl>
   </>}
  </div>:null}

  {tab==="versions"?<div className="card"><div className="section-title-row version-section-title-row"><div className="section-title-copy"><h2>Versiones / seguimientos del expediente</h2><p className="muted-note version-section-help">V00 corresponde a la apertura/registro inicial. Los seguimientos formales crean V01, V02, V03… Guardar cambios mantiene la versión vigente.</p></div>{currentVersion?<span className="badge neutral">Actual {versionLabel(currentVersion.sequenceNumber)}</span>:null}</div>
   {r.qmsRecord.versions.length?<div className="timeline">{[...r.qmsRecord.versions].reverse().map(item=>{
    const summary=recordVersionSummary("COMPLAINT",item.snapshot);
    const versionDate=complaintSnapshotVersionFollowupDate(item.snapshot,item.sequenceNumber);
    const signedDocument=item.documents.find(document=>document.kind==="SIGNED_PDF")??null;
    const kind=item.sequenceNumber===0?"Versión inicial":item.kind==="REOPENING"?"Reapertura":item.kind==="HISTORICAL_STATE"?"Estado histórico":"Seguimiento / versión";
    return <article className="timeline-item record-version-item" key={item.id}>
     <header className="record-version-header"><strong>{complaintFollowupLabel(item.sequenceNumber)} · {kind}</strong><span className={`badge ${summary.status==="DRAFT"?"neutral":summary.status==="OPEN"?"open":"closed"}`}>{summary.status==="DRAFT"?"Borrador":summary.status==="OPEN"?"Abierta":"Cerrada"}</span>{item.frozenAt?<span className="badge neutral">Histórica</span>:<span className="badge neutral">Vigente</span>}</header>
     <div className="record-version-details">
      <div className="record-version-detail"><span>Fecha seguimiento / versión</span><strong>{formatDate(versionDate)}</strong></div>
      <div className="record-version-detail"><span>Próximo seguimiento</span><strong>{formatDate(summary.nextFollowupDate)}</strong></div>
      <div className="record-version-detail"><span>Eficacia</span><strong>{complaintEffectivenessLabel(summary.effectivenessStatus??"PENDING")}</strong></div>
      <div className="record-version-detail"><span>Motivo</span><strong>{item.reason??"—"}</strong></div>
      <div className="record-version-detail"><span>Registrada</span><strong>{formatDate(item.createdAt)} · {item.createdByText??"Sistema"}</strong></div>
     </div>
     <div className="document-actions">
      <PermissionGate permission={["GENERATE_DOCUMENT","DOWNLOAD"]}><a className="button small" href={`/api/complaints/${id}/annex-iii?version=${item.sequenceNumber}`}>Descargar Anexo III {versionLabel(item.sequenceNumber)}</a></PermissionGate>
      <PermissionGate permission={["GENERATE_DOCUMENT","DOWNLOAD"]}><a className="button small" href={`/api/complaints/${id}/annex-iv?version=${item.sequenceNumber}`}>Descargar Anexo IV {versionLabel(item.sequenceNumber)}</a></PermissionGate>
      {signedDocument?<PermissionGate permission="DOWNLOAD"><a className="button small" href={`/api/complaints/${id}/versions/${item.sequenceNumber}/signed-pdf`}>Descargar PDF firmado {versionLabel(item.sequenceNumber)}</a><PreviewLink href={`/api/complaints/${id}/versions/${item.sequenceNumber}/signed-pdf`} mimeType="application/pdf" /></PermissionGate>:null}
     </div>
     <div className="version-signed-document"><strong>PDF firmado: {signedDocument?"Disponible":"No cargado"}</strong>
      {signedDocument?<small className="muted-note">{signedDocument.fileName} · {Math.max(1,Math.round(signedDocument.fileSize/1024))} KB · cargado {formatDate(signedDocument.uploadedAt)} · {signedDocument.uploadedByText??"Usuario no informado"}</small>:<small className="muted-note">Carga aquí el documento firmado correspondiente exclusivamente a {versionLabel(item.sequenceNumber)}.</small>}
      <PermissionGate permission="ATTACH_DOCUMENT"><SignedVersionDocumentForm reloadOnSuccess action={uploadComplaintSignedPdfAction.bind(null,id,item.id)} defaultActor={currentActor()} replace={Boolean(signedDocument)}/></PermissionGate>
     </div>
    </article>
   })}</div>:<div className="empty-panel">Este expediente todavía no tiene snapshot persistido.</div>}
  </div>:null}

  {tab==="relations"?(r.status==="DRAFT"?<div className="empty-panel">Las relaciones operativas estarán disponibles cuando la reclamación pase a estado Abierta.</div>:<div className="card"><div className="section-title-row"><div><h2>Relaciones QMS</h2><p className="section-help">Una reclamación puede generar CAPA y devoluciones. La relación canónica se conserva sin duplicar relaciones inversas.</p></div><div className="heading-actions"><PermissionGate permission="EDIT"><PermissionGate permission="CREATE" module="CAPA"><Link className="button small" href={`/capa/new?fromComplaintId=${id}`}>Crear CAPA</Link></PermissionGate></PermissionGate><PermissionGate permission="EDIT"><PermissionGate permission="CREATE" module="RETURN"><Link className="button small" href={`/returns/new?fromComplaintId=${id}`}>Crear devolución</Link></PermissionGate></PermissionGate></div></div>
   {derived.length?<div className="relation-list">{derived.map(x=><div className="relation-card" key={x.id}><span>{x.recordType==="CAPA"?"CAPA derivada":"Devolución derivada"}</span><Link href={qmsRecordHref(x.recordType,x.id)}><strong>{qmsRecordDisplayCode(x,qmsRecordTypeLabel(x.recordType))}{!x.isActive?" · Anulado":""}</strong></Link><small>{qmsRecordTypeLabel(x.recordType)}</small><PermissionGate permission="EDIT" recordId={x.id}><form action={unlinkComplaintRelationAction.bind(null,id,x.id)}><CsrfField /><ActorField type="hidden" name="actor" value={r.createdByText??currentActor()}/><button className="button danger small" type="submit">Desvincular</button></form></PermissionGate></div>)}</div>:<div className="empty-panel">Todavía no hay CAPA ni devoluciones vinculadas.</div>}
   <PermissionGate permission="EDIT"><OperationalRelationForm action={addComplaintRelationAction.bind(null,id)} title="Vincular expediente existente" codeLabel="Codificación" buttonLabel="Vincular expediente" defaultActor={currentActor()} targetOptions={[{value:"CAPA",label:"CAPA"},{value:"RETURN",label:"Devolución"}]} currentRecordId={r.qmsRecord.id} currentRecordType="COMPLAINT"/></PermissionGate>
  </div>):null}

  {tab==="documents"?(r.status==="DRAFT"?<div className="empty-panel">Los documentos oficiales estarán disponibles cuando la reclamación pase a estado Abierta.</div>:<div className="card"><h2>Documentos</h2><dl className="info-grid documents-info-grid">
   <div className="info-item"><dt>Versión formulario</dt><dd>{r.formVersion?.versionCode??"No asignada"}</dd></div>
   <div className="info-item"><dt>Plantilla Anexo III</dt><dd>{r.annexIIITemplateVersion?.versionCode??"No asignada"}</dd></div>
   <div className="info-item"><dt>Versión vigente</dt><dd>{currentVersion?versionLabel(currentVersion.sequenceNumber):"Sin versión"}</dd></div>
   <div className="info-item"><dt>PDF firmados</dt><dd>{signedVersionCount} de {r.qmsRecord.versions.length} versiones</dd></div>
   <div className="info-item"><dt>PDF firmado versión vigente</dt><dd>{currentVersion?`${versionLabel(currentVersion.sequenceNumber)} · ${currentSignedDocument?"Disponible":"No cargado"}`:"Sin versión"}</dd></div>
  </dl><p className="muted-note">La carga, descarga y sustitución de PDF firmado se gestiona por versión en la pestaña Versiones.</p><div className="document-grid">
   <div className="document-block"><h3>Anexo III · Informe de reclamación</h3><p>Plantilla oficial revisión {r.annexIIITemplateVersion?.versionCode??"sin asignar"}; documento cumplimentado desde la versión vigente.</p><div className="document-actions">{r.annexIIITemplateVersion?.id?<PermissionGate permission="DOWNLOAD" module="COMPLAINT"><a className="button" href={`/api/settings/templates/${r.annexIIITemplateVersion.id}/download`}>Descargar plantilla oficial</a></PermissionGate>:<span className="muted-note">Plantilla pendiente de cargar.</span>}<PermissionGate permission={["GENERATE_DOCUMENT","DOWNLOAD"]}><a className="button primary" href={`/api/complaints/${id}/annex-iii`}>Generar Anexo III cumplimentado</a></PermissionGate></div></div>
   <div className="document-block"><h3>Anexo IV · Informe de respuesta</h3><p>Opcional cuando se requiere una respuesta formal al cliente. No es requisito universal de cierre. Las descargas históricas se realizan por versión.</p><div className="document-actions">{r.annexIVTemplateVersion?.id?<PermissionGate permission="DOWNLOAD" module="COMPLAINT"><a className="button" href={`/api/settings/templates/${r.annexIVTemplateVersion.id}/download`}>Descargar plantilla oficial</a></PermissionGate>:null}<PermissionGate permission={["GENERATE_DOCUMENT","DOWNLOAD"]}><a className="button" href={`/api/complaints/${id}/annex-iv`}>Generar informe de respuesta</a></PermissionGate></div></div>
   <div className="document-block"><h3>Anexo V · Listado de reclamaciones</h3><p>Listado oficial anual validado. Se genera desde la pantalla principal.</p><Link className="button" href="/complaints">Ir al listado y descargar Anexo V</Link></div>
  </div>
  {r.qmsRecord.generatedDocuments.length?<><h3>Generaciones registradas</h3><div className="timeline">{r.qmsRecord.generatedDocuments.map(x=>{const generatedVersion=r.qmsRecord.versions.find(v=>v.id===x.recordVersionId);return <div className="timeline-item document-generation-item" key={x.id}><strong className="document-generation-type">{x.documentType}{generatedVersion?` · ${versionLabel(generatedVersion.sequenceNumber)}`:""}</strong><small className="muted-note document-generation-meta">Generado {formatDate(x.generatedAt)} · {x.generatedByText??"Usuario no informado"}</small></div>})}</div></>:null}
  </div>):null}

  {tab==="review"?<div className="review-overview">
   <div className="card"><div className="section-title-row"><div><h2>Revisión del expediente</h2><p className="muted-note">Comentarios asociados a objetivos estables y a la versión del expediente que estaba vigente al crearlos.</p></div><PermissionGate permission="REVIEW"><ReviewModeToggle active={reviewMode} href={reviewModeHref(basePath,"review",reviewMode)}/></PermissionGate></div><ReviewStatusSummary/></div>
   <ReviewThreadList/>
  </div>:null}

  {tab==="versions"&&r.followups.length?<div className="card"><h2>Seguimientos históricos legacy</h2><p className="muted-note">Datos anteriores conservados para consulta. Los nuevos seguimientos se registran exclusivamente como versiones.</p><div className="timeline">{r.followups.map(item=><article key={item.id} className="timeline-item"><strong>{formatDate(item.followupDate)} · {item.completedByText??"—"}</strong><div className="prose-value prose-timeline"><FormattedText value={item.comment} /></div><small>Próximo seguimiento: {formatDate(item.nextFollowupDate)}</small></article>)}</div></div>:null}
  {tab==="evidence"?<RecordEvidencePanel qmsRecordId={r.qmsRecord.id} active={r.qmsRecord.isActive} action={uploadComplaintEvidenceAction.bind(null,r.id)}/>:null}
  {tab==="timeline"?<RecordTimeline qmsRecordId={r.qmsRecord.id}/>:null}
  {tab==="audit-trail"?<AuditTrailPanel rootKey={`QMS_RECORD:${r.qmsRecord.id}`} basePath={basePath} page={Number(auditPage)||1}/>:null}
 </section>
 <ReviewDrawer/>
 </ReviewWorkspaceProvider>;
}

export default async function ComplaintDetailPage(...args: Parameters<typeof ComplaintDetailPageAuthenticatedContent>) {
  return authorizedPage("src/app/complaints/[id]/page.tsx", () => ComplaintDetailPageAuthenticatedContent(...args), args);
}
