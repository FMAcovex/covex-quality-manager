import Link from "next/link";
import { notFound } from "next/navigation";
import { addReturnFollowupAction,addReturnRelationAction,unlinkReturnComplaintAction } from "@/modules/returns/actions";
import { formatDate,productTypeLabel,returnDecisionLabel,returnStatusLabel,returnTypeLabel,tri } from "@/modules/returns/domain";
import { getReturnDetail } from "@/modules/returns/queries";
import { BasicFollowupForm } from "@/components/basic-followup-form";
import { qmsRecordHref,qmsRecordDisplayCode } from "@/lib/qms/record-links";
import { OperationalRelationForm } from "@/components/operational-relation-form";
import { QmsAdministrativeStatus } from "@/components/qms-administrative-status";

export const dynamic="force-dynamic";
const tabs=[["summary","Resumen"],["checks","Comprobaciones"],["followups","Seguimientos"],["relations","Relaciones"],["documents","Documentos"],["history","Historial"]] as const;
const txt=(v:string|null|undefined)=>v||"—";

export default async function ReturnDetailPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{tab?:string}>}){
 const {id}=await params;
 const {tab:raw}=await searchParams;
 const tab=tabs.some(([k])=>k===raw)?raw!:"summary";
 const r=await getReturnDetail(id);
 if(!r)notFound();

 const complaintOrigins=r.qmsRecord.targetRelations
  .filter(x=>x.relationType==="GENERATES"&&x.sourceRecord.recordType==="COMPLAINT")
  .map(x=>x.sourceRecord);
 const primaryComplaintOrigin=complaintOrigins.length===1?complaintOrigins[0]:null;

 return <section className="workspace">
  <div className="record-header">
   <div>
    <p className="eyebrow"><Link href="/returns">← Devoluciones</Link></p>
    <div className="record-title-line">
     <h1>{qmsRecordDisplayCode(r.qmsRecord)}</h1>
     <span className={`badge ${r.status==="DRAFT"?"neutral":r.status==="OPEN"?"open":"closed"}`}>{returnStatusLabel(r.status)}</span>
     <span className="badge neutral">{returnTypeLabel(r.returnType)}</span>
     <span className="badge neutral">{returnDecisionLabel(r.decision)}</span>
    </div>
    <p className="muted-note">Comunicación {formatDate(r.communicationDate)} · {txt(r.customerEntity)}</p>
   </div>
   <div className="record-actions">
    <Link className="button primary" href={`/returns/${id}/edit`}>Editar</Link>
    {r.status!=="DRAFT"?<Link className="button" href={`/returns/${id}?tab=followups#new-followup`}>+ Seguimiento</Link>:null}
   </div>
  </div>

  {r.status==="DRAFT"?<div className="analytics-note"><strong>Borrador:</strong> esta devolución todavía no es operativa. Completa los campos obligatorios y cambia el estado a Abierta para iniciar su ciclo formal.</div>:null}

  <QmsAdministrativeStatus
   qmsRecordId={r.qmsRecord.id}
   isActive={r.qmsRecord.isActive}
   code={qmsRecordDisplayCode(r.qmsRecord)}
   annulledAt={r.qmsRecord.annulledAt?.toISOString() ?? null}
   annulledByText={r.qmsRecord.annulledByText}
   annulledReason={r.qmsRecord.annulledReason}
   defaultActor={process.env.DEFAULT_ACTOR_NAME || "Usuario demo"}
  />

  <nav className="record-tabs">{tabs.map(([k,l])=><Link key={k} className={tab===k?"active":""} href={`/returns/${id}?tab=${k}`}>{l}</Link>)}</nav>

  {tab==="summary"?<>
   <div className="return-summary-hero">
    <div className="card return-summary-card">
     <h2>Datos generales</h2>
     <dl className="info-grid return-summary-grid">
      <div className="info-item"><dt>Cliente / entidad</dt><dd>{txt(r.customerEntity)}</dd></div>
      <div className="info-item"><dt>País</dt><dd>{txt(r.country)}</dd></div>
      <div className="info-item"><dt>Fecha comunicación</dt><dd>{formatDate(r.communicationDate)}</dd></div>
      <div className="info-item"><dt>Fecha recepción</dt><dd>{formatDate(r.receivedAt)}</dd></div>
      <div className="info-item"><dt>Área</dt><dd>{r.departmentCodeSnapshot??r.department?.code??"—"}</dd></div>
      <div className="info-item"><dt>Tipo</dt><dd>{returnTypeLabel(r.returnType)}</dd></div>
      <div className="info-item"><dt>Decisión</dt><dd>{returnDecisionLabel(r.decision)}</dd></div>
      <div className="info-item"><dt>Fecha decisión</dt><dd>{formatDate(r.decisionDate)}</dd></div>
      <div className="info-item full"><dt>Dirección</dt><dd>{txt(r.address)}</dd></div>
      <div className="info-item wide"><dt>Condiciones de conservación</dt><dd>{txt(r.conservationConditions)}</dd></div>
      <div className="info-item"><dt>N.º albarán</dt><dd>{txt(r.deliveryNote)}</dd></div>
      <div className="info-item"><dt>Fecha cierre</dt><dd>{formatDate(r.closedAt)}</dd></div>
      <div className="info-item full"><dt>Motivo / incidencias</dt><dd className="prose-value">{txt(r.reasonObservations)}</dd></div>
      <div className="info-item full"><dt>Documentación anexada</dt><dd className="prose-value">{txt(r.attachedDocumentation)}</dd></div>
      <div className="info-item full"><dt>Destino final</dt><dd className="prose-value">{txt(r.finalDestination)}</dd></div>
      <div className="info-item"><dt>Trazabilidad actualizada</dt><dd>{tri(r.traceabilityUpdated)}</dd></div>
     </dl>
    </div>
   </div>

   <div className="card">
    <div className="section-title-row"><div><h2>Productos devueltos</h2><p className="section-help">Detalle de los productos incluidos en esta devolución.</p></div><span className="badge neutral">{r.products.length} {r.products.length===1?"producto":"productos"}</span></div>
    <div className="return-product-summary-grid">
     {r.products.map((x,index)=><article className="return-product-summary-card" key={x.id}>
      <header><strong>{x.productNameCode}</strong><span className="badge neutral">Producto {index+1}</span></header>
      <dl className="info-grid">
       <div className="info-item"><dt>Tipo</dt><dd>{productTypeLabel(x.productType)}</dd></div>
       <div className="info-item"><dt>Formato</dt><dd>{txt(x.format)}</dd></div>
       <div className="info-item"><dt>Lote</dt><dd>{txt(x.lot)}</dd></div>
       <div className="info-item"><dt>Cad./reanálisis</dt><dd>{txt(x.expiryReanalysis)}</dd></div>
       <div className="info-item"><dt>Cantidad</dt><dd>{[x.quantity,x.unit].filter(Boolean).join(" ")||"—"}</dd></div>
       <div className="info-item"><dt>Peso neto</dt><dd>{txt(x.netWeight)}</dd></div>
       <div className="info-item"><dt>Peso bruto</dt><dd>{txt(x.grossWeight)}</dd></div>
       <div className="info-item full"><dt>Observaciones recepción</dt><dd className="prose-value">{txt(x.receptionObservations)}</dd></div>
      </dl>
     </article>)}
    </div>
   </div>

   <div className="card">
    <h2>Reclamación de origen</h2>
    {complaintOrigins.length?<div className="relation-list">{complaintOrigins.map(x=><div className="relation-card" key={x.id}><span>Reclamación de origen</span><Link href={qmsRecordHref(x.recordType,x.id)}><strong>{qmsRecordDisplayCode(x,"Reclamación")}{!x.isActive?" · Anulado":""}</strong></Link><small>El código abre la Reclamación relacionada.</small></div>)}</div>:<div className="empty-panel">{primaryComplaintOrigin?null:"No existe una reclamación de origen vinculada."}</div>}
    <dl className="info-grid return-related-document"><div className="info-item full"><dt>Documento relacionado</dt><dd>{primaryComplaintOrigin?<Link href={qmsRecordHref(primaryComplaintOrigin.recordType,primaryComplaintOrigin.id)}>{r.relatedDocument??primaryComplaintOrigin.businessCode??"Reclamación"}</Link>:txt(r.relatedDocument)}</dd></div></dl>
   </div>
  </>:null}

  {tab==="checks"?<div className="return-check-sections">
   <div className="card"><h2>Comprobaciones para posible reintegración</h2><div className="return-check-grid-display">{[
    ["Plazo aceptable",r.withinAcceptedReturnPeriod],
    ["+15/+25 ºC ≤10 días",r.roomTemperatureWithinTenDays],
    ["+2/+8 ºC ≤48 h",r.coldChainWithinFortyEightHours],
    ["Data Matrix activo",r.uniqueIdentifierActive],
    ["Tamper Evidence intacto",r.tamperEvidenceIntact],
    ["Envases íntegros",r.packagingIntegrityOk],
    ["Declaración cliente",r.customerDeclarationAvailable],
    ["Conservación/transporte conforme",r.storageTransportConditionsOk],
    ["Sin uso/daño/contaminación",r.noUseDamageContamination],
    ["Sin retirada/alerta/bloqueo",r.noRecallAlertBlock],
    ["Caducidad aceptable",r.expiryAcceptable],
    ["Evaluación QC",r.qcAssessmentCompleted]
   ].map(([l,v])=><div className="return-check-item" key={String(l)}><span>{String(l)}</span><strong>{tri(v as string|null)}</strong></div>)}</div></div>
   <div className="card"><h2>Termolábiles / temperatura controlada</h2><div className="return-check-grid-display">{[
    ["Registro almacenamiento",r.storageTemperatureRecord],
    ["Temperatura retorno",r.returnTransportTempEvidence],
    ["Embalaje conforme",r.transportPackagingSuitable],
    ["Temperatura recepción",r.receiptTemperatureAcceptable],
    ["Excursión evaluada",r.temperatureExcursionEvaluated],
    ["Sistema validado",r.coldChainReturnSystemValidated]
   ].map(([l,v])=><div className="return-check-item" key={String(l)}><span>{String(l)}</span><strong>{tri(v as string|null)}</strong></div>)}</div></div>
  </div>:null}

  {tab==="followups"?(r.status==="DRAFT"?<div className="empty-panel">Los seguimientos estarán disponibles cuando la devolución pase a estado Abierta.</div>:<>
   <div className="card"><h2>Seguimientos</h2>{r.followups.length?<div className="timeline return-timeline">{r.followups.map(x=><div className="timeline-item return-timeline-item" key={x.id}><header><strong>{formatDate(x.followupDate)}</strong><span>{x.completedByText}</span></header><p>{x.comment}</p><div className="return-timeline-meta"><span><strong>Próximo:</strong> {formatDate(x.nextFollowupDate)}</span><span><strong>Evidencia:</strong> {txt(x.evidenceReference)}</span></div></div>)}</div>:<div className="empty-panel">Sin seguimientos.</div>}</div>
   {r.status==="OPEN"?<div className="card" id="new-followup"><h2>Nuevo seguimiento</h2><BasicFollowupForm action={addReturnFollowupAction.bind(null,id)} defaultActor={process.env.DEFAULT_ACTOR_NAME||"Usuario demo"} /></div>:null}
  </>):null}

  {tab==="relations"?(r.status==="DRAFT"?<div className="empty-panel">La relación con la reclamación de origen estará disponible cuando la devolución pase a estado Abierta.</div>:<div className="card"><h2>Reclamación de origen</h2><p className="section-help">Una devolución vinculada a una reclamación conserva una única relación canónica Reclamación → Devolución. Desvincular conserva ambos expedientes.</p>{complaintOrigins.length?<div className="relation-list">{complaintOrigins.map(x=><div className="relation-card" key={x.id}><span>Reclamación de origen</span><Link href={qmsRecordHref(x.recordType,x.id)}><strong>{qmsRecordDisplayCode(x,"Reclamación")}{!x.isActive?" · Anulado":""}</strong></Link><small>Vista inversa de la relación QMS.</small><form action={unlinkReturnComplaintAction.bind(null,id,x.id)}><input type="hidden" name="actor" value={r.createdByText??process.env.DEFAULT_ACTOR_NAME??"Usuario demo"}/><button className="button danger small" type="submit">Desvincular</button></form></div>)}</div>:<div className="empty-panel">Esta devolución no tiene una reclamación de origen vinculada.</div>}<OperationalRelationForm action={addReturnRelationAction.bind(null,id)} title="Vincular reclamación existente" codeLabel="Codificación de reclamación" codePlaceholder="R/GC-00/001/2026" buttonLabel="Vincular reclamación" defaultActor={process.env.DEFAULT_ACTOR_NAME||"Usuario demo"} targetOptions={[{value:"COMPLAINT",label:"Reclamación"}]} currentRecordId={r.qmsRecord.id} currentRecordType="RETURN" /></div>):null}

  {tab==="documents"?(r.status==="DRAFT"?<div className="empty-panel">Los documentos oficiales estarán disponibles cuando la devolución pase a estado Abierta.</div>:<div className="card"><h2>Documentos</h2><div className="document-grid">
   <div className="document-block"><h3>Anexo III · Formulario de devolución</h3><p>Plantilla oficial y formulario cumplimentado.</p><div className="document-actions">{r.annexIIITemplateVersion?.id?<a className="button" href={`/api/settings/templates/${r.annexIIITemplateVersion.id}/download`}>Descargar plantilla oficial</a>:<span className="muted-note">Plantilla pendiente de cargar.</span>}<a className="button primary" href={`/api/returns/${id}/annex-iii`}>Generar Anexo III cumplimentado</a></div></div>
   <div className="document-block"><h3>Anexo IV · Hoja de devolución</h3><p>Se genera una hoja por producto/lote registrado.</p><div className="document-actions">{r.annexIVTemplateVersion?.id?<a className="button" href={`/api/settings/templates/${r.annexIVTemplateVersion.id}/download`}>Descargar plantilla oficial</a>:null}{r.products.map(p=><a key={p.id} className="button small primary" href={`/api/returns/${id}/annex-iv?product=${p.id}`}>Generar · {p.productNameCode}{p.lot?` · ${p.lot}`:""}</a>)}</div></div>
   <div className="document-block"><h3>Anexo V · Declaración cliente</h3><p>Plantilla oficial y declaración para remitir al cliente.</p><div className="document-actions">{r.annexVTemplateVersion?.id?<a className="button" href={`/api/settings/templates/${r.annexVTemplateVersion.id}/download`}>Descargar plantilla oficial</a>:null}<a className="button primary" href={`/api/returns/${id}/annex-v`}>Generar Anexo V</a></div></div>
   <div className="document-block"><h3>Anexo VI · Listado de devoluciones</h3><p>Listado oficial anual en Excel. Se descarga desde el listado principal.</p><Link className="button" href="/returns">Ir al listado y descargar Anexo VI</Link></div>
  </div></div>):null}

  {tab==="history"?<div className="card"><h2>Historial interno de modificaciones</h2><p className="muted-note">Historial administrativo del expediente. Devoluciones mantiene un único expediente editable, sin revisiones funcionales.</p>{r.qmsRecord.history.length?<div className="timeline return-timeline">{r.qmsRecord.history.map(x=><div className="timeline-item return-timeline-item history-entry" key={x.id}><header><strong>{formatDate(x.changedAt)}</strong><span>{x.changedByText??"Sistema"}</span><span className="badge neutral">{x.source}</span></header><p className="history-entry-detail"><strong>{x.fieldPath}</strong>{x.reason?<span> · Motivo: {x.reason}</span>:null}</p></div>)}</div>:<div className="empty-panel">Sin cambios registrados.</div>}</div>:null}
 </section>;
}
