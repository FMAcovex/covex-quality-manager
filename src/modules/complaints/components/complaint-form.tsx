"use client";

import Link from "next/link";
import { useActionState,useState } from "react";
import type {
  ComplaintCapaPlanInput,
  ComplaintDerivedActionInput,
  ComplaintFormDefaults,
  ComplaintFormState,
  DepartmentOption,
} from "@/modules/complaints/types";

const initial:ComplaintFormState={error:null};
const emptyCapa:ComplaintCapaPlanInput={actionType:"CORRECTIVE",description:"",plannedExecutionDate:"",responsible:"",businessCapaCode:""};
const emptyDerived:ComplaintDerivedActionInput={typeCode:"",actionEvidence:"",responsible:"",plannedDate:""};

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
function Multi({label,name,options,defaults=[]}:{label:string;name:string;options:readonly string[];defaults?:string[]}) {
 return <div className="field full"><span>{label}</span><div className="checkbox-group">{options.map(v=><label key={v}><input type="checkbox" name={name} value={v} defaultChecked={defaults.includes(v)}/>{v}</label>)}</div></div>;
}

const resolutionOptions=[
 ["RETURN","Devolución"],["CORRECTIVE_ACTION","Acc. correctora"],["PREVENTIVE_ACTION","Acc. preventiva"],["IMMEDIATE_ACTION","Acc. inmediata"],
 ["RECALL","Retirada"],["CREDIT","Abono"],["REPLACEMENT","Reposición"],["REJECT","Rechazo"],["REPROCESS","Reproceso"],["DISPOSE","Eliminación"],
 ["KEEP_AS_IS","Mantener situación"],["SUPPLIER_INVESTIGATION","Investigación proveedor"],["SUPPLIER_EVALUATION","Evaluación proveedor"],
 ["OPEN_DEVIATION","Abrir desviación"],["OPEN_CAPA","Abrir CAPA"],["OPEN_CHANGE","Abrir cambio"],["OTHER","Otros"]
] as const;
const sourceOptions=["Cliente","Distribuidor","Titular / MAH","Consumidor / usuario","Autoridad / entidad sanitaria","Proveedor","Transportista / operador logístico","Subcontrata","Detección interna","Retirada"];
const scopeOptions=["Medicamento","API","Complemento alimenticio","Cosmética","Producto sanitario","Medio ambiente"];
const objectOptions=["Producto / material","Servicio","Equipo / sistema","Transporte","Actividad subcontratada"];
const categoryOptions=["Calidad del producto","Especificaciones / análisis","Acondicionamiento / envase","Etiquetado / documentación","Cantidad / contenido","Transporte / almacenamiento","Servicio / suministro","Equipo / sistema","Medio ambiente"];
const containmentOptions=["Bloqueo / cuarentena","Suspender uso / distribución","Aviso a cliente / proveedor / titular / Autoridad","Ninguna"];

export function ComplaintForm({mode,action,departments,defaults={},complaintId}:{mode:"create"|"edit";action:(s:ComplaintFormState,fd:FormData)=>Promise<ComplaintFormState>;departments:DepartmentOption[];defaults?:ComplaintFormDefaults;complaintId?:string}) {
 const [state,formAction,pending]=useActionState(action,initial);
 const [capas,setCapas]=useState<ComplaintCapaPlanInput[]>(defaults.capaPlans??[]);
 const [derived,setDerived]=useState<ComplaintDerivedActionInput[]>(defaults.derivedActions??[]);
 const patch=(i:number,p:Partial<ComplaintCapaPlanInput>)=>setCapas(x=>x.map((v,n)=>n===i?{...v,...p}:v));
 const patchDerived=(i:number,p:Partial<ComplaintDerivedActionInput>)=>setDerived(x=>x.map((v,n)=>n===i?{...v,...p}:v));

 return <form action={formAction} className="form-stack">
  <input type="hidden" name="capaPlansJson" value={JSON.stringify(capas)}/>
  <input type="hidden" name="derivedActionsJson" value={JSON.stringify(derived)}/>
  {state.error?<div className="form-errors"><strong>{state.error}</strong>{state.fieldErrors?.length?<ul>{state.fieldErrors.map(x=><li key={x}>{x}</li>)}</ul>:null}</div>:null}

  <section className="form-section">
   <h2>1. Registro e identificación · GC-00/027/03</h2>
   <p className="section-help">Campos alineados con la Parte I del nuevo Anexo III.</p>
   <div className="form-grid">
    <Field label="N.º reclamación" name="businessCode" defaultValue={defaults.businessCode} required/>
    <label className="field"><span>Departamento *</span><select name="departmentId" defaultValue={defaults.departmentId??""} required><option value="">Seleccionar…</option>{departments.map(d=><option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}</select></label>
    <Field label="Fecha apertura" name="openedAt" type="date" defaultValue={defaults.openedAt} required/>
    <Field label="Fecha detección" name="detectionDate" type="date" defaultValue={defaults.detectionDate}/>
    <Field label="Fecha recepción" name="receivedAt" type="date" defaultValue={defaults.receivedAt}/>
    <Field label="Detectado por" name="detectedBy" defaultValue={defaults.detectedBy}/>
    <Field label="Cumplimentado por" name="createdByText" defaultValue={defaults.createdByText} required/>
    {mode==="edit"?<Field label="Modificado por" name="modifiedByText" defaultValue={defaults.createdByText}/>:null}
    <label className="field"><span>Tipo *</span><select name="complaintType" defaultValue={defaults.complaintType??""} required><option value="">Seleccionar…</option><option value="PROVIDER">A proveedor / subcontrata</option><option value="CUSTOMER">De cliente / agente externo</option></select></label>
    <Field label="Cliente / Proveedor" name="partyName" defaultValue={defaults.partyName} required span="span-2"/>
    <Field label="Contacto" name="contact" defaultValue={defaults.contact} span="span-2"/>
    <Multi label="Origen / fuente de detección" name="sourceFlags" options={sourceOptions} defaults={defaults.sourceFlags}/>
    <Field label="Otro origen / especificar" name="sourceOther" defaultValue={defaults.sourceOther} span="span-2"/>
    <Multi label="Ámbito" name="scopeFlags" options={scopeOptions} defaults={defaults.scopeFlags}/>
    <Field label="Otro ámbito / especificar" name="scopeOther" defaultValue={defaults.scopeOther} span="span-2"/>
    <Multi label="Objeto afectado" name="objectFlags" options={objectOptions} defaults={defaults.objectFlags}/>
    <Field label="Otro objeto / especificar" name="objectOther" defaultValue={defaults.objectOther} span="span-2"/>
    <Field label="Referencia material / servicio / equipo" name="reference" defaultValue={defaults.reference} span="span-2"/>
    <Field label="Lote / referencia" name="lotReference" defaultValue={defaults.lotReference}/>
    <Field label="Cantidad" name="quantity" defaultValue={defaults.quantity}/>
    <Field label="Caducidad / reanálisis" name="expiryReanalysis" defaultValue={defaults.expiryReanalysis}/>
    <Field label="Pedido / albarán / certificado" name="purchaseDeliveryReference" defaultValue={defaults.purchaseDeliveryReference} span="span-2"/>
    <Multi label="Categoría / motivo" name="categoryFlags" options={categoryOptions} defaults={defaults.categoryFlags}/>
    <Field label="Otra categoría / especificar" name="categoryOther" defaultValue={defaults.categoryOther} span="span-2"/>
    <TextArea label="Descripción de la reclamación *" name="description" defaultValue={defaults.description}/>
    <Bool label="¿Reclamación recurrente?" name="recurrent" defaultValue={defaults.recurrent}/>
    <Field label="Referencia recurrencia" name="recurrenceReference" defaultValue={defaults.recurrenceReference} span="span-2"/>
    <TextArea label="Evidencias / documentación adjunta" name="attachedDocumentation" defaultValue={defaults.attachedDocumentation}/>
    <Field label="Emitido por" name="emittedBy" defaultValue={defaults.emittedBy}/>
    <Field label="Validado por Gª Calidad" name="qaValidatedBy" defaultValue={defaults.qaValidatedBy} span="span-2"/>
   </div>
  </section>

  <section className="form-section">
   <h2>2. Evaluación inicial, investigación e impacto</h2>
   <div className="form-grid">
    <Tri label="Calidad / cumplimiento GMP" name="impactQualityGmp" defaultValue={defaults.impactQualityGmp}/>
    <Tri label="Seguridad / eficacia / paciente o usuario" name="impactSafetyEfficacy" defaultValue={defaults.impactSafetyEfficacy}/>
    <Tri label="Cumplimiento regulatorio" name="impactRegulatory" defaultValue={defaults.impactRegulatory}/>
    <Tri label="Medio ambiente" name="impactEnvironment" defaultValue={defaults.impactEnvironment}/>
    <Tri label="Otros lotes/productos/clientes/situaciones" name="impactOtherLots" defaultValue={defaults.impactOtherLots}/>
    <Multi label="Medidas inmediatas / contención" name="containmentFlags" options={containmentOptions} defaults={defaults.containmentFlags}/>
    <Field label="Otra medida de contención" name="containmentOther" defaultValue={defaults.containmentOther} span="span-2"/>
    <TextArea label="Justificación del riesgo, alcance y medidas" name="riskJustification" defaultValue={defaults.riskJustification}/>
    <TextArea label="Investigación, evidencias y alcance" name="investigation" defaultValue={defaults.investigation}/>
    <TextArea label="Conclusión del impacto" name="impactAssessment" defaultValue={defaults.impactAssessment}/>
    <label className="field"><span>Resultado</span><select name="investigationResult" defaultValue={defaults.investigationResult??""}><option value="">Pendiente</option><option value="PROCEDENT">Procedente</option><option value="NOT_PROCEDENT">No procedente</option><option value="INCONCLUSIVE">No concluyente</option><option value="NOT_ATTRIBUTABLE_TO_COVEX">No atribuible a COVEX</option></select></label>
    <TextArea label="Causa y evidencias que la sustentan" name="rootCause" defaultValue={defaults.rootCause}/>
   </div>
  </section>

  <section className="form-section">
   <h2>3. Clasificación y evaluación regulatoria</h2>
   <div className="form-grid">
    <label className="field"><span>Clasificación</span><select name="classification" defaultValue={defaults.classification??""}><option value="">Pendiente</option><option value="CRITICAL">Crítica</option><option value="MAJOR">Mayor</option><option value="MINOR">Menor</option><option value="NO_GMP_IMPACT">Sin impacto GMP</option></select></label>
    <Field label="Fecha evaluación inicial" name="initialEvaluationDate" type="date" defaultValue={defaults.initialEvaluationDate}/>
    <Tri label="¿Puede requerir retirada?" name="regulatoryMayRequireRecall" defaultValue={defaults.regulatoryMayRequireRecall}/>
    <Tri label="¿Requiere activar GC-00/029?" name="regulatoryActivateRecall" defaultValue={defaults.regulatoryActivateRecall}/>
    <Tri label="¿Requiere notificación a autoridad sanitaria?" name="regulatoryAuthorityNotification" defaultValue={defaults.regulatoryAuthorityNotification}/>
    <Tri label="¿Requiere comunicación a titular / cliente responsable?" name="regulatoryResponsibleCommunication" defaultValue={defaults.regulatoryResponsibleCommunication}/>
    <TextArea label="Justificación de la evaluación regulatoria" name="regulatoryJustification" defaultValue={defaults.regulatoryJustification}/>
    <TextArea label="Líneas de actuación y resolución" name="resolutionLines" defaultValue={defaults.resolutionLines}/>
    <div className="field full"><span>Acciones derivadas</span><div className="checkbox-group">{resolutionOptions.map(([v,l])=><label key={v}><input type="checkbox" name="resolutionActions" value={v} defaultChecked={defaults.resolutionActions?.includes(v)}/>{l}</label>)}</div></div>
    <TextArea label="Acción inmediata · detalle" name="immediateActionDetails" defaultValue={defaults.immediateActionDetails}/>
    <TextArea label="Otros · detalle" name="otherResolutionDetails" defaultValue={defaults.otherResolutionDetails}/>
   </div>

   <h3>Acciones y registros vinculados</h3>
   <div className="table-scroll"><table className="records-table compact-table"><thead><tr><th>Tipo / código</th><th>Acción / evidencia</th><th>Responsable</th><th>Fecha prevista</th><th></th></tr></thead><tbody>
    {derived.map((x,i)=><tr key={i}><td><input value={x.typeCode} onChange={e=>patchDerived(i,{typeCode:e.target.value})}/></td><td><textarea value={x.actionEvidence} onChange={e=>patchDerived(i,{actionEvidence:e.target.value})}/></td><td><input value={x.responsible} onChange={e=>patchDerived(i,{responsible:e.target.value})}/></td><td><input type="date" value={x.plannedDate} onChange={e=>patchDerived(i,{plannedDate:e.target.value})}/></td><td><button className="button danger small" type="button" onClick={()=>setDerived(a=>a.filter((_,n)=>n!==i))}>Quitar</button></td></tr>)}
   </tbody></table></div>
   <button className="button small" type="button" onClick={()=>setDerived(x=>[...x,{...emptyDerived}])}>+ Añadir acción / registro</button>

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
    <Field label="Fecha comunicación" name="communicationDate" type="date" defaultValue={defaults.communicationDate}/>
    <Field label="Medio" name="communicationMedium" defaultValue={defaults.communicationMedium}/>
    <Field label="Emisor / destinatario" name="communicationFromTo" defaultValue={defaults.communicationFromTo} span="span-2"/>
    <TextArea label="Resumen de lo comunicado o solicitado" name="externalCommunication" defaultValue={defaults.externalCommunication}/>
    <label className="field"><span>Decisión Parte I</span><select name="partIOutcome" defaultValue={defaults.partIOutcome??""}><option value="">Pendiente</option><option value="CONTINUE_PART_II">Continúa en Parte II</option><option value="CLOSE_PART_I">Cierre en Parte I sin seguimiento adicional</option></select></label>
    <TextArea label="Conclusión, pendientes y justificación" name="conclusion" defaultValue={defaults.conclusion}/>
    <Bool label="¿Verificación de eficacia necesaria?" name="effectivenessRequired" defaultValue={defaults.effectivenessRequired}/>
    <Field label="Fecha conclusión inicial" name="initialConclusionDate" type="date" defaultValue={defaults.initialConclusionDate}/>
    <Field label="Aprobaciones Parte I" name="approvalNames" defaultValue={defaults.approvalNames} span="span-2"/>
   </div>
  </section>

  <section className="form-section">
   <h2>5. Parte II · Seguimiento y cierre</h2>
   <div className="form-grid">
    <Field label="Fecha respuesta" name="responseDate" type="date" defaultValue={defaults.responseDate}/>
    <Field label="Medio de respuesta" name="responseMedium" defaultValue={defaults.responseMedium} span="span-2"/>
    <TextArea label="Respuesta proveedor / cliente y compromisos" name="responseSummary" defaultValue={defaults.responseSummary}/>
    <Bool label="¿Respuesta suficiente?" name="responseSufficient" defaultValue={defaults.responseSufficient}/>
    <label className="field"><span>Verificación de eficacia</span><select name="effectivenessStatus" defaultValue={defaults.effectivenessStatus??"PENDING"}><option value="PENDING">Pendiente</option><option value="ACCEPTABLE">Conforme</option><option value="NOT_ACCEPTABLE">No conforme</option><option value="NOT_REQUIRED">N/A</option></select></label>
    <TextArea label="Valoración de eficacia" name="effectivenessAssessment" defaultValue={defaults.effectivenessAssessment}/>
    <label className="field"><span>Estado de las acciones</span><select name="finalActionsStatus" defaultValue={defaults.finalActionsStatus??""}><option value="">No informado</option><option value="COMPLETED">Completadas</option><option value="INDEPENDENT_FOLLOWUP">Vinculadas a seguimiento independiente</option><option value="PENDING">Pendientes</option></select></label>
    <Field label="Referencias / responsable del seguimiento" name="finalActionsReferences" defaultValue={defaults.finalActionsReferences} span="span-2"/>
    <TextArea label="Conclusión y situación final" name="closeConclusion" defaultValue={defaults.closeConclusion}/>
    <Field label="Próximo seguimiento" name="nextFollowupDate" type="date" defaultValue={defaults.nextFollowupDate}/>
    <Field label="Aprobaciones cierre" name="closeApprovalNames" defaultValue={defaults.closeApprovalNames} span="span-2"/>
    <Field label="Fecha cierre" name="closedAt" type="date" defaultValue={defaults.closedAt}/>
    <label className="field"><span>Estado</span><select name="status" defaultValue={defaults.status??"OPEN"}><option value="OPEN">Abierta / en seguimiento</option><option value="CLOSED">Cerrada</option></select></label>
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
