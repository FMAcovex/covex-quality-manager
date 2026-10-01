"use client";

import Link from "next/link";
import { useActionState,useState } from "react";
import { submittedDefaults } from "@/lib/forms/preserved-state";
import { ControlledBusinessCodeField } from "@/components/controlled-business-code-field";
import type { DepartmentOption,ReturnFormDefaults,ReturnFormState,ReturnProductInput } from "@/modules/returns/types";

const initial:ReturnFormState={error:null};
const emptyProduct:ReturnProductInput={departmentId:"",productType:"API",otherProductType:"",productNameCode:"",format:"",lot:"",expiryReanalysis:"",quantity:"",unit:"",netWeight:"",grossWeight:"",receptionObservations:"",receivedBy:"",receivedByDate:"",verifiedBy:"",verifiedByDate:""};

function Field({label,name,defaultValue,type="text",required=false,span=""}:{label:string;name:string;defaultValue?:string;type?:string;required?:boolean;span?:string}){
  return <label className={`field ${span}`}><span>{label}{required?" *":""}</span><input name={name} type={type} defaultValue={defaultValue??""} required={required}/></label>;
}
function TextArea({label,name,defaultValue,required=false}:{label:string;name:string;defaultValue?:string;required?:boolean}){
  return <label className="field full"><span>{label}{required?" *":""}</span><textarea name={name} defaultValue={defaultValue??""} required={required}/></label>;
}
function Tri({label,name,defaultValue,required=false}:{label:string;name:string;defaultValue?:string;required?:boolean}){
  return <label className="field"><span>{label}{required?" *":""}</span><select name={name} defaultValue={defaultValue??""} required={required}><option value="">No informado</option><option value="YES">Sí</option><option value="NO">No</option><option value="NA">N/A</option></select></label>;
}

export function ReturnForm({mode,action,departments,defaults={},returnId,fromComplaintId}:{mode:"create"|"edit";action:(s:ReturnFormState,fd:FormData)=>Promise<ReturnFormState>;departments:DepartmentOption[];defaults?:ReturnFormDefaults;returnId?:string;fromComplaintId?:string}){
  const [state,formAction,pending]=useActionState(action,initial);
  const formDefaults=submittedDefaults(defaults,state.submittedValues);
  const [products,setProducts]=useState(defaults.products?.length?defaults.products:[{...emptyProduct}]);
  const [departmentId,setDepartmentId]=useState(formDefaults.departmentId??"");
  const [communicationDate,setCommunicationDate]=useState(formDefaults.communicationDate??"");
  const [recordStatus,setRecordStatus]=useState<"DRAFT"|"OPEN"|"CLOSED">(formDefaults.status??(mode==="create"?"DRAFT":"OPEN"));
  const draft=recordStatus==="DRAFT";
  const closed=recordStatus==="CLOSED";
  const patch=(i:number,p:Partial<ReturnProductInput>)=>setProducts(x=>x.map((v,n)=>n===i?{...v,...p}:v));

  return <form key={state.formRevision??0} action={formAction} className="form-stack return-form-stack">
    <input type="hidden" name="productsJson" value={JSON.stringify(products)}/>
    {fromComplaintId?<input type="hidden" name="fromComplaintId" value={fromComplaintId}/>:null}
    {state.error?<div className="form-errors"><strong>{state.error}</strong>{state.fieldErrors?.length?<ul>{state.fieldErrors.map(x=><li key={x}>{x}</li>)}</ul>:null}</div>:null}

    <section className="form-section">
      <h2>1. Datos generales de la devolución</h2>
      <p className="section-help">{draft?"En borrador puedes dejar datos pendientes. Al pasar a Abierta se validarán los campos obligatorios.":"Los campos marcados con * son obligatorios en expedientes operativos."}</p>
      <div className="form-grid return-form-grid">
        <ControlledBusinessCodeField recordType="RETURN" label="N.º devolución" initialValue={formDefaults.businessCode} mode={mode} yearSource={communicationDate} departmentId={departmentId} locked={mode==="edit"&&!draft}/>
        <label className="field"><span>Almacén / área{draft?"":" *"}</span><select name="departmentId" value={departmentId} onChange={e=>setDepartmentId(e.target.value)} required={!draft}><option value="">Seleccionar…</option>{departments.map(d=><option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}</select><small className="muted-note">Solo departamentos LG autorizados para Devoluciones.</small></label>
        <label className="field"><span>Fecha comunicación{draft?"":" *"}</span><input name="communicationDate" type="date" value={communicationDate} onChange={e=>setCommunicationDate(e.target.value)} required={!draft}/></label>
        <Field label="Fecha recepción" name="receivedAt" type="date" defaultValue={formDefaults.receivedAt} required={!draft}/>
        <Field label="Cumplimentado por" name="createdByText" defaultValue={formDefaults.createdByText} required={!draft}/>
        {mode==="edit"?<Field label="Modificado por" name="modifiedByText" defaultValue={formDefaults.createdByText}/>:null}
        {fromComplaintId?<><input type="hidden" name="returnType" value="COMPLAINT"/><label className="field"><span>Tipo *</span><select value="COMPLAINT" disabled><option value="COMPLAINT">Reclamación</option></select><small className="muted-note">Fijado por la Reclamación de origen.</small></label></>:<label className="field"><span>Tipo{draft?"":" *"}</span><select name="returnType" defaultValue={formDefaults.returnType??""} required={!draft}><option value="">Seleccionar…</option><option value="COMMERCIAL">Comercial</option><option value="COMPLAINT">Reclamación</option><option value="RECALL">Retirada</option><option value="EXPIRY">Caducidad</option><option value="TRANSPORT">Transporte</option><option value="OTHER">Otra</option></select></label>}
        <Field label="Otra · especificar" name="otherReturnType" defaultValue={formDefaults.otherReturnType}/>
        <Field label="Cliente / entidad" name="customerEntity" defaultValue={formDefaults.customerEntity} required={!draft}/>
        <Field label="País" name="country" defaultValue={formDefaults.country} required={!draft}/>
        <Field label="Dirección" name="address" defaultValue={formDefaults.address} required={!draft} span="span-2"/>
        {fromComplaintId?<><input type="hidden" name="relatedDocument" value={formDefaults.relatedDocument??""}/><label className="field span-2"><span>Documento relacionado</span><input value={formDefaults.relatedDocument??""} readOnly/><small className="muted-note">Código de la Reclamación de origen.</small></label></>:<Field label="Documento relacionado" name="relatedDocument" defaultValue={formDefaults.relatedDocument} span="span-2"/>}
        <Field label="Condiciones de conservación" name="conservationConditions" defaultValue={formDefaults.conservationConditions} required={!draft} span="span-2"/>
        <Field label="N.º albarán" name="deliveryNote" defaultValue={formDefaults.deliveryNote}/>
      </div>
    </section>

    <section className="form-section">
      <h2>2. Producto(s) devuelto(s)</h2>
      <p className="section-help">Añade una ficha por producto. Tipo, producto/código, formato, lote, caducidad/reanálisis y cantidad son obligatorios cuando el expediente es operativo.</p>
      <div className="return-product-list">
        {products.map((p,i)=><article className="return-product-card" key={p.id??i}>
          <div className="section-title-row"><div><h3>Producto {i+1}</h3></div>{products.length>1?<button type="button" className="button danger small" onClick={()=>setProducts(x=>x.filter((_,n)=>n!==i))}>Quitar</button>:null}</div>
          <div className="form-grid return-product-grid">
            <label className="field"><span>Tipo de producto{draft?"":" *"}</span><select value={p.productType} onChange={e=>patch(i,{productType:e.target.value as ReturnProductInput["productType"]})} required={!draft}><option value="API">API</option><option value="INTERMEDIATE">Intermedio</option><option value="MEDICINE">Medicamento</option><option value="SUPPLEMENT">Complemento</option><option value="IMPORTED_PRODUCT">Importado</option><option value="MEDICAL_DEVICE">Producto sanitario</option><option value="COSMETIC">Cosmético</option><option value="OTHER">Otro</option></select></label>
            <label className="field"><span>Producto / código{draft?"":" *"}</span><input value={p.productNameCode} onChange={e=>patch(i,{productNameCode:e.target.value})} required={!draft}/></label>
            <label className="field"><span>Formato{draft?"":" *"}</span><input value={p.format} onChange={e=>patch(i,{format:e.target.value})} required={!draft}/></label>
            <label className="field"><span>Lote{draft?"":" *"}</span><input value={p.lot} onChange={e=>patch(i,{lot:e.target.value})} required={!draft}/></label>
            <label className="field"><span>Caducidad / reanálisis{draft?"":" *"}</span><input value={p.expiryReanalysis} onChange={e=>patch(i,{expiryReanalysis:e.target.value})} required={!draft}/></label>
            <label className="field"><span>Cantidad{draft?"":" *"}</span><input value={p.quantity} onChange={e=>patch(i,{quantity:e.target.value})} required={!draft}/></label>
            <label className="field"><span>Unidad</span><input value={p.unit} onChange={e=>patch(i,{unit:e.target.value})}/></label>
            <label className="field"><span>Peso neto</span><input value={p.netWeight} onChange={e=>patch(i,{netWeight:e.target.value})}/></label>
            <label className="field"><span>Peso bruto</span><input value={p.grossWeight} onChange={e=>patch(i,{grossWeight:e.target.value})}/></label>
            <label className="field"><span>Recibido por</span><input value={p.receivedBy} onChange={e=>patch(i,{receivedBy:e.target.value})}/></label>
            <label className="field"><span>Fecha recepción firma</span><input type="date" value={p.receivedByDate} onChange={e=>patch(i,{receivedByDate:e.target.value})}/></label>
            <label className="field"><span>Verificado por</span><input value={p.verifiedBy} onChange={e=>patch(i,{verifiedBy:e.target.value})}/></label>
            <label className="field"><span>Fecha verificación</span><input type="date" value={p.verifiedByDate} onChange={e=>patch(i,{verifiedByDate:e.target.value})}/></label>
            <label className="field full"><span>Observaciones de recepción</span><textarea value={p.receptionObservations} onChange={e=>patch(i,{receptionObservations:e.target.value})}/></label>
          </div>
        </article>)}
      </div>
      <button type="button" className="button small" onClick={()=>setProducts(x=>[...x,{...emptyProduct}])}>+ Añadir producto</button>
    </section>

    <section className="form-section">
      <h2>3. Motivo y documentación</h2>
      <div className="form-grid return-form-grid">
        <TextArea label="Observaciones o incidencias" name="reasonObservations" defaultValue={formDefaults.reasonObservations} required={!draft}/>
        <TextArea label="Documentación anexada" name="attachedDocumentation" defaultValue={formDefaults.attachedDocumentation} required={!draft}/>
      </div>
    </section>

    <section className="form-section">
      <h2>4. Comprobaciones para posible reintegración</h2>
      <div className="form-grid return-check-grid">
        <Tri label="Plazo aceptable de devolución" name="withinAcceptedReturnPeriod" defaultValue={formDefaults.withinAcceptedReturnPeriod} required={!draft}/>
        <Tri label="+15/+25 ºC dentro de 10 días" name="roomTemperatureWithinTenDays" defaultValue={formDefaults.roomTemperatureWithinTenDays} required={!draft}/>
        <Tri label="+2/+8 ºC dentro de 48 h" name="coldChainWithinFortyEightHours" defaultValue={formDefaults.coldChainWithinFortyEightHours} required={!draft}/>
        <Tri label="Identificador único / Data Matrix activo" name="uniqueIdentifierActive" defaultValue={formDefaults.uniqueIdentifierActive} required={!draft}/>
        <Tri label="Tamper Evidence intacto" name="tamperEvidenceIntact" defaultValue={formDefaults.tamperEvidenceIntact} required={!draft}/>
        <Tri label="Envases íntegros" name="packagingIntegrityOk" defaultValue={formDefaults.packagingIntegrityOk} required={!draft}/>
        <Tri label="Declaración cliente disponible" name="customerDeclarationAvailable" defaultValue={formDefaults.customerDeclarationAvailable} required={!draft}/>
        <Tri label="Almacenamiento/transporte conforme" name="storageTransportConditionsOk" defaultValue={formDefaults.storageTransportConditionsOk} required={!draft}/>
        <Tri label="Sin uso/daño/contaminación" name="noUseDamageContamination" defaultValue={formDefaults.noUseDamageContamination} required={!draft}/>
        <Tri label="Sin retirada/alerta/bloqueo" name="noRecallAlertBlock" defaultValue={formDefaults.noRecallAlertBlock} required={!draft}/>
        <Tri label="Caducidad/reanálisis aceptable" name="expiryAcceptable" defaultValue={formDefaults.expiryAcceptable} required={!draft}/>
        <Tri label="Evaluación Control de Calidad" name="qcAssessmentCompleted" defaultValue={formDefaults.qcAssessmentCompleted} required={!draft}/>
      </div>
    </section>

    <section className="form-section">
      <h2>5. Productos termolábiles / temperatura controlada</h2>
      <div className="form-grid return-check-grid">
        <Tri label="Registro temperatura almacenamiento" name="storageTemperatureRecord" defaultValue={formDefaults.storageTemperatureRecord} required={!draft}/>
        <Tri label="Evidencia temperatura transporte retorno" name="returnTransportTempEvidence" defaultValue={formDefaults.returnTransportTempEvidence} required={!draft}/>
        <Tri label="Embalaje de transporte conforme" name="transportPackagingSuitable" defaultValue={formDefaults.transportPackagingSuitable} required={!draft}/>
        <Tri label="Temperatura recepción aceptable" name="receiptTemperatureAcceptable" defaultValue={formDefaults.receiptTemperatureAcceptable} required={!draft}/>
        <Tri label="Excursión evaluada/documentada" name="temperatureExcursionEvaluated" defaultValue={formDefaults.temperatureExcursionEvaluated} required={!draft}/>
        <Tri label="Sistema devolución termolábiles validado" name="coldChainReturnSystemValidated" defaultValue={formDefaults.coldChainReturnSystemValidated} required={!draft}/>
      </div>
    </section>

    <section className="form-section">
      <h2>7. Decisión de Garantía de Calidad / Dirección Técnica</h2>
      <div className="form-grid return-form-grid">
        <label className="field"><span>Decisión{closed?" *":""}</span><select name="decision" defaultValue={formDefaults.decision??"PENDING"}><option value="PENDING">Pendiente</option><option value="ACCEPTED">Aceptada</option><option value="REJECTED">Rechazada</option></select></label>
        <Field label="Fecha decisión" name="decisionDate" type="date" defaultValue={formDefaults.decisionDate} required={closed}/>
        <TextArea label="Destino final" name="finalDestination" defaultValue={formDefaults.finalDestination} required={closed}/>
        <Tri label="Trazabilidad actualizada" name="traceabilityUpdated" defaultValue={formDefaults.traceabilityUpdated} required={closed}/>
        <Field label="Fecha cierre" name="closedAt" type="date" defaultValue={formDefaults.closedAt} required={closed}/>
        <label className="field"><span>Estado</span><select name="status" value={recordStatus} onChange={e=>setRecordStatus(e.target.value as "DRAFT"|"OPEN"|"CLOSED")}>{(mode==="create"||formDefaults.status==="DRAFT")?<option value="DRAFT">Borrador</option>:null}<option value="OPEN">Abierta</option><option value="CLOSED">Cerrada</option></select><small className="muted-note">{draft?"En borrador pueden quedar campos pendientes.":"La devolución se edita siempre sobre el mismo expediente; no crea revisiones."}</small></label>
      </div>
    </section>

    <section className="form-section">
      <h2>8. Control interno</h2>
      <p className="section-help">Campos opcionales de control interno.</p>
      <div className="form-grid return-form-grid">
        <TextArea label="Observaciones internas" name="internalObservations" defaultValue={formDefaults.internalObservations}/>
        <label className="field"><span>Documento firmado disponible</span><select name="signedDocumentAvailable" defaultValue={formDefaults.signedDocumentAvailable??""}><option value="">No informado</option><option value="true">Sí</option><option value="false">No</option></select></label>
        <label className="field"><span>Control del dato</span><select name="dataQualityStatus" defaultValue={formDefaults.dataQualityStatus??"REVIEW_REQUIRED"}><option value="COMPLETE">Completo</option><option value="INCOMPLETE">Incompleto</option><option value="REVIEW_REQUIRED">Pendiente revisar</option></select></label>
        {mode==="edit"?<TextArea label="Motivo del cambio" name="changeReason"/>:null}
      </div>
    </section>

    <div className="form-footer"><Link className="button" href={returnId?`/returns/${returnId}`:"/returns"}>Cancelar</Link><button className="button primary" disabled={pending}>{pending?"Guardando…":draft?"Guardar borrador":mode==="create"?"Guardar devolución":"Guardar cambios"}</button></div>
  </form>;
}
