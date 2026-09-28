"use client";

import Link from "next/link";
import { useActionState,useState } from "react";
import type { ComplaintCapaPlanInput,ComplaintFormDefaults,ComplaintFormState,DepartmentOption } from "@/modules/complaints/types";

const initial:ComplaintFormState={error:null};
const emptyCapa:ComplaintCapaPlanInput={actionType:"CORRECTIVE",description:"",plannedExecutionDate:"",responsible:"",businessCapaCode:""};

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

const triggerOptions=[["CLIENT","Cliente"],["DISTRIBUTOR","Distribuidor"],["MAH","Titular / MAH"],["CONSUMER","Consumidor / usuario"],["AUTHORITY","Autoridad / entidad sanitaria"],["SUPPLIER","Proveedor"],["LOGISTICS","Transportista / operador logístico"],["SUBCONTRACTOR","Subcontrata"],["INTERNAL","Detección interna"],["RECALL","Retirada"]] as const;
const scopeOptions=[["MEDICINE","Medicamento"],["API","API"],["SUPPLEMENT","Complemento alimenticio"],["COSMETIC","Cosmética"],["MEDICAL_DEVICE","Producto sanitario"],["ENVIRONMENT","Medio ambiente"]] as const;
const objectOptions=[["PRODUCT","Producto / material"],["SERVICE","Servicio"],["EQUIPMENT","Equipo / sistema"],["TRANSPORT","Transporte"],["SUBCONTRACTED","Actividad subcontratada"]] as const;
const categoryOptions=[["PRODUCT_QUALITY","Calidad del producto"],["SPECIFICATIONS","Especificaciones / análisis"],["PACKAGING","Acondicionamiento / envase"],["LABELING","Etiquetado / documentación"],["QUANTITY","Cantidad / contenido"],["TRANSPORT_STORAGE","Transporte / almacenamiento"],["SERVICE_SUPPLY","Servicio / suministro"],["EQUIPMENT_SYSTEM","Equipo / sistema"],["ENVIRONMENT","Medio ambiente"]] as const;
const containmentOptions=[["BLOCK_QUARANTINE","Bloqueo / cuarentena"],["SUSPEND","Suspender uso / distribución"],["NOTICE","Aviso a cliente / proveedor / titular / autoridad"],["NONE","Ninguna"]] as const;

const resolutionOptions=[
 ["RETURN","Devolución"],["CORRECTIVE_ACTION","Acc. correctora"],["PREVENTIVE_ACTION","Acc. preventiva"],["IMMEDIATE_ACTION","Acc. inmediata"],
 ["RECALL","Retirada"],["CREDIT","Abono"],["REPLACEMENT","Reposición"],["REJECT","Rechazo"],["REPROCESS","Reproceso"],["DISPOSE","Eliminación"],
 ["KEEP_AS_IS","Mantener situación"],["SUPPLIER_INVESTIGATION","Investigación proveedor"],["SUPPLIER_EVALUATION","Evaluación proveedor"],
 ["OPEN_DEVIATION","Abrir desviación"],["OPEN_CAPA","Abrir CAPA"],["OPEN_CHANGE","Abrir cambio"],["OTHER","Otros"]
] as const;

export function ComplaintForm({mode,action,departments,defaults={},complaintId}:{mode:"create"|"edit";action:(s:ComplaintFormState,fd:FormData)=>Promise<ComplaintFormState>;departments:DepartmentOption[];defaults?:ComplaintFormDefaults;complaintId?:string}) {
 const [state,formAction,pending]=useActionState(action,initial);
 const [capas,setCapas]=useState<ComplaintCapaPlanInput[]>(defaults.capaPlans??[]);
 const patch=(i:number,p:Partial<ComplaintCapaPlanInput>)=>setCapas(x=>x.map((v,n)=>n===i?{...v,...p}:v));
 return <form action={formAction} className="form-stack">
  <input type="hidden" name="capaPlansJson" value={JSON.stringify(capas)}/>
  {state.error?<div className="form-errors"><strong>{state.error}</strong>{state.fieldErrors?.length?<ul>{state.fieldErrors.map(x=><li key={x}>{x}</li>)}</ul>:null}</div>:null}

  <section className="form-section">
   <h2>1. Registro e identificación</h2>
   <p className="section-help">Parte I del Anexo III: datos de apertura, origen y elemento afectado.</p>
   <div className="form-grid">
    <Field label="N.º reclamación" name="businessCode" defaultValue={defaults.businessCode} required/>
    <label className="field"><span>Departamento *</span><select name="departmentId" defaultValue={defaults.departmentId??""} required><option value="">Seleccionar…</option>{departments.map(d=><option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}</select></label>
    <Field label="Fecha apertura" name="openedAt" type="date" defaultValue={defaults.openedAt} required/>
    <Field label="Fecha detección" name="detectionDate" type="date" defaultValue={defaults.detectionDate}/>
    <Field label="Fecha recepción" name="receptionDate" type="date" defaultValue={defaults.receptionDate}/>
    <Field label="Detectado por" name="detectedBy" defaultValue={defaults.detectedBy}/>
    <Field label="Cumplimentado por" name="createdByText" defaultValue={defaults.createdByText} required/>
    {mode==="edit"?<Field label="Modificado por" name="modifiedByText" defaultValue={defaults.createdByText}/>:null}
    <label className="field"><span>Tipo *</span><select name="complaintType" defaultValue={defaults.complaintType??""} required><option value="">Seleccionar…</option><option value="PROVIDER">A proveedor</option><option value="CUSTOMER">De cliente</option></select></label>
    <Checks label="Origen / fuente de detección" name="triggerSources" options={triggerOptions} defaults={defaults.triggerSources}/>
    <Field label="Otro origen / fuente" name="triggerOther" defaultValue={defaults.triggerOther} span="span-2"/>
    <Field label="Cliente / Proveedor" name="partyName" defaultValue={defaults.partyName} required span="span-2"/>
    <Field label="Contacto" name="contact" defaultValue={defaults.contact} span="span-2"/>
    <Checks label="Ámbito" name="scopeCategories" options={scopeOptions} defaults={defaults.scopeCategories}/>
    <Field label="Otro ámbito" name="scopeOther" defaultValue={defaults.scopeOther} span="span-2"/>
    <Checks label="Objeto afectado" name="affectedObjectTypes" options={objectOptions} defaults={defaults.affectedObjectTypes}/>
    <Field label="Otro objeto afectado" name="affectedObjectOther" defaultValue={defaults.affectedObjectOther} span="span-2"/>
    <Field label="Ámbito / detalle adicional" name="affectedScope" defaultValue={defaults.affectedScope} span="span-2"/>
    <Field label="Material / servicio / equipo" name="reference" defaultValue={defaults.reference} span="span-2"/>
    <Field label="Lote / referencia" name="lotReference" defaultValue={defaults.lotReference}/>
    <Field label="Cantidad" name="quantity" defaultValue={defaults.quantity}/>
    <Field label="Caducidad / reanálisis" name="expiryReanalysis" defaultValue={defaults.expiryReanalysis}/>
    <Field label="Pedido / albarán / certificado" name="purchaseDeliveryReference" defaultValue={defaults.purchaseDeliveryReference} span="span-2"/>
    <Checks label="Categoría / motivo" name="complaintCategories" options={categoryOptions} defaults={defaults.complaintCategories}/>
    <Field label="Otra categoría / motivo" name="complaintCategoryOther" defaultValue={defaults.complaintCategoryOther} span="span-2"/>
    <TextArea label="Descripción de la reclamación *" name="description" defaultValue={defaults.description}/>
    <Bool label="¿Reclamación recurrente?" name="recurrent" defaultValue={defaults.recurrent}/>
    <Field label="Referencia recurrencia" name="recurrenceReference" defaultValue={defaults.recurrenceReference} span="span-2"/>
    <TextArea label="Documentación adjunta" name="attachedDocumentation" defaultValue={defaults.attachedDocumentation}/>
    <Field label="Emitido por" name="emittedBy" defaultValue={defaults.emittedBy}/>
    <Field label="Validado por Gª Calidad" name="qaValidatedBy" defaultValue={defaults.qaValidatedBy} span="span-2"/>
   </div>
  </section>

  <section className="form-section">
   <h2>2. Investigación, impacto y causa raíz</h2>
   <p className="section-help">Misma filosofía que Desviaciones: separar hechos investigados, impacto y causa raíz sustentada.</p>
   <div className="form-grid">
    <Tri label="Impacto calidad / cumplimiento GMP" name="qualityGmpImpact" defaultValue={defaults.qualityGmpImpact}/>
    <Tri label="Impacto seguridad / eficacia / paciente" name="safetyEfficacyImpact" defaultValue={defaults.safetyEfficacyImpact}/>
    <Tri label="Impacto regulatorio" name="regulatoryComplianceImpact" defaultValue={defaults.regulatoryComplianceImpact}/>
    <Tri label="Impacto medio ambiente" name="environmentImpact" defaultValue={defaults.environmentImpact}/>
    <Tri label="Otros lotes/productos/clientes similares" name="similarSituationsImpact" defaultValue={defaults.similarSituationsImpact}/>
    <Checks label="Medidas inmediatas / contención" name="containmentActions" options={containmentOptions} defaults={defaults.containmentActions}/>
    <Field label="Otra medida de contención" name="containmentOther" defaultValue={defaults.containmentOther} span="span-2"/>
    <TextArea label="Justificación del riesgo, alcance y medidas" name="riskJustification" defaultValue={defaults.riskJustification}/>
    <TextArea label="Investigación" name="investigation" defaultValue={defaults.investigation}/>
    <TextArea label="Impacto / conclusión de la investigación" name="impactAssessment" defaultValue={defaults.impactAssessment}/>
    <label className="field"><span>Conclusión investigación</span><select name="investigationResult" defaultValue={defaults.investigationResult??""}><option value="">Pendiente</option><option value="PROCEDENT">Procedente</option><option value="NOT_PROCEDENT">No procedente</option><option value="INCONCLUSIVE">No concluyente</option><option value="NOT_ATTRIBUTABLE_TO_COVEX">No atribuible a COVEX</option></select></label>
    <TextArea label="Análisis de causa raíz" name="rootCause" defaultValue={defaults.rootCause}/>
   </div>
  </section>

  <section className="form-section">
   <h2>3. Clasificación y resolución</h2>
   <div className="form-grid">
    <label className="field"><span>Clasificación</span><select name="classification" defaultValue={defaults.classification??""}><option value="">Pendiente</option><option value="CRITICAL">Crítica</option><option value="MAJOR">Mayor</option><option value="MINOR">Menor</option><option value="NO_GMP_IMPACT">Sin impacto GMP</option></select></label>
    <Tri label="¿Puede requerir retirada?" name="withdrawalPotential" defaultValue={defaults.withdrawalPotential}/>
    <Tri label="¿Activar procedimiento de retirada?" name="recallProcedureRequired" defaultValue={defaults.recallProcedureRequired}/>
    <Tri label="¿Notificación a autoridad sanitaria?" name="authorityNotification" defaultValue={defaults.authorityNotification}/>
    <Tri label="¿Comunicación a titular / responsable?" name="responsiblePartyCommunication" defaultValue={defaults.responsiblePartyCommunication}/>
    <TextArea label="Justificación de evaluación regulatoria" name="regulatoryJustification" defaultValue={defaults.regulatoryJustification}/>
    <Field label="Fecha evaluación inicial" name="initialEvaluationDate" type="date" defaultValue={defaults.initialEvaluationDate}/>
    <Field label="Fecha conclusión inicial" name="initialConclusionDate" type="date" defaultValue={defaults.initialConclusionDate}/>
    <TextArea label="Líneas de actuación y resolución" name="resolutionLines" defaultValue={defaults.resolutionLines}/>
    <div className="field full"><span>Implicación de la resolución</span><div className="checkbox-group">{resolutionOptions.map(([v,l])=><label key={v}><input type="checkbox" name="resolutionActions" value={v} defaultChecked={defaults.resolutionActions?.includes(v)}/>{l}</label>)}</div></div>
    <TextArea label="Acción inmediata · detalle" name="immediateActionDetails" defaultValue={defaults.immediateActionDetails}/>
    <TextArea label="Otros · detalle" name="otherResolutionDetails" defaultValue={defaults.otherResolutionDetails}/>
   </div>

   <h3>CAPA asociadas / propuestas</h3>
   <div className="dynamic-list">
    {capas.map((x,i)=><div className="dynamic-row capa" key={x.id??i}>
      <label className="field"><span>Tipo</span><select value={x.actionType} onChange={e=>patch(i,{actionType:e.target.value as ComplaintCapaPlanInput["actionType"]})}><option value="CORRECTIVE">Correctiva</option><option value="PREVENTIVE">Preventiva</option></select></label>
      <label className="field"><span>Descripción</span><input value={x.description} onChange={e=>patch(i,{description:e.target.value})}/></label>
      <label className="field"><span>Fecha prevista</span><input type="date" value={x.plannedExecutionDate} onChange={e=>patch(i,{plannedExecutionDate:e.target.value})}/></label>
      <label className="field"><span>Responsable</span><input value={x.responsible} onChange={e=>patch(i,{responsible:e.target.value})}/></label>
      <label className="field"><span>Código CAPA</span><input value={x.businessCapaCode??""} onChange={e=>patch(i,{businessCapaCode:e.target.value})}/></label>
      <button className="button danger small" type="button" onClick={()=>setCapas(a=>a.filter((_,n)=>n!==i))}>Quitar</button>
    </div>)}
    <div><button className="button small" type="button" onClick={()=>setCapas(x=>[...x,{...emptyCapa}])}>+ Añadir CAPA</button></div>
   </div>
  </section>

  <section className="form-section">
   <h2>4. Comunicación y conclusión de Parte I</h2>
   <div className="form-grid">
    <Field label="Fecha comunicación" name="externalCommunicationDate" type="date" defaultValue={defaults.externalCommunicationDate}/>
    <Field label="Medio" name="externalCommunicationMedium" defaultValue={defaults.externalCommunicationMedium}/>
    <Field label="Emisor / destinatario" name="externalCommunicationParties" defaultValue={defaults.externalCommunicationParties} span="span-2"/>
    <TextArea label="Resumen de la comunicación" name="externalCommunication" defaultValue={defaults.externalCommunication}/>
    <Bool label="¿Continúa en Parte II?" name="continueToPartII" defaultValue={defaults.continueToPartII}/>
    <TextArea label="Conclusión de Parte I / pendientes" name="conclusion" defaultValue={defaults.conclusion}/>
    <Bool label="¿Verificación de eficacia necesaria?" name="effectivenessRequired" defaultValue={defaults.effectivenessRequired}/>
    <Field label="Aprobaciones Parte I" name="approvalNames" defaultValue={defaults.approvalNames} span="span-2"/>
   </div>
  </section>

  <section className="form-section">
   <h2>5. Parte II · Cierre de la reclamación</h2>
   <div className="form-grid">
    <Field label="Fecha respuesta" name="responseDate" type="date" defaultValue={defaults.responseDate}/>
    <Field label="Medio de comunicación" name="responseMedium" defaultValue={defaults.responseMedium} span="span-2"/>
    <TextArea label="Respuesta proveedor / cliente" name="responseSummary" defaultValue={defaults.responseSummary}/>
    <Bool label="¿Respuesta suficiente?" name="responseSufficient" defaultValue={defaults.responseSufficient}/>
    <label className="field"><span>Estado de las acciones</span><select name="followupActionStatus" defaultValue={defaults.followupActionStatus??""}><option value="">No informado</option><option value="COMPLETED">Completadas</option><option value="LINKED">Vinculadas a seguimiento independiente</option><option value="PENDING">Pendientes</option></select></label>
    <Field label="Referencias / responsable seguimiento" name="followupReferences" defaultValue={defaults.followupReferences} span="span-2"/>
    <label className="field"><span>Verificación de eficacia</span><select name="effectivenessStatus" defaultValue={defaults.effectivenessStatus??"PENDING"}><option value="PENDING">Pendiente</option><option value="ACCEPTABLE">Aceptable</option><option value="NOT_ACCEPTABLE">No aceptable</option><option value="NOT_REQUIRED">No requerida</option></select></label>
    <TextArea label="Valoración de eficacia" name="effectivenessAssessment" defaultValue={defaults.effectivenessAssessment}/>
    <TextArea label="Conclusión y cierre" name="closeConclusion" defaultValue={defaults.closeConclusion}/>
    <Field label="Aprobaciones cierre" name="closeApprovalNames" defaultValue={defaults.closeApprovalNames} span="span-2"/>
    <Field label="Fecha cierre" name="closedAt" type="date" defaultValue={defaults.closedAt}/>
    <label className="field"><span>Estado</span><select name="status" defaultValue={defaults.status??"OPEN"}><option value="OPEN">Abierta</option><option value="CLOSED">Cerrada</option></select></label>
   </div>
  </section>

  <section className="form-section">
   <h2>6. Control interno</h2>
   <div className="form-grid">
    <TextArea label="Observaciones internas" name="internalObservations" defaultValue={defaults.internalObservations}/>
    <label className="field"><span>Documento firmado disponible</span><select name="signedDocumentAvailable" defaultValue={defaults.signedDocumentAvailable??""}><option value="">No informado</option><option value="true">Sí</option><option value="false">No</option></select></label>
    <label className="field"><span>Control del dato</span><select name="dataQualityStatus" defaultValue={defaults.dataQualityStatus??"REVIEW_REQUIRED"}><option value="COMPLETE">Completo</option><option value="INCOMPLETE">Incompleto</option><option value="REVIEW_REQUIRED">Pendiente revisar</option></select></label>
    {mode==="edit"?<TextArea label="Motivo del cambio" name="changeReason"/>:null}
   </div>
  </section>

  <div className="form-footer"><Link className="button" href={complaintId?`/complaints/${complaintId}`:"/complaints"}>Cancelar</Link><button className="button primary" disabled={pending}>{pending?"Guardando…":mode==="create"?"Guardar reclamación":"Guardar cambios"}</button></div>
 </form>;
}
