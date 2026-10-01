"use client";

import Link from "next/link";
import { submittedDefaults } from "@/lib/forms/preserved-state";
import { ControlledBusinessCodeField } from "@/components/controlled-business-code-field";
import { useActionState, useMemo, useState } from "react";
import type {
  ComplaintCapaPlanInput,
  ComplaintDerivedActionInput,
  ComplaintFormDefaults,
  ComplaintFormState,
  DepartmentOption,
} from "@/modules/complaints/types";

const initial:ComplaintFormState={error:null};
const emptyCapa:ComplaintCapaPlanInput={actionType:"CORRECTIVE",description:"",plannedExecutionDate:"",responsible:"",businessCapaCode:""};
const emptyDerived:ComplaintDerivedActionInput={actionType:"RETURN",businessCode:"",description:"",responsible:"",plannedExecutionDate:""};

function Field({label,name,defaultValue,type="text",required=false,span="",help}:{label:string;name:string;defaultValue?:string;type?:string;required?:boolean;span?:string;help?:string}) {
 return <label className={`field ${span}`}><span>{label}{required?" *":""}</span>{help?<small className="muted-note">{help}</small>:null}<input name={name} type={type} defaultValue={defaultValue??""} required={required}/></label>;
}
function TextArea({label,name,defaultValue,help,required=false}:{label:string;name:string;defaultValue?:string;help?:string;required?:boolean}) {
 return <label className="field full"><span>{label}{required?" *":""}</span>{help?<small className="muted-note">{help}</small>:null}<textarea name={name} defaultValue={defaultValue??""} required={required}/></label>;
}
function Bool({label,name,defaultValue,required=false}:{label:string;name:string;defaultValue?:string;required?:boolean}) {
 return <label className="field"><span>{label}{required?" *":""}</span><select name={name} defaultValue={defaultValue??""} required={required}><option value="">No informado</option><option value="true">Sí</option><option value="false">No</option></select></label>;
}
function YesNo({label,name,defaultValue,required=false}:{label:string;name:string;defaultValue?:string;required?:boolean}) {
 return <label className="field complaint-evaluation-row"><span>{label}{required?" *":""}</span><select name={name} defaultValue={defaultValue==="NA"?"":defaultValue??""} required={required}><option value="">No informado</option><option value="YES">Sí</option><option value="NO">No</option></select></label>;
}
function Tri({label,name,defaultValue,required=false}:{label:string;name:string;defaultValue?:string;required?:boolean}) {
 return <label className="field"><span>{label}{required?" *":""}</span><select name={name} defaultValue={defaultValue??""} required={required}><option value="">No informado</option><option value="YES">Sí</option><option value="NO">No</option><option value="NA">N/A</option></select></label>;
}
function Checks({label,name,options,defaults=[],required=false}:{label:string;name:string;options:readonly (readonly [string,string])[];defaults?:string[];required?:boolean}) {
 return <div className="field full"><span>{label}{required?" *":""}</span><div className="checkbox-group">{options.map(([v,l])=><label key={v}><input type="checkbox" name={name} value={v} defaultChecked={defaults.includes(v)}/>{l}</label>)}</div></div>;
}

const sourceOptions=[["CUSTOMER","Cliente"],["DISTRIBUTOR","Distribuidor"],["MAH","Titular / MAH"],["CONSUMER","Consumidor / usuario"],["AUTHORITY","Autoridad / entidad sanitaria"],["SUPPLIER","Proveedor"],["CARRIER","Transportista / operador logístico"],["SUBCONTRACTOR","Subcontrata"],["INTERNAL","Detección interna"],["RECALL","Retirada"],["OTHER","Otro"]] as const;
const scopeOptions=[["MEDICINE","Medicamento"],["API","API"],["SUPPLEMENT","Complemento alimenticio"],["COSMETIC","Cosmética"],["MEDICAL_DEVICE","Producto sanitario"],["ENVIRONMENT","Medio ambiente"],["OTHER","Otro"]] as const;
const objectOptions=[["PRODUCT_MATERIAL","Producto / material"],["SERVICE","Servicio"],["EQUIPMENT_SYSTEM","Equipo / sistema"],["TRANSPORT","Transporte"],["SUBCONTRACTED_ACTIVITY","Actividad subcontratada"],["OTHER","Otro"]] as const;
const categoryOptions=[["PRODUCT_QUALITY","Calidad del producto"],["SPECIFICATIONS_TESTING","Especificaciones / análisis"],["PACKAGING","Acondicionamiento / envase"],["LABELLING_DOCUMENTATION","Etiquetado / documentación"],["QUANTITY_CONTENT","Cantidad / contenido"],["TRANSPORT_STORAGE","Transporte / almacenamiento"],["SERVICE_SUPPLY","Servicio / suministro"],["EQUIPMENT_SYSTEM","Equipo / sistema"],["ENVIRONMENT","Medio ambiente"],["OTHER","Otro"]] as const;
const containmentOptions=[["QUARANTINE","Bloqueo / cuarentena"],["SUSPEND_USE_DISTRIBUTION","Suspender uso / distribución"],["NOTIFY_PARTIES","Aviso a cliente / proveedor / titular / Autoridad"],["NONE","Ninguna"],["OTHER","Otra"]] as const;
const resolutionOptions=[["RETURN","Devolución"],["CORRECTIVE_ACTION","Acc. correctora"],["PREVENTIVE_ACTION","Acc. preventiva"],["IMMEDIATE_ACTION","Acc. inmediata"],["RECALL","Retirada del mercado"],["CREDIT","Abono"],["REPLACEMENT","Reposición"],["OTHER","Otros"]] as const;

export function ComplaintForm({mode,action,departments,defaults={},complaintId}:{mode:"create"|"edit";action:(s:ComplaintFormState,fd:FormData)=>Promise<ComplaintFormState>;departments:DepartmentOption[];defaults?:ComplaintFormDefaults;complaintId?:string}) {
 const [state,formAction,pending]=useActionState(action,initial);
 const formDefaults=submittedDefaults(defaults,state.submittedValues);
 const [capas,setCapas]=useState<ComplaintCapaPlanInput[]>(defaults.capaPlans??[]);
 const [derived,setDerived]=useState<ComplaintDerivedActionInput[]>(defaults.derivedActions??[]);
 const [selectedActions,setSelectedActions]=useState<string[]>(formDefaults.resolutionActions??[]);
 const [complaintType,setComplaintType]=useState<""|"CUSTOMER"|"PROVIDER">((formDefaults.complaintType as "CUSTOMER"|"PROVIDER"|undefined)??"");
 const [openedAt,setOpenedAt]=useState(formDefaults.openedAt??"");
 const [departmentId,setDepartmentId]=useState(formDefaults.departmentId??"");
 const [recordStatus,setRecordStatus]=useState<"DRAFT"|"OPEN"|"CLOSED">(formDefaults.status??(mode==="create"?"DRAFT":"OPEN"));
 const inferredActions=Boolean((formDefaults.resolutionActions?.length??0)||(defaults.capaPlans?.length??0)||(defaults.derivedActions?.length??0));
 const [hasActions,setHasActions]=useState<""|"true"|"false">(formDefaults.hasDerivedActions??(inferredActions?"true":""));
 const [partIIDecision,setPartIIDecision]=useState<"pending"|"true"|"false">(formDefaults.partIIRequired??"pending");
 const draft=recordStatus==="DRAFT";
 const open=recordStatus==="OPEN";
 const partII=partIIDecision==="true";
 const productMaterial=useMemo(()=>formDefaults.affectedObjectTypes?.includes("PRODUCT_MATERIAL")??false,[formDefaults.affectedObjectTypes]);
 const patchCapa=(i:number,p:Partial<ComplaintCapaPlanInput>)=>setCapas(x=>x.map((v,n)=>n===i?{...v,...p}:v));
 const patchDerived=(i:number,p:Partial<ComplaintDerivedActionInput>)=>setDerived(x=>x.map((v,n)=>n===i?{...v,...p}:v));
 const actionSelected=(value:string)=>selectedActions.includes(value);
 const addCapa=(actionType:"CORRECTIVE"|"PREVENTIVE")=>setCapas(x=>[...x,{...emptyCapa,actionType}]);
 const toggleAction=(value:string,checked:boolean)=>{
  setSelectedActions(current=>checked?[...new Set([...current,value])]:current.filter(x=>x!==value));
  if(!checked)return;
  if(value==="CORRECTIVE_ACTION"&&!capas.some(x=>x.actionType==="CORRECTIVE"))addCapa("CORRECTIVE");
  if(value==="PREVENTIVE_ACTION"&&!capas.some(x=>x.actionType==="PREVENTIVE"))addCapa("PREVENTIVE");
  if(value==="RETURN"&&!derived.some(x=>x.actionType==="RETURN"))setDerived(x=>[...x,{...emptyDerived,actionType:"RETURN"}]);
 };

 return <form key={state.formRevision??0} action={formAction} className="form-stack">
  <input type="hidden" name="capaPlansJson" value={JSON.stringify(capas)}/>
  <input type="hidden" name="derivedActionsJson" value={JSON.stringify(derived)}/>
  {state.error?<div className="form-errors"><strong>{state.error}</strong>{state.fieldErrors?.length?<ul>{state.fieldErrors.map((x,i)=><li key={`${x}-${i}`}>{x}</li>)}</ul>:null}</div>:null}

  <section className="form-section complaint-identification-section">
   <div className="section-title-row"><div><p className="eyebrow">Parte I · Registro, investigación y análisis</p><h2>Identificación de la reclamación</h2></div><span className="badge neutral">GC-00/027/03</span></div>
   <p className="section-help">Selecciona primero si la reclamación es de cliente o a proveedor. Esta decisión determina su codificación R/C o R/P.</p>
   <div className="complaint-type-choice" role="group" aria-label="Tipo de reclamación">
    <label className={complaintType==="CUSTOMER"?"selected":""}><input type="radio" name="complaintType" value="CUSTOMER" checked={complaintType==="CUSTOMER"} onChange={()=>setComplaintType("CUSTOMER")} required/><strong>DE CLIENTE / AGENTE EXTERNO</strong><small>Codificación R/C</small></label>
    <label className={complaintType==="PROVIDER"?"selected":""}><input type="radio" name="complaintType" value="PROVIDER" checked={complaintType==="PROVIDER"} onChange={()=>setComplaintType("PROVIDER")} required/><strong>A PROVEEDOR / SUBCONTRATA</strong><small>Codificación R/P</small></label>
   </div>
   <div className="form-grid">
    <ControlledBusinessCodeField recordType="COMPLAINT" label="N.º reclamación" initialValue={formDefaults.businessCode} mode={mode} yearSource={openedAt} complaintType={complaintType||undefined} locked={mode==="edit"&&!draft}/>
    <label className="field"><span>Departamento{draft?"":" *"}</span><select name="departmentId" value={departmentId} onChange={e=>setDepartmentId(e.target.value)} required={!draft}><option value="">Seleccionar…</option>{departments.map(d=><option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}</select></label>
    <label className="field"><span>Fecha de apertura{draft?"":" *"}</span><input name="openedAt" type="date" value={openedAt} onChange={e=>setOpenedAt(e.target.value)} required={!draft}/></label>
    <Field label="Fecha de detección" name="detectionDate" type="date" defaultValue={formDefaults.detectionDate} required={!draft}/>
    <Field label="Fecha de recepción" name="receptionDate" type="date" defaultValue={formDefaults.receptionDate} required={!draft}/>
    <Field label="Cumplimentado por" name="createdByText" defaultValue={formDefaults.createdByText} required={!draft}/>
    {mode==="edit"?<Field label="Modificado por" name="modifiedByText" defaultValue={formDefaults.createdByText}/>:null}
    <Checks label="Origen / fuente de detección o evento desencadenante" name="sourceTypes" options={sourceOptions} defaults={formDefaults.sourceTypes} required={!draft}/>
    <Field label="Especificar / cliente o proveedor" name="partyName" defaultValue={formDefaults.partyName} required={!draft} span="span-2"/>
    <Field label="Otro origen · especificar" name="sourceOther" defaultValue={formDefaults.sourceOther} span="span-2"/>
    <Field label="Contacto (nombre, teléfono, mail)" name="contact" defaultValue={formDefaults.contact} required={!draft} span="span-2"/>
    <Checks label="Ámbito" name="scopeTypes" options={scopeOptions} defaults={formDefaults.scopeTypes} required={!draft}/>
    <Field label="Otro ámbito · especificar" name="scopeOther" defaultValue={formDefaults.scopeOther} span="span-2"/>
    <Checks label="Objeto afectado" name="affectedObjectTypes" options={objectOptions} defaults={formDefaults.affectedObjectTypes} required={!draft}/>
    <Field label="Otro objeto · especificar" name="affectedObjectOther" defaultValue={formDefaults.affectedObjectOther} span="span-2"/>
   </div>
   <div className="complaint-reference-group">
    <h3>Referencia del material / servicio / equipo</h3>
    <div className="form-grid">
     <Field label="Referencia" name="reference" defaultValue={formDefaults.reference} required={!draft} span="span-2"/>
     <Field label="N.º de lote" name="lotReference" defaultValue={formDefaults.lotReference} required={!draft&&productMaterial}/>
     <Field label="Cantidad" name="quantity" defaultValue={formDefaults.quantity} required={!draft&&productMaterial}/>
     <Field label="Caducidad / reanálisis" name="expiryReanalysis" defaultValue={formDefaults.expiryReanalysis} required={!draft&&productMaterial}/>
     <Field label="Pedido / albarán / certificado" name="purchaseDeliveryReference" defaultValue={formDefaults.purchaseDeliveryReference} span="span-2"/>
    </div>
   </div>
  </section>

  <section className="form-section"><p className="eyebrow">A)</p><h2>Descripción de la reclamación</h2><div className="form-grid">
   <TextArea label="Descripción de la reclamación" name="description" defaultValue={formDefaults.description} required={!draft}/>
   <Checks label="Categoría / motivo" name="categoryTypes" options={categoryOptions} defaults={formDefaults.categoryTypes} required={!draft}/>
   <Field label="Otra categoría · especificar" name="categoryOther" defaultValue={formDefaults.categoryOther} span="span-2"/>
   <Bool label="¿Reclamación recurrente?" name="recurrent" defaultValue={formDefaults.recurrent} required={!draft}/>
   <Field label="Referencia de recurrencia" name="recurrenceReference" defaultValue={formDefaults.recurrenceReference} span="span-2"/>
   <TextArea label="Evidencias / documentación adjunta" name="attachedDocumentation" defaultValue={formDefaults.attachedDocumentation}/>
   <Field label="Emitido por" name="emittedBy" defaultValue={formDefaults.emittedBy} required={!draft}/>
   <Field label="Validado por Garantía de Calidad (si aplica)" name="qaValidatedBy" defaultValue={formDefaults.qaValidatedBy} span="span-2"/>
  </div></section>

  <section className="form-section"><p className="eyebrow">B)</p><h2>Evaluación inicial, investigación e impacto</h2>
   <h3>B.1. Evaluación inicial del impacto real o potencial</h3>
   <div className="complaint-evaluation-list">
    <YesNo label="Calidad / cumplimiento GMP" name="impactQualityGmp" defaultValue={formDefaults.impactQualityGmp} required={!draft}/>
    <YesNo label="Seguridad / eficacia / paciente o usuario" name="impactSafetyEfficacy" defaultValue={formDefaults.impactSafetyEfficacy} required={!draft}/>
    <YesNo label="Cumplimiento regulatorio" name="impactRegulatory" defaultValue={formDefaults.impactRegulatory} required={!draft}/>
    <YesNo label="Medio ambiente" name="impactEnvironment" defaultValue={formDefaults.impactEnvironment} required={!draft}/>
    <YesNo label="Otros lotes, productos, clientes o situaciones similares" name="impactOtherSimilar" defaultValue={formDefaults.impactOtherSimilar} required={!draft}/>
   </div>
   <div className="form-grid">
    <Checks label="Medidas inmediatas / de contención (realizadas o pendientes)" name="containmentActions" options={containmentOptions} defaults={formDefaults.containmentActions} required={!draft}/>
    <Field label="Otra medida de contención" name="containmentOther" defaultValue={formDefaults.containmentOther} span="span-2"/>
    <TextArea label="Justificación del riesgo, alcance y medidas" name="riskJustification" defaultValue={formDefaults.riskJustification} help="Incluir estado, responsable, fecha y referencia cuando aplique." required={!draft}/>
   </div>
   <h3>B.2. Investigación</h3>
   <div className="form-grid">
    <TextArea label="Investigación, evidencias, alcance a otros lotes/productos/clientes y conclusión del impacto" name="investigation" defaultValue={formDefaults.investigation} required={!draft}/>
    <TextArea label="Conclusión del impacto" name="impactAssessment" defaultValue={formDefaults.impactAssessment} required={!draft}/>
    <label className="field"><span>Resultado{draft?"":" *"}</span><select name="investigationResult" defaultValue={formDefaults.investigationResult??""} required={!draft}><option value="">Pendiente</option><option value="PROCEDENT">Procedente</option><option value="NOT_PROCEDENT">No procedente</option><option value="INCONCLUSIVE">No concluyente</option><option value="NOT_ATTRIBUTABLE_TO_COVEX">No atribuible a COVEX</option></select></label>
   </div>
  </section>

  <section className="form-section"><p className="eyebrow">C)</p><h2>Análisis de causa raíz</h2>
   <TextArea label="Causa y evidencias que la sustentan; justificar si no se determina o no se requiere su análisis" name="rootCause" defaultValue={formDefaults.rootCause} required={!draft}/>
  </section>

  <section className="form-section"><p className="eyebrow">D)</p><h2>Clasificación de la reclamación</h2>
   <label className="field"><span>Clasificación{draft?"":" *"}</span><select name="classification" defaultValue={formDefaults.classification??""} required={!draft}><option value="">Pendiente</option><option value="CRITICAL">Crítica</option><option value="MAJOR">Mayor</option><option value="MINOR">Menor</option><option value="NO_GMP_IMPACT">Sin impacto GMP</option></select></label>
  </section>

  <section className="form-section"><p className="eyebrow">E)</p><h2>Evaluación regulatoria</h2><div className="form-grid">
   <Tri label="¿Puede requerir retirada de producto?" name="potentialRecall" defaultValue={formDefaults.potentialRecall} required={!draft}/>
   <Tri label="¿Requiere activar GC-00/029 Retirada?" name="recallProcedureRequired" defaultValue={formDefaults.recallProcedureRequired} required={!draft}/>
   <Tri label="¿Requiere notificación a autoridad sanitaria?" name="authorityNotificationRequired" defaultValue={formDefaults.authorityNotificationRequired} required={!draft}/>
   <Tri label="¿Requiere comunicación al titular / cliente responsable?" name="responsiblePartyCommunicationRequired" defaultValue={formDefaults.responsiblePartyCommunicationRequired} required={!draft}/>
   <TextArea label="Justificación" name="regulatoryJustification" defaultValue={formDefaults.regulatoryJustification} required={!draft}/>
  </div></section>

  <section className="form-section"><p className="eyebrow">F)</p><h2>Líneas de actuación y resolución</h2>
   <TextArea label="Líneas de actuación y resolución" name="resolutionLines" defaultValue={formDefaults.resolutionLines} help="Indica destino, responsables, plazo y responsable de control/seguimiento." required={!draft}/>
  </section>

  <section className="form-section"><p className="eyebrow">G)</p><h2>Acciones derivadas</h2><div className="form-grid">
   <label className="field"><span>¿Existen acciones derivadas?{draft?"":" *"}</span><select name="hasDerivedActions" value={hasActions} onChange={e=>setHasActions(e.target.value as ""|"true"|"false")} required={!draft}><option value="">Pendiente</option><option value="true">Sí</option><option value="false">No</option></select></label>
  </div>
  {hasActions==="true"?<>
   <div className="field full"><span>Acciones derivadas{draft?"":" *"}</span><div className="checkbox-group complaint-action-options">
    {resolutionOptions.map(([value,label])=><label key={value}><input type="checkbox" name="resolutionActions" value={value} checked={actionSelected(value)} onChange={e=>toggleAction(value,e.target.checked)}/><span>{label}</span></label>)}
   </div></div>

   {(actionSelected("CORRECTIVE_ACTION")||actionSelected("PREVENTIVE_ACTION"))?<div className="complaint-action-panel">
    <h3>CAPA correctoras / preventivas propuestas o vinculadas</h3>
    <p className="section-help">Se muestran porque has seleccionado una acción correctora y/o preventiva. Puedes dejar el código pendiente y crear la CAPA después.</p>
    <div className="dynamic-list">
     {capas.map((x,i)=>{
      const visible=(x.actionType==="CORRECTIVE"&&actionSelected("CORRECTIVE_ACTION"))||(x.actionType==="PREVENTIVE"&&actionSelected("PREVENTIVE_ACTION"));
      return visible?<div className="dynamic-row capa" key={x.id??i}>
       <div className="field"><span>Tipo</span><strong className="action-kind">{x.actionType==="CORRECTIVE"?"Correctora":"Preventiva"}</strong></div>
       <label className="field"><span>Descripción *</span><input value={x.description} onChange={e=>patchCapa(i,{description:e.target.value})}/></label>
       <label className="field"><span>Fecha prevista *</span><input type="date" value={x.plannedExecutionDate} onChange={e=>patchCapa(i,{plannedExecutionDate:e.target.value})}/></label>
       <label className="field"><span>Responsable *</span><input value={x.responsible} onChange={e=>patchCapa(i,{responsible:e.target.value})}/></label>
       <label className="field"><span>Código CAPA</span><input value={x.businessCapaCode??""} onChange={e=>patchCapa(i,{businessCapaCode:e.target.value})} placeholder="Pendiente de crear/vincular"/></label>
       <button className="button danger small" type="button" onClick={()=>setCapas(a=>a.filter((_,n)=>n!==i))}>Quitar</button>
      </div>:null;
     })}
     <div className="heading-actions">
      {actionSelected("CORRECTIVE_ACTION")?<button className="button small" type="button" onClick={()=>addCapa("CORRECTIVE")}>+ Añadir CAPA correctora</button>:null}
      {actionSelected("PREVENTIVE_ACTION")?<button className="button small" type="button" onClick={()=>addCapa("PREVENTIVE")}>+ Añadir CAPA preventiva</button>:null}
     </div>
    </div>
   </div>:null}

   {actionSelected("RETURN")?<div className="complaint-action-panel">
    <h3>Devolución / devoluciones propuestas o vinculadas</h3>
    <p className="section-help">Puedes registrar varias devoluciones. Si todavía no existe expediente, deja el código pendiente y podrás crearlo después.</p>
    <div className="dynamic-list">
     {derived.map((x,i)=>x.actionType==="RETURN"?<div className="dynamic-row complaint-derived-row" key={x.id??i}>
      <div className="field"><span>Tipo</span><strong className="action-kind">Devolución</strong></div>
      <label className="field"><span>Código devolución</span><input value={x.businessCode} onChange={e=>patchDerived(i,{businessCode:e.target.value})} placeholder="Pendiente de crear/vincular"/></label>
      <label className="field"><span>Acción / detalle *</span><input value={x.description} onChange={e=>patchDerived(i,{description:e.target.value})}/></label>
      <label className="field"><span>Responsable *</span><input value={x.responsible} onChange={e=>patchDerived(i,{responsible:e.target.value})}/></label>
      <label className="field"><span>Fecha prevista *</span><input type="date" value={x.plannedExecutionDate} onChange={e=>patchDerived(i,{plannedExecutionDate:e.target.value})}/></label>
      <button className="button danger small" type="button" onClick={()=>setDerived(a=>a.filter((_,n)=>n!==i))}>Quitar</button>
     </div>:null)}
     <div><button className="button small" type="button" onClick={()=>setDerived(x=>[...x,{...emptyDerived,actionType:"RETURN"}])}>+ Añadir devolución</button></div>
    </div>
   </div>:null}

   <div className="complaint-action-texts">
    {actionSelected("IMMEDIATE_ACTION")?<TextArea label="Acción inmediata · especificar" name="immediateActionDetails" defaultValue={formDefaults.immediateActionDetails} required={!draft}/>:null}
    {actionSelected("RECALL")?<TextArea label="Retirada del mercado · especificar" name="recallActionDetails" defaultValue={formDefaults.recallActionDetails} required={!draft}/>:null}
    {actionSelected("CREDIT")?<TextArea label="Abono · especificar" name="creditActionDetails" defaultValue={formDefaults.creditActionDetails} required={!draft}/>:null}
    {actionSelected("REPLACEMENT")?<TextArea label="Reposición · especificar" name="replacementActionDetails" defaultValue={formDefaults.replacementActionDetails} required={!draft}/>:null}
    {actionSelected("OTHER")?<TextArea label="Otros · especificar" name="otherResolutionDetails" defaultValue={formDefaults.otherResolutionDetails} required={!draft}/>:null}
   </div>
  </>:<div className="empty-panel complaint-actions-empty">No se requieren acciones derivadas. Este apartado no será obligatorio.</div>}
  </section>

  <section className="form-section"><p className="eyebrow">H)</p><h2>Comunicación al cliente / autoridad sanitaria / proveedor</h2><div className="form-grid">
   <Field label="Fecha" name="communicationDate" type="date" defaultValue={formDefaults.communicationDate} required={!draft}/>
   <Field label="Medio" name="communicationMedium" defaultValue={formDefaults.communicationMedium} required={!draft}/>
   <Field label="Emisor / destinatario" name="communicationParties" defaultValue={formDefaults.communicationParties} required={!draft} span="span-2"/>
   <TextArea label="Resumen de lo comunicado o solicitado" name="communicationSummary" defaultValue={formDefaults.communicationSummary} required={!draft}/>
  </div></section>

  <section className="form-section"><p className="eyebrow">I)</p><h2>Conclusión de la Parte I y seguimiento</h2><div className="form-grid">
   <label className="field span-2"><span>Decisión sobre Parte II{draft?"":" *"}</span><select name="partIIRequired" value={partIIDecision} onChange={e=>setPartIIDecision(e.target.value as "pending"|"true"|"false")} required={!draft}><option value="pending">Pendiente de decisión / seguimiento</option><option value="true">Continúa en Parte II</option><option value="false">No procede Parte II · cierre en Parte I</option></select></label>
   <TextArea label="Conclusión, pendientes y justificación de la decisión" name="conclusion" defaultValue={formDefaults.conclusion} required={!draft}/>
   {open?<Field label="Próximo seguimiento" name="nextFollowupDate" type="date" defaultValue={formDefaults.nextFollowupDate} required help="Obligatorio mientras la reclamación permanezca abierta."/>:null}
  </div></section>

  <section className={`form-section ${partII?"":"complaint-section-muted"}`}><p className="eyebrow">Parte II</p><h2>Seguimiento y cierre de la reclamación</h2>
   {!partII?<div className="analytics-note">{partIIDecision==="pending"?"Parte II pendiente de decisión. Puedes guardar la reclamación abierta y continuar en un seguimiento posterior.":"Parte II no procede. La reclamación puede cerrarse en Parte I."}</div>:<>
    <h3>A) Respuesta del proveedor o al / del cliente</h3><div className="form-grid">
     <Field label="Fecha de respuesta" name="responseDate" type="date" defaultValue={formDefaults.responseDate} required={!draft}/>
     <Field label="Medio de respuesta" name="responseMedium" defaultValue={formDefaults.responseMedium} required={!draft}/>
     <TextArea label="Resumen de la respuesta, compromisos y valoración de suficiencia" name="responseSummary" defaultValue={formDefaults.responseSummary} required={!draft}/>
     <Bool label="¿Respuesta suficiente?" name="responseSufficient" defaultValue={formDefaults.responseSufficient} required={!draft}/>
    </div>
    <h3>B) Verificación de la eficacia</h3><div className="form-grid">
     <label className="field"><span>Verificación de eficacia{draft?"":" *"}</span><select name="effectivenessStatus" defaultValue={formDefaults.effectivenessStatus??"PENDING"} required={!draft}><option value="PENDING">Pendiente</option><option value="ACCEPTABLE">Conforme</option><option value="NOT_ACCEPTABLE">No conforme</option><option value="NOT_REQUIRED">N/A</option></select></label>
     <TextArea label="Valoración de eficacia" name="effectivenessAssessment" defaultValue={formDefaults.effectivenessAssessment}/>
    </div>
    <h3>C) Cierre de la reclamación</h3><div className="form-grid">
     <label className="field"><span>Estado de las acciones{draft?"":" *"}</span><select name="closeActionStatus" defaultValue={formDefaults.closeActionStatus??""} required={!draft}><option value="">No informado</option><option value="COMPLETED">Completadas</option><option value="LINKED">Vinculadas a seguimiento independiente</option><option value="PENDING">Pendientes</option></select></label>
     <Field label="Referencias / responsable del seguimiento" name="closeActionReferences" defaultValue={formDefaults.closeActionReferences} required={!draft} span="span-2"/>
     <TextArea label="Conclusión: suficiencia de evidencias, resolución y situación final" name="closeConclusion" defaultValue={formDefaults.closeConclusion} required={recordStatus==="CLOSED"}/>
    </div>
   </>}
  </section>

  <section className="form-section"><h2>Estado del expediente</h2><div className="form-grid">
   <label className="field"><span>Estado final</span><select name="status" value={recordStatus} onChange={e=>setRecordStatus(e.target.value as "DRAFT"|"OPEN"|"CLOSED")}>{(mode==="create"||formDefaults.status==="DRAFT")?<option value="DRAFT">Borrador</option>:null}<option value="OPEN">Abierta / en seguimiento</option><option value="CLOSED">Cerrada</option></select><small className="muted-note">{draft?"En borrador pueden quedar campos pendientes. Al abrir se validarán todos los campos aplicables.":"Expediente en ciclo operativo."}</small></label>
   {recordStatus==="CLOSED"?<Field label="Fecha de cierre" name="closedAt" type="date" defaultValue={formDefaults.closedAt} required/>:null}
  </div></section>

  <section className="form-section"><h2>Control interno</h2><p className="section-help">Este apartado no forma parte de la obligatoriedad documental del Anexo III.</p><div className="form-grid">
   <TextArea label="Observaciones internas" name="internalObservations" defaultValue={formDefaults.internalObservations}/>
   <label className="field"><span>Control del dato</span><select name="dataQualityStatus" defaultValue={formDefaults.dataQualityStatus??"REVIEW_REQUIRED"}><option value="COMPLETE">Completo</option><option value="INCOMPLETE">Incompleto</option><option value="REVIEW_REQUIRED">Pendiente revisar</option></select></label>
   {mode==="edit"?<TextArea label="Motivo del cambio" name="changeReason"/>:null}
  </div></section>

  <div className="form-footer"><Link className="button" href={complaintId?`/complaints/${complaintId}`:"/complaints"}>Cancelar</Link><div className="heading-actions">
   {recordStatus==="DRAFT"?<button className="button" name="saveStatus" value="DRAFT" disabled={pending}>{pending?"Guardando…":"Guardar borrador"}</button>:null}
   <button className="button primary" name="saveStatus" value={recordStatus==="DRAFT"?"OPEN":recordStatus} disabled={pending}>{pending?"Guardando…":mode==="create"?"Guardar reclamación":recordStatus==="DRAFT"?"Guardar y abrir reclamación":"Guardar cambios"}</button>
  </div></div>
 </form>;
}
