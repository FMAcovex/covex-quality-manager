"use client";

import Link from "next/link";
import { submittedDefaults } from "@/lib/forms/preserved-state";
import { useActionState,useState } from "react";
import type { ComplaintCapaPlanInput,ComplaintDerivedActionInput,ComplaintFormDefaults,ComplaintFormState,DepartmentOption } from "@/modules/complaints/types";

const initial:ComplaintFormState={error:null};
const emptyCapa:ComplaintCapaPlanInput={actionType:"CORRECTIVE",description:"",plannedExecutionDate:"",responsible:"",businessCapaCode:""};
const emptyDerived:ComplaintDerivedActionInput={actionType:"",businessCode:"",description:"",responsible:"",plannedExecutionDate:""};

function Field({label,name,defaultValue,type="text",required=false,span=""}:{label:string;name:string;defaultValue?:string;type?:string;required?:boolean;span?:string}) {
 return <label className={`field ${span}`}><span>{label}{required?" *":""}</span><input name={name} type={type} defaultValue={defaultValue??""} required={required}/></label>;
}
function TextArea({label,name,defaultValue,help}:{label:string;name:string;defaultValue?:string;help?:string}) {
 return <label className="field full"><span>{label}</span>{help?<small className="muted-note">{help}</small>:null}<textarea name={name} defaultValue={defaultValue??""}/></label>;
}
function Bool({label,name,defaultValue}:{label:string;name:string;defaultValue?:string}) {
 return <label className="field"><span>{label}</span><select name={name} defaultValue={defaultValue??""}><option value="">No informado</option><option value="true">Sí</option><option value="false">No</option></select></label>;
}
function Tri({label,name,defaultValue}:{label:string;name:string;defaultValue?:string}) {
 return <label className="field"><span>{label}</span><select name={name} defaultValue={defaultValue??""}><option value="">No informado</option><option value="YES">Sí</option><option value="NO">No</option><option value="NA">N/A</option></select></label>;
}
function Checks({label,name,options,defaults=[]}:{label:string;name:string;options:readonly (readonly [string,string])[];defaults?:string[]}) {
 return <div className="field full"><span>{label}</span><div className="checkbox-group">{options.map(([v,l])=><label key={v}><input type="checkbox" name={name} value={v} defaultChecked={defaults.includes(v)}/>{l}</label>)}</div></div>;
}

const sourceOptions=[["CUSTOMER","Cliente"],["DISTRIBUTOR","Distribuidor"],["MAH","Titular / MAH"],["CONSUMER","Consumidor / usuario"],["AUTHORITY","Autoridad / entidad sanitaria"],["SUPPLIER","Proveedor"],["CARRIER","Transportista / operador logístico"],["SUBCONTRACTOR","Subcontrata"],["INTERNAL","Detección interna"],["RECALL","Retirada"],["OTHER","Otro"]] as const;
const scopeOptions=[["MEDICINE","Medicamento"],["API","API"],["SUPPLEMENT","Complemento alimenticio"],["COSMETIC","Cosmética"],["MEDICAL_DEVICE","Producto sanitario"],["ENVIRONMENT","Medio ambiente"],["OTHER","Otro"]] as const;
const objectOptions=[["PRODUCT_MATERIAL","Producto / material"],["SERVICE","Servicio"],["EQUIPMENT_SYSTEM","Equipo / sistema"],["TRANSPORT","Transporte"],["SUBCONTRACTED_ACTIVITY","Actividad subcontratada"],["OTHER","Otro"]] as const;
const categoryOptions=[["PRODUCT_QUALITY","Calidad del producto"],["SPECIFICATIONS_TESTING","Especificaciones / análisis"],["PACKAGING","Acondicionamiento / envase"],["LABELLING_DOCUMENTATION","Etiquetado / documentación"],["QUANTITY_CONTENT","Cantidad / contenido"],["TRANSPORT_STORAGE","Transporte / almacenamiento"],["SERVICE_SUPPLY","Servicio / suministro"],["EQUIPMENT_SYSTEM","Equipo / sistema"],["ENVIRONMENT","Medio ambiente"],["OTHER","Otro"]] as const;
const containmentOptions=[["QUARANTINE","Bloqueo / cuarentena"],["SUSPEND_USE_DISTRIBUTION","Suspender uso / distribución"],["NOTIFY_PARTIES","Aviso a cliente / proveedor / titular / Autoridad"],["NONE","Ninguna"],["OTHER","Otra"]] as const;
const resolutionOptions=[["RETURN","Devolución"],["CORRECTIVE_ACTION","Acc. correctora"],["PREVENTIVE_ACTION","Acc. preventiva"],["IMMEDIATE_ACTION","Acc. inmediata"],["RECALL","Retirada"],["CREDIT","Abono"],["REPLACEMENT","Reposición"],["REJECT","Rechazo"],["REPROCESS","Reproceso"],["DISPOSE","Eliminación"],["KEEP_AS_IS","Mantener situación"],["SUPPLIER_INVESTIGATION","Investigación proveedor"],["SUPPLIER_EVALUATION","Evaluación proveedor"],["OPEN_DEVIATION","Abrir desviación"],["OPEN_CAPA","Abrir CAPA"],["OPEN_CHANGE","Abrir cambio"],["OTHER","Otros"]] as const;

export function ComplaintForm({mode,action,departments,defaults={},complaintId}:{mode:"create"|"edit";action:(s:ComplaintFormState,fd:FormData)=>Promise<ComplaintFormState>;departments:DepartmentOption[];defaults?:ComplaintFormDefaults;complaintId?:string}) {
 const [state,formAction,pending]=useActionState(action,initial);
 const formDefaults=submittedDefaults(defaults,state.submittedValues);
 const [capas,setCapas]=useState<ComplaintCapaPlanInput[]>(defaults.capaPlans??[]);
 const [derived,setDerived]=useState<ComplaintDerivedActionInput[]>(defaults.derivedActions??[]);
 const isDraft=(formDefaults.status??(mode==="create"?"DRAFT":"OPEN"))==="DRAFT";
 const patchCapa=(i:number,p:Partial<ComplaintCapaPlanInput>)=>setCapas(x=>x.map((v,n)=>n===i?{...v,...p}:v));
 const patchDerived=(i:number,p:Partial<ComplaintDerivedActionInput>)=>setDerived(x=>x.map((v,n)=>n===i?{...v,...p}:v));
 return <form key={state.formRevision??0} action={formAction} className="form-stack">
  <input type="hidden" name="capaPlansJson" value={JSON.stringify(capas)}/>
  <input type="hidden" name="derivedActionsJson" value={JSON.stringify(derived)}/>
  {state.error?<div className="form-errors"><strong>{state.error}</strong>{state.fieldErrors?.length?<ul>{state.fieldErrors.map(x=><li key={x}>{x}</li>)}</ul>:null}</div>:null}

  <section className="form-section">
   <h2>Parte I · 1. Registro e identificación</h2>
   <p className="section-help">Estructura del Anexo III de GC-00/027/03.</p>
   <div className="form-grid">
    <Field label="N.º reclamación" name="businessCode" defaultValue={formDefaults.businessCode} required/>
    <label className="field"><span>Departamento *</span><select name="departmentId" defaultValue={formDefaults.departmentId??""} required><option value="">Seleccionar…</option>{departments.map(d=><option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}</select></label>
    <Field label="Fecha apertura" name="openedAt" type="date" defaultValue={formDefaults.openedAt} required/>
    <Field label="Fecha detección" name="detectionDate" type="date" defaultValue={formDefaults.detectionDate}/>
    <Field label="Fecha recepción" name="receptionDate" type="date" defaultValue={formDefaults.receptionDate}/>
    <Field label="Detectado por" name="detectedBy" defaultValue={formDefaults.detectedBy}/>
    <Field label="Cumplimentado por" name="createdByText" defaultValue={formDefaults.createdByText} required/>
    {mode==="edit"?<Field label="Modificado por" name="modifiedByText" defaultValue={formDefaults.createdByText}/>:null}
    <label className="field"><span>Tipo *</span><select name="complaintType" defaultValue={formDefaults.complaintType??""} required><option value="">Seleccionar…</option><option value="PROVIDER">A proveedor / subcontrata</option><option value="CUSTOMER">De cliente / agente externo</option></select></label>
    <Field label="Cliente / Proveedor" name="partyName" defaultValue={formDefaults.partyName} required span="span-2"/>
    <Field label="Contacto (nombre, teléfono, mail)" name="contact" defaultValue={formDefaults.contact} span="span-2"/>
    <Checks label="Origen / fuente de detección" name="sourceTypes" options={sourceOptions} defaults={formDefaults.sourceTypes}/>
    <Field label="Otro origen · especificar" name="sourceOther" defaultValue={formDefaults.sourceOther} span="span-2"/>
    <Checks label="Ámbito" name="scopeTypes" options={scopeOptions} defaults={formDefaults.scopeTypes}/>
    <Field label="Otro ámbito · especificar" name="scopeOther" defaultValue={formDefaults.scopeOther} span="span-2"/>
    <Checks label="Objeto afectado" name="affectedObjectTypes" options={objectOptions} defaults={formDefaults.affectedObjectTypes}/>
    <Field label="Otro objeto · especificar" name="affectedObjectOther" defaultValue={formDefaults.affectedObjectOther} span="span-2"/>
    <Field label="Referencia material / servicio / equipo" name="reference" defaultValue={formDefaults.reference} span="span-2"/>
    <Field label="Lote / referencia" name="lotReference" defaultValue={formDefaults.lotReference}/>
    <Field label="Cantidad" name="quantity" defaultValue={formDefaults.quantity}/>
    <Field label="Caducidad / reanálisis" name="expiryReanalysis" defaultValue={formDefaults.expiryReanalysis}/>
    <Field label="Pedido / albarán / certificado" name="purchaseDeliveryReference" defaultValue={formDefaults.purchaseDeliveryReference} span="span-2"/>
    <TextArea label="Descripción de la reclamación *" name="description" defaultValue={formDefaults.description}/>
    <Checks label="Categoría / motivo" name="categoryTypes" options={categoryOptions} defaults={formDefaults.categoryTypes}/>
    <Field label="Otra categoría · especificar" name="categoryOther" defaultValue={formDefaults.categoryOther} span="span-2"/>
    <Bool label="¿Reclamación recurrente?" name="recurrent" defaultValue={formDefaults.recurrent}/>
    <Field label="Referencia recurrencia" name="recurrenceReference" defaultValue={formDefaults.recurrenceReference} span="span-2"/>
    <TextArea label="Evidencias / documentación adjunta" name="attachedDocumentation" defaultValue={formDefaults.attachedDocumentation}/>
    <Field label="Emitido por" name="emittedBy" defaultValue={formDefaults.emittedBy}/>
    <Field label="Validado por Garantía de Calidad" name="qaValidatedBy" defaultValue={formDefaults.qaValidatedBy} span="span-2"/>
   </div>
  </section>

  <section className="form-section">
   <h2>Parte I · 2. Evaluación inicial, investigación e impacto</h2>
   <div className="form-grid">
    <Tri label="Impacto calidad / GMP" name="impactQualityGmp" defaultValue={formDefaults.impactQualityGmp}/>
    <Tri label="Impacto seguridad / eficacia / paciente" name="impactSafetyEfficacy" defaultValue={formDefaults.impactSafetyEfficacy}/>
    <Tri label="Impacto regulatorio" name="impactRegulatory" defaultValue={formDefaults.impactRegulatory}/>
    <Tri label="Impacto medio ambiente" name="impactEnvironment" defaultValue={formDefaults.impactEnvironment}/>
    <Tri label="Otros lotes/productos/clientes similares" name="impactOtherSimilar" defaultValue={formDefaults.impactOtherSimilar}/>
    <Checks label="Medidas inmediatas / contención" name="containmentActions" options={containmentOptions} defaults={formDefaults.containmentActions}/>
    <Field label="Otra medida de contención" name="containmentOther" defaultValue={formDefaults.containmentOther} span="span-2"/>
    <TextArea label="Justificación del riesgo, alcance y medidas" name="riskJustification" defaultValue={formDefaults.riskJustification} help="Incluir estado, responsable, fecha y referencia cuando aplique."/>
    <TextArea label="Investigación, evidencias y alcance" name="investigation" defaultValue={formDefaults.investigation}/>
    <TextArea label="Conclusión del impacto" name="impactAssessment" defaultValue={formDefaults.impactAssessment}/>
    <label className="field"><span>Resultado</span><select name="investigationResult" defaultValue={formDefaults.investigationResult??""}><option value="">Pendiente</option><option value="PROCEDENT">Procedente</option><option value="NOT_PROCEDENT">No procedente</option><option value="INCONCLUSIVE">No concluyente</option><option value="NOT_ATTRIBUTABLE_TO_COVEX">No atribuible a COVEX</option></select></label>
    <TextArea label="Causa raíz y evidencias que la sustentan" name="rootCause" defaultValue={formDefaults.rootCause}/>
   </div>
  </section>

  <section className="form-section">
   <h2>Parte I · 3. Clasificación y evaluación regulatoria</h2>
   <div className="form-grid">
    <label className="field"><span>Clasificación</span><select name="classification" defaultValue={formDefaults.classification??""}><option value="">Pendiente</option><option value="CRITICAL">Crítica</option><option value="MAJOR">Mayor</option><option value="MINOR">Menor</option><option value="NO_GMP_IMPACT">Sin impacto GMP</option></select></label>
    <Tri label="¿Puede requerir retirada?" name="potentialRecall" defaultValue={formDefaults.potentialRecall}/>
    <Tri label="¿Activar GC-00/029 Retirada?" name="recallProcedureRequired" defaultValue={formDefaults.recallProcedureRequired}/>
    <Tri label="¿Notificación a autoridad sanitaria?" name="authorityNotificationRequired" defaultValue={formDefaults.authorityNotificationRequired}/>
    <Tri label="¿Comunicación a titular / cliente responsable?" name="responsiblePartyCommunicationRequired" defaultValue={formDefaults.responsiblePartyCommunicationRequired}/>
    <TextArea label="Justificación evaluación regulatoria" name="regulatoryJustification" defaultValue={formDefaults.regulatoryJustification}/>
    <Field label="Fecha evaluación inicial" name="initialEvaluationDate" type="date" defaultValue={formDefaults.initialEvaluationDate}/>
    <Field label="Fecha conclusión inicial" name="initialConclusionDate" type="date" defaultValue={formDefaults.initialConclusionDate}/>
   </div>
  </section>

  <section className="form-section">
   <h2>Parte I · 4. Líneas de actuación y acciones derivadas</h2>
   <div className="form-grid">
    <TextArea label="Líneas de actuación y resolución" name="resolutionLines" defaultValue={formDefaults.resolutionLines}/>
    <Checks label="Implicación de la resolución" name="resolutionActions" options={resolutionOptions} defaults={formDefaults.resolutionActions}/>
    <TextArea label="Acción inmediata · detalle" name="immediateActionDetails" defaultValue={formDefaults.immediateActionDetails}/>
    <TextArea label="Otros · detalle" name="otherResolutionDetails" defaultValue={formDefaults.otherResolutionDetails}/>
   </div>
   <h3>Acciones y registros vinculados</h3>
   <div className="dynamic-list">
    {derived.map((x,i)=><div className="dynamic-row capa" key={x.id??i}>
      <label className="field"><span>Tipo / código</span><input value={x.actionType} onChange={e=>patchDerived(i,{actionType:e.target.value})} placeholder="CAPA, DEV, CC…"/></label>
      <label className="field"><span>Código</span><input value={x.businessCode} onChange={e=>patchDerived(i,{businessCode:e.target.value})}/></label>
      <label className="field"><span>Acción / evidencia</span><input value={x.description} onChange={e=>patchDerived(i,{description:e.target.value})}/></label>
      <label className="field"><span>Responsable</span><input value={x.responsible} onChange={e=>patchDerived(i,{responsible:e.target.value})}/></label>
      <label className="field"><span>Fecha prevista</span><input type="date" value={x.plannedExecutionDate} onChange={e=>patchDerived(i,{plannedExecutionDate:e.target.value})}/></label>
      <button className="button danger small" type="button" onClick={()=>setDerived(a=>a.filter((_,n)=>n!==i))}>Quitar</button>
    </div>)}
    <div><button className="button small" type="button" onClick={()=>setDerived(x=>[...x,{...emptyDerived}])}>+ Añadir acción / registro</button></div>
   </div>

   <h3>CAPA propuestas / vinculadas</h3>
   <div className="dynamic-list">
    {capas.map((x,i)=><div className="dynamic-row capa" key={x.id??i}>
      <label className="field"><span>Tipo</span><select value={x.actionType} onChange={e=>patchCapa(i,{actionType:e.target.value as ComplaintCapaPlanInput["actionType"]})}><option value="CORRECTIVE">Correctiva</option><option value="PREVENTIVE">Preventiva</option></select></label>
      <label className="field"><span>Descripción</span><input value={x.description} onChange={e=>patchCapa(i,{description:e.target.value})}/></label>
      <label className="field"><span>Fecha prevista</span><input type="date" value={x.plannedExecutionDate} onChange={e=>patchCapa(i,{plannedExecutionDate:e.target.value})}/></label>
      <label className="field"><span>Responsable</span><input value={x.responsible} onChange={e=>patchCapa(i,{responsible:e.target.value})}/></label>
      <label className="field"><span>Código CAPA</span><input value={x.businessCapaCode??""} onChange={e=>patchCapa(i,{businessCapaCode:e.target.value})}/></label>
      <button className="button danger small" type="button" onClick={()=>setCapas(a=>a.filter((_,n)=>n!==i))}>Quitar</button>
    </div>)}
    <div><button className="button small" type="button" onClick={()=>setCapas(x=>[...x,{...emptyCapa}])}>+ Añadir CAPA</button></div>
   </div>
  </section>

  <section className="form-section">
   <h2>Parte I · 5. Comunicación y conclusión</h2>
   <div className="form-grid">
    <Field label="Fecha comunicación" name="communicationDate" type="date" defaultValue={formDefaults.communicationDate}/>
    <Field label="Medio" name="communicationMedium" defaultValue={formDefaults.communicationMedium}/>
    <Field label="Emisor / destinatario" name="communicationParties" defaultValue={formDefaults.communicationParties} span="span-2"/>
    <TextArea label="Resumen de lo comunicado o solicitado" name="communicationSummary" defaultValue={formDefaults.communicationSummary}/>
    <TextArea label="Comunicación externa · observaciones internas" name="externalCommunication" defaultValue={formDefaults.externalCommunication}/>
    <Bool label="¿Continúa en Parte II?" name="partIIRequired" defaultValue={formDefaults.partIIRequired}/>
    <TextArea label="Conclusión, pendientes y justificación" name="conclusion" defaultValue={formDefaults.conclusion}/>
    <Bool label="¿Verificación de eficacia necesaria?" name="effectivenessRequired" defaultValue={formDefaults.effectivenessRequired}/>
    <Field label="Aprobaciones Parte I" name="approvalNames" defaultValue={formDefaults.approvalNames} span="span-2"/>
   </div>
  </section>

  <section className="form-section">
   <h2>Parte II · Seguimiento y cierre</h2>
   <div className="form-grid">
    <Field label="Fecha respuesta" name="responseDate" type="date" defaultValue={formDefaults.responseDate}/>
    <Field label="Medio de respuesta" name="responseMedium" defaultValue={formDefaults.responseMedium}/>
    <TextArea label="Resumen de respuesta / compromisos" name="responseSummary" defaultValue={formDefaults.responseSummary}/>
    <Bool label="¿Respuesta suficiente?" name="responseSufficient" defaultValue={formDefaults.responseSufficient}/>
    <label className="field"><span>Verificación de eficacia</span><select name="effectivenessStatus" defaultValue={formDefaults.effectivenessStatus??"PENDING"}><option value="PENDING">Pendiente</option><option value="ACCEPTABLE">Conforme</option><option value="NOT_ACCEPTABLE">No conforme</option><option value="NOT_REQUIRED">N/A</option></select></label>
    <TextArea label="Valoración de eficacia" name="effectivenessAssessment" defaultValue={formDefaults.effectivenessAssessment}/>
    <label className="field"><span>Estado de las acciones</span><select name="closeActionStatus" defaultValue={formDefaults.closeActionStatus??""}><option value="">No informado</option><option value="COMPLETED">Completadas</option><option value="LINKED">Vinculadas a seguimiento independiente</option><option value="PENDING">Pendientes</option></select></label>
    <Field label="Referencias / responsable de seguimiento" name="closeActionReferences" defaultValue={formDefaults.closeActionReferences} span="span-2"/>
    <TextArea label="Conclusión de cierre" name="closeConclusion" defaultValue={formDefaults.closeConclusion}/>
    <Field label="Aprobaciones seguimiento / cierre" name="closeApprovalNames" defaultValue={formDefaults.closeApprovalNames} span="span-2"/>
    <Field label="Fecha cierre" name="closedAt" type="date" defaultValue={formDefaults.closedAt}/>
    {isDraft?<label className="field"><span>Estado final</span><input type="hidden" name="status" value="DRAFT"/><div className="readonly-field">Borrador</div></label>:<label className="field"><span>Estado final</span><select name="status" defaultValue={formDefaults.status??"OPEN"}><option value="OPEN">Abierta / en seguimiento</option><option value="CLOSED">Cerrada</option></select></label>}
   </div>
  </section>

  <section className="form-section">
   <h2>Control interno</h2>
   <div className="form-grid">
    <TextArea label="Observaciones internas" name="internalObservations" defaultValue={formDefaults.internalObservations}/>
    <label className="field"><span>Documento firmado disponible</span><select name="signedDocumentAvailable" defaultValue={formDefaults.signedDocumentAvailable??""}><option value="">No informado</option><option value="true">Sí</option><option value="false">No</option></select></label>
    <label className="field"><span>Control del dato</span><select name="dataQualityStatus" defaultValue={formDefaults.dataQualityStatus??"REVIEW_REQUIRED"}><option value="COMPLETE">Completo</option><option value="INCOMPLETE">Incompleto</option><option value="REVIEW_REQUIRED">Pendiente revisar</option></select></label>
    {mode==="edit"?<TextArea label="Motivo del cambio" name="changeReason"/>:null}
   </div>
  </section>

  {isDraft?<div className="form-errors draft-notice"><strong>Borrador</strong><span>Puedes guardar el expediente incompleto. Los obligatorios se exigirán al abrir la reclamación.</span></div>:null}
  <div className="form-footer"><Link className="button" href={complaintId?`/complaints/${complaintId}`:"/complaints"}>Cancelar</Link>{isDraft?<div className="version-submit-group"><button className="button" type="submit" name="saveIntent" value="draft" formNoValidate disabled={pending}>{pending?"Guardando…":"Guardar borrador"}</button><button className="button primary" type="submit" name="saveIntent" value="open" disabled={pending}>{pending?"Guardando…":"Abrir reclamación"}</button></div>:<button className="button primary" disabled={pending}>{pending?"Guardando…":"Guardar cambios"}</button>}</div>
 </form>;
}
