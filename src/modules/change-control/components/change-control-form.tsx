"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type {
  ChangeControlActionInput,
  ChangeControlFormDefaults,
  ChangeControlFormState,
} from "@/modules/change-control/types";

type Department={id:string;code:string;name:string};
const initialState:ChangeControlFormState={error:null};
const emptyAction:ChangeControlActionInput={
  departmentText:"",description:"",responsible:"",plannedExecutionDate:"",
  actualExecutionDate:"",completed:false,evidenceComment:"",introducedInSequence:null,
};

function Field({label,name,defaultValue,type="text",required=false,span=""}:{
  label:string;name:string;defaultValue?:string;type?:string;required?:boolean;span?:string;
}) {
  return <label className={`field ${span}`}><span>{label}{required?" *":""}</span>
    <input name={name} type={type} defaultValue={defaultValue??""} required={required}/></label>;
}
function TextArea({label,name,defaultValue,help,span="span-3"}:{
  label:string;name:string;defaultValue?:string;help?:string;span?:string;
}) {
  return <label className={`field ${span}`}><span>{label}</span>{help?<small className="muted-note">{help}</small>:null}
    <textarea name={name} defaultValue={defaultValue??""}/></label>;
}
function BooleanSelect({label,name,defaultValue}:{
  label:string;name:string;defaultValue?:string;
}) {
  return <label className="field"><span>{label}</span><select name={name} defaultValue={defaultValue??""}>
    <option value="">Pendiente / no informado</option><option value="true">Sí</option><option value="false">No</option>
  </select></label>;
}
function TriState({label,name,defaultValue}:{
  label:string;name:string;defaultValue?:string;
}) {
  return <label className="field"><span>{label}</span><select name={name} defaultValue={defaultValue??""}>
    <option value="">Pendiente</option><option value="YES">Sí</option><option value="NO">No</option><option value="NA">No aplica</option>
  </select></label>;
}

export function ChangeControlForm({mode,action,departments,defaults={},changeId}:{
  mode:"create"|"edit";
  action:(state:ChangeControlFormState,formData:FormData)=>Promise<ChangeControlFormState>;
  departments:Department[];
  defaults?:ChangeControlFormDefaults;
  changeId?:string;
}) {
  const [state,formAction,pending]=useActionState(action,initialState);
  const [actions,setActions]=useState<ChangeControlActionInput[]>(
    defaults.actions?.length?defaults.actions:[{...emptyAction}],
  );
  const updateAction=(index:number,patch:Partial<ChangeControlActionInput>)=>{
    setActions((current)=>current.map((item,i)=>i===index?{...item,...patch}:item));
  };
  const scopeOptions=[
    ["FACILITIES","Instalaciones"],["EQUIPMENT","Equipos"],["PROCESS","Proceso"],
    ["MATERIAL","Material/MP"],["SUPPLIER","Proveedor"],["DOCUMENTATION","Documentación"],["OTHER","Otros"],
  ];

  return <form action={formAction} className="record-form">
    <input type="hidden" name="actionsJson" value={JSON.stringify(actions)}/>
    {state.error?<div className="form-errors"><strong>{state.error}</strong>{state.fieldErrors?.length?
      <ul>{state.fieldErrors.map((e)=><li key={e}>{e}</li>)}</ul>:null}</div>:null}

    <section className="form-section">
      <h2>1. Solicitud del cambio · Anexo III</h2>
      <p className="section-help">Identificación, alcance, solicitante, descripción y aceptación de la solicitud.</p>
      <div className="form-grid">
        <Field label="N.º Control de Cambio" name="businessCode" defaultValue={defaults.businessCode} required/>
        <Field label="Fecha de solicitud" name="requestedAt" type="date" defaultValue={defaults.requestedAt} required/>
        <label className="field span-2"><span>Departamento/Área solicitante *</span>
          <select name="departmentId" defaultValue={defaults.departmentId??""} required>
            <option value="">Seleccionar…</option>{departments.map((d)=><option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
          </select>
        </label>
        <div className="field span-3"><span>Alcance del cambio *</span>
          <div className="checkbox-group">{scopeOptions.map(([value,label])=><label key={value}>
            <input type="checkbox" name="scopes" value={value} defaultChecked={defaults.scopes?.includes(value)}/>{label}
          </label>)}</div>
        </div>
        <Field label="Especificar otros" name="scopeOther" defaultValue={defaults.scopeOther}/>
        <Field label="Nombre y apellidos del solicitante" name="requesterName" defaultValue={defaults.requesterName} required span="span-2"/>
        <Field label="Puesto" name="requesterPosition" defaultValue={defaults.requesterPosition} span="span-2"/>
        {mode==="edit"?<Field label="Modificado por" name="modifiedByText" defaultValue={defaults.requesterName}/>:null}
        <TextArea label="Descripción del cambio" name="description" defaultValue={defaults.description}/>
        <TextArea label="Justificación del cambio" name="justification" defaultValue={defaults.justification}/>
        <TextArea label="Relación de documentos que se aportan" name="supportingDocuments" defaultValue={defaults.supportingDocuments}/>
        <label className="field"><span>Aceptación de solicitud</span><select name="requestStatus" defaultValue={defaults.requestStatus??"PENDING"}>
          <option value="PENDING">Pendiente</option><option value="ACCEPTED">Aceptada</option><option value="DENIED">Denegada</option>
        </select></label>
        <Field label="Responsable de dictamen" name="requestResponsible" defaultValue={defaults.requestResponsible}/>
        <Field label="Aceptada/denegada por" name="acceptedByText" defaultValue={defaults.acceptedByText}/>
        <Field label="Fecha aceptación/denegación" name="requestDecisionAt" type="date" defaultValue={defaults.requestDecisionAt}/>
      </div>
    </section>

    <section className="form-section">
      <h2>2. Dictamen · Anexo IV</h2>
      <p className="section-help">Evaluación del riesgo e implicaciones, clasificación y decisión de aprobación.</p>
      <div className="form-grid">
        <TextArea label="Evaluación del cambio" name="evaluation" defaultValue={defaults.evaluation}/>
        <label className="field"><span>Clasificación</span><select name="classification" defaultValue={defaults.classification??""}>
          <option value="">Pendiente</option><option value="MAJOR">Mayor</option><option value="MINOR">Menor</option>
        </select></label>
        <Field label="Fecha prevista de implementación" name="plannedImplementationAt" type="date" defaultValue={defaults.plannedImplementationAt}/>
        <BooleanSelect label="¿Comité de cambios?" name="committeeRequired" defaultValue={defaults.committeeRequired}/>
        <Field label="Justificación / personal implicado" name="committeeJustification" defaultValue={defaults.committeeJustification} span="span-2"/>
        <BooleanSelect label="¿Informar a cliente?" name="clientNotificationRequired" defaultValue={defaults.clientNotificationRequired}/>
        <Field label="Detalle / fecha / evidencia cliente" name="clientNotificationDetail" defaultValue={defaults.clientNotificationDetail} span="span-2"/>
        <BooleanSelect label="¿Notificación/aprobación autoridad?" name="authorityNotificationRequired" defaultValue={defaults.authorityNotificationRequired}/>
        <Field label="Detalle autoridad sanitaria" name="authorityNotificationDetail" defaultValue={defaults.authorityNotificationDetail} span="span-2"/>
        <TriState label="¿Reflejar en PQR?" name="pqrRequirement" defaultValue={defaults.pqrRequirement}/>
        <Field label="Producto(s) PQR" name="pqrProducts" defaultValue={defaults.pqrProducts}/>
        <Field label="Periodo PQR" name="pqrPeriod" defaultValue={defaults.pqrPeriod}/>
        <TriState label="Lotes a estabilidad" name="stabilityRequirement" defaultValue={defaults.stabilityRequirement}/>
        <div className="field span-2"><span>Tipo estabilidad</span><div className="checkbox-group">
          <label><input type="checkbox" name="stabilityAccelerated" defaultChecked={defaults.stabilityAccelerated}/>Acelerada</label>
          <label><input type="checkbox" name="stabilityOngoing" defaultChecked={defaults.stabilityOngoing}/>En curso</label>
        </div></div>
        <Field label="Detalle estabilidad" name="stabilityDetail" defaultValue={defaults.stabilityDetail}/>
        <TriState label="Análisis adicionales" name="additionalAnalysis" defaultValue={defaults.additionalAnalysis}/>
        <Field label="Especificar análisis" name="additionalAnalysisDetail" defaultValue={defaults.additionalAnalysisDetail} span="span-2"/>
        <TriState label="Validación adicional" name="additionalValidation" defaultValue={defaults.additionalValidation}/>
        <Field label="Detalles de validación" name="additionalValidationDetail" defaultValue={defaults.additionalValidationDetail} span="span-2"/>
        <BooleanSelect label="Otros requisitos" name="otherImplication" defaultValue={defaults.otherImplication}/>
        <Field label="Especificar otros" name="otherImplicationDetail" defaultValue={defaults.otherImplicationDetail} span="span-2"/>
      </div>
    </section>

    <section className="form-section">
      <h2>3. Plan de ejecución</h2>
      <p className="section-help">Cada acción debe indicar departamento, responsable y plazo. Las fechas reales/evidencias pueden completarse durante el seguimiento.</p>
      <div className="dynamic-list">{actions.map((item,index)=><div className="dynamic-row change-action" key={index}>
        <label className="field"><span>Departamento</span><input value={item.departmentText} onChange={(e)=>updateAction(index,{departmentText:e.target.value})}/></label>
        <label className="field"><span>Acción</span><textarea value={item.description} onChange={(e)=>updateAction(index,{description:e.target.value})}/></label>
        <label className="field"><span>Responsable</span><input value={item.responsible} onChange={(e)=>updateAction(index,{responsible:e.target.value})}/></label>
        <label className="field"><span>Fecha prevista</span><input type="date" value={item.plannedExecutionDate} onChange={(e)=>updateAction(index,{plannedExecutionDate:e.target.value})}/></label>
        <label className="field"><span>Fecha real</span><input type="date" value={item.actualExecutionDate} onChange={(e)=>updateAction(index,{actualExecutionDate:e.target.value})}/></label>
        <label className="field"><span>Estado</span><select value={item.completed?"yes":"no"} onChange={(e)=>updateAction(index,{completed:e.target.value==="yes"})}>
          <option value="no">Pendiente</option><option value="yes">Completada</option>
        </select></label>
        <label className="field"><span>Evidencia / comentario</span><textarea value={item.evidenceComment} onChange={(e)=>updateAction(index,{evidenceComment:e.target.value})}/></label>
        <button type="button" className="button danger small" onClick={()=>setActions((current)=>current.filter((_,i)=>i!==index))}>Quitar</button>
      </div>)}</div>
      <div style={{marginTop:10}}><button type="button" className="button small" onClick={()=>setActions((c)=>[...c,{...emptyAction}])}>+ Añadir acción</button></div>
    </section>

    <section className="form-section">
      <h2>4. Resultado del dictamen</h2>
      <div className="form-grid">
        <label className="field"><span>Resultado</span><select name="decisionResult" defaultValue={defaults.decisionResult??"PENDING"}>
          <option value="PENDING">Pendiente</option><option value="APPROVED">Aprobado</option><option value="REJECTED">Rechazado</option>
        </select></label>
        <Field label="Fecha del dictamen / aprobación" name="decisionAt" type="date" defaultValue={defaults.decisionAt}/>
        <Field label="Responsable de seguimiento" name="followupResponsible" defaultValue={defaults.followupResponsible}/>
        <Field label="Aprobado por" name="approvedByText" defaultValue={defaults.approvedByText}/>
        <TextArea label="Observaciones del dictamen" name="decisionObservations" defaultValue={defaults.decisionObservations}/>
      </div>
    </section>

    <section className="form-section">
      <h2>5. Estado vigente y cierre</h2>
      <p className="section-help">El cierre operativo y el cierre efectivo se mantienen separados. Los seguimientos se registran desde la ficha del expediente.</p>
      <div className="form-grid">
        <label className="field"><span>Estado de ejecución</span><select name="executionStatus" defaultValue={defaults.executionStatus??"NOT_EXECUTED"}>
          <option value="NOT_EXECUTED">No ejecutado</option><option value="EXECUTED">Ejecutado</option>
        </select></label>
        <Field label="Fecha de ejecución" name="executedAt" type="date" defaultValue={defaults.executedAt}/>
        <Field label="Cierre operativo" name="operationalClosedAt" type="date" defaultValue={defaults.operationalClosedAt}/>
        <label className="field"><span>Comprobación de eficacia</span><select name="effectivenessStatus" defaultValue={defaults.effectivenessStatus??"PENDING"}>
          <option value="PENDING">Pendiente</option><option value="ACCEPTABLE">Aceptable</option><option value="NOT_ACCEPTABLE">No aceptable</option>
        </select></label>
        <TextArea label="Observaciones de eficacia" name="effectivenessObservations" defaultValue={defaults.effectivenessObservations}/>
        <label className="field"><span>Estado final</span><select name="status" defaultValue={defaults.status??"OPEN"}>
          <option value="OPEN">Abierto</option><option value="CLOSED">Cerrado</option><option value="REJECTED">Rechazado</option><option value="CANCELLED">Cancelado</option>
        </select></label>
        <Field label="Fecha cierre efectivo" name="effectiveClosedAt" type="date" defaultValue={defaults.effectiveClosedAt}/>
        <label className="field"><span>Cierre sin ejecución</span><span className="checkbox-group"><label>
          <input type="checkbox" name="closeWithoutExecution" defaultChecked={defaults.closeWithoutExecution}/>Sí, se cierra sin implantar
        </label></span></label>
        <TextArea label="Motivo del cierre y conclusión" name="closureConclusion" defaultValue={defaults.closureConclusion}/>
        <TextArea label="Observaciones internas" name="internalObservations" defaultValue={defaults.internalObservations}/>
        <label className="field"><span>Documento firmado disponible</span><select name="signedDocumentAvailable" defaultValue={defaults.signedDocumentAvailable??""}>
          <option value="">No informado</option><option value="true">Sí</option><option value="false">No</option>
        </select></label>
        <label className="field"><span>Control del dato</span><select name="dataQualityStatus" defaultValue={defaults.dataQualityStatus??"REVIEW_REQUIRED"}>
          <option value="COMPLETE">Completo</option><option value="INCOMPLETE">Incompleto</option><option value="REVIEW_REQUIRED">Pendiente de revisar</option>
        </select></label>
        {mode==="edit"?<TextArea label="Motivo de la modificación" name="changeReason" span="span-2"/>:null}
      </div>
    </section>

    <div className="form-footer">
      <Link className="button" href={changeId?`/changes/${changeId}`:"/changes"}>Cancelar</Link>
      <button className="button primary" type="submit" disabled={pending}>{pending?"Guardando…":mode==="create"?"Guardar control de cambio":"Guardar cambios"}</button>
    </div>
  </form>;
}
