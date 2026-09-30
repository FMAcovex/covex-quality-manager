"use client";
import Link from "next/link";
import { submittedDefaults } from "@/lib/forms/preserved-state";
import { ControlledBusinessCodeField } from "@/components/controlled-business-code-field";
import { useActionState,useState } from "react";
import type { DepartmentOption,ReturnFormDefaults,ReturnFormState,ReturnProductInput } from "@/modules/returns/types";
const initial:ReturnFormState={error:null};
const emptyProduct:ReturnProductInput={departmentId:"",productType:"API",otherProductType:"",productNameCode:"",format:"",lot:"",expiryReanalysis:"",quantity:"",unit:"",netWeight:"",grossWeight:"",receptionObservations:"",receivedBy:"",receivedByDate:"",verifiedBy:"",verifiedByDate:""};

function Field({label,name,defaultValue,type="text",required=false,span=""}:{label:string;name:string;defaultValue?:string;type?:string;required?:boolean;span?:string}){return <label className={`field ${span}`}><span>{label}{required?" *":""}</span><input name={name} type={type} defaultValue={defaultValue??""} required={required}/></label>;}
function TextArea({label,name,defaultValue}:{label:string;name:string;defaultValue?:string}){return <label className="field full"><span>{label}</span><textarea name={name} defaultValue={defaultValue??""}/></label>;}
function Tri({label,name,defaultValue}:{label:string;name:string;defaultValue?:string}){return <label className="field"><span>{label}</span><select name={name} defaultValue={defaultValue??""}><option value="">No informado</option><option value="YES">Sí</option><option value="NO">No</option><option value="NA">N/A</option></select></label>;}

export function ReturnForm({mode,action,departments,defaults={},returnId,fromComplaintId}:{mode:"create"|"edit";action:(s:ReturnFormState,fd:FormData)=>Promise<ReturnFormState>;departments:DepartmentOption[];defaults?:ReturnFormDefaults;returnId?:string;fromComplaintId?:string}){
 const [state,formAction,pending]=useActionState(action,initial);const formDefaults=submittedDefaults(defaults,state.submittedValues);const [products,setProducts]=useState(defaults.products?.length?defaults.products:[{...emptyProduct}]);
 const [departmentId,setDepartmentId]=useState(formDefaults.departmentId??"");
 const [communicationDate,setCommunicationDate]=useState(formDefaults.communicationDate??"");
 const [recordStatus,setRecordStatus]=useState<"DRAFT"|"OPEN"|"CLOSED">(formDefaults.status??(mode==="create"?"DRAFT":"OPEN"));
 const draft=recordStatus==="DRAFT";
 const patch=(i:number,p:Partial<ReturnProductInput>)=>setProducts(x=>x.map((v,n)=>n===i?{...v,...p}:v));
 return <form key={state.formRevision??0} action={formAction} className="form-stack">
  <input type="hidden" name="productsJson" value={JSON.stringify(products)}/>{fromComplaintId?<input type="hidden" name="fromComplaintId" value={fromComplaintId}/>:null}
  {state.error?<div className="form-errors"><strong>{state.error}</strong>{state.fieldErrors?.length?<ul>{state.fieldErrors.map(x=><li key={x}>{x}</li>)}</ul>:null}</div>:null}
  <section className="form-section"><h2>1. Datos generales de la devolución</h2><div className="form-grid">
   <ControlledBusinessCodeField recordType="RETURN" label="N.º devolución" initialValue={formDefaults.businessCode} mode={mode} yearSource={communicationDate} departmentId={departmentId} locked={mode==="edit"&&!draft}/>
   <label className="field"><span>Almacén / área{draft?"":" *"}</span><select name="departmentId" value={departmentId} onChange={e=>setDepartmentId(e.target.value)} required={!draft}><option value="">Seleccionar…</option>{departments.map(d=><option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}</select></label>
   <label className="field"><span>Fecha comunicación{draft?"":" *"}</span><input name="communicationDate" type="date" value={communicationDate} onChange={e=>setCommunicationDate(e.target.value)} required={!draft}/></label>
   <Field label="Fecha recepción" name="receivedAt" type="date" defaultValue={formDefaults.receivedAt}/>
   <Field label="Cumplimentado por" name="createdByText" defaultValue={formDefaults.createdByText} required={!draft}/>
   {mode==="edit"?<Field label="Modificado por" name="modifiedByText" defaultValue={formDefaults.createdByText}/>:null}
   {fromComplaintId?<><input type="hidden" name="returnType" value="COMPLAINT"/><label className="field"><span>Tipo *</span><select value="COMPLAINT" disabled><option value="COMPLAINT">Reclamación</option></select><small className="muted-note">Fijado por la Reclamación de origen.</small></label></>:<label className="field"><span>Tipo{draft?"":" *"}</span><select name="returnType" defaultValue={formDefaults.returnType??""} required={!draft}><option value="">Seleccionar…</option><option value="COMMERCIAL">Comercial</option><option value="COMPLAINT">Reclamación</option><option value="RECALL">Retirada</option><option value="EXPIRY">Caducidad</option><option value="TRANSPORT">Transporte</option><option value="OTHER">Otra</option></select></label>}
   <Field label="Otra · especificar" name="otherReturnType" defaultValue={formDefaults.otherReturnType}/>
   <Field label="Cliente / entidad" name="customerEntity" defaultValue={formDefaults.customerEntity} required={!draft} span="span-2"/>
   <Field label="País" name="country" defaultValue={formDefaults.country}/>
   <Field label="Dirección" name="address" defaultValue={formDefaults.address} span="span-2"/>
   {fromComplaintId?<><input type="hidden" name="relatedDocument" value={formDefaults.relatedDocument??""}/><label className="field span-2"><span>Documento relacionado</span><input value={formDefaults.relatedDocument??""} readOnly/><small className="muted-note">Código de la Reclamación de origen.</small></label></>:<Field label="Documento relacionado" name="relatedDocument" defaultValue={formDefaults.relatedDocument} span="span-2"/>}
   <Field label="Condiciones de conservación" name="conservationConditions" defaultValue={formDefaults.conservationConditions} span="span-2"/>
   <Field label="N.º albarán" name="deliveryNote" defaultValue={formDefaults.deliveryNote}/>
  </div></section>

  <section className="form-section"><h2>2. Producto(s) devuelto(s)</h2><p className="section-help">Añadir tantas líneas como sea necesario.</p>
   <div className="table-scroll"><table className="records-table followup-task-table"><thead><tr><th>Tipo</th><th>Producto / código</th><th>Formato</th><th>Lote</th><th>Cad./reanálisis</th><th>Cantidad</th><th>Unidad</th><th>Peso neto</th><th>Peso bruto</th><th>Recibido por</th><th>Fecha recepción firma</th><th>Verificado por</th><th>Fecha verificación</th><th>Observaciones recepción</th><th></th></tr></thead><tbody>
   {products.map((p,i)=><tr key={p.id??i}>
    <td><select value={p.productType} onChange={e=>patch(i,{productType:e.target.value as ReturnProductInput["productType"]})}><option value="API">API</option><option value="INTERMEDIATE">Intermedio</option><option value="MEDICINE">Medicamento</option><option value="SUPPLEMENT">Complemento</option><option value="IMPORTED_PRODUCT">Importado</option><option value="MEDICAL_DEVICE">Producto sanitario</option><option value="COSMETIC">Cosmético</option><option value="OTHER">Otro</option></select></td>
    <td><input value={p.productNameCode} onChange={e=>patch(i,{productNameCode:e.target.value})}/></td>
    <td><input value={p.format} onChange={e=>patch(i,{format:e.target.value})}/></td>
    <td><input value={p.lot} onChange={e=>patch(i,{lot:e.target.value})}/></td>
    <td><input value={p.expiryReanalysis} onChange={e=>patch(i,{expiryReanalysis:e.target.value})}/></td>
    <td><input value={p.quantity} onChange={e=>patch(i,{quantity:e.target.value})}/></td>
    <td><input value={p.unit} onChange={e=>patch(i,{unit:e.target.value})}/></td>
    <td><input value={p.netWeight} onChange={e=>patch(i,{netWeight:e.target.value})}/></td>
    <td><input value={p.grossWeight} onChange={e=>patch(i,{grossWeight:e.target.value})}/></td>
    <td><input value={p.receivedBy} onChange={e=>patch(i,{receivedBy:e.target.value})}/></td>
    <td><input type="date" value={p.receivedByDate} onChange={e=>patch(i,{receivedByDate:e.target.value})}/></td>
    <td><input value={p.verifiedBy} onChange={e=>patch(i,{verifiedBy:e.target.value})}/></td>
    <td><input type="date" value={p.verifiedByDate} onChange={e=>patch(i,{verifiedByDate:e.target.value})}/></td>
    <td><textarea value={p.receptionObservations} onChange={e=>patch(i,{receptionObservations:e.target.value})}/></td>
    <td><button type="button" className="button danger small" onClick={()=>setProducts(x=>x.filter((_,n)=>n!==i))}>Quitar</button></td>
   </tr>)}</tbody></table></div>
   <button type="button" className="button small" onClick={()=>setProducts(x=>[...x,{...emptyProduct}])}>+ Añadir producto</button>
  </section>

  <section className="form-section"><h2>3. Motivo y documentación</h2><div className="form-grid"><TextArea label="Observaciones o incidencias" name="reasonObservations" defaultValue={formDefaults.reasonObservations}/><TextArea label="Documentación anexada" name="attachedDocumentation" defaultValue={formDefaults.attachedDocumentation}/></div></section>

  <section className="form-section"><h2>4. Comprobaciones para posible reintegración</h2><div className="form-grid">
   <Tri label="Plazo aceptable de devolución" name="withinAcceptedReturnPeriod" defaultValue={formDefaults.withinAcceptedReturnPeriod}/>
   <Tri label="+15/+25 ºC dentro de 10 días" name="roomTemperatureWithinTenDays" defaultValue={formDefaults.roomTemperatureWithinTenDays}/>
   <Tri label="+2/+8 ºC dentro de 48 h" name="coldChainWithinFortyEightHours" defaultValue={formDefaults.coldChainWithinFortyEightHours}/>
   <Tri label="Identificador único / Data Matrix activo" name="uniqueIdentifierActive" defaultValue={formDefaults.uniqueIdentifierActive}/>
   <Tri label="Tamper Evidence intacto" name="tamperEvidenceIntact" defaultValue={formDefaults.tamperEvidenceIntact}/>
   <Tri label="Envases íntegros" name="packagingIntegrityOk" defaultValue={formDefaults.packagingIntegrityOk}/>
   <Tri label="Declaración cliente disponible" name="customerDeclarationAvailable" defaultValue={formDefaults.customerDeclarationAvailable}/>
   <Tri label="Almacenamiento/transporte conforme" name="storageTransportConditionsOk" defaultValue={formDefaults.storageTransportConditionsOk}/>
   <Tri label="Sin uso/daño/contaminación" name="noUseDamageContamination" defaultValue={formDefaults.noUseDamageContamination}/>
   <Tri label="Sin retirada/alerta/bloqueo" name="noRecallAlertBlock" defaultValue={formDefaults.noRecallAlertBlock}/>
   <Tri label="Caducidad/reanálisis aceptable" name="expiryAcceptable" defaultValue={formDefaults.expiryAcceptable}/>
   <Tri label="Evaluación Control de Calidad" name="qcAssessmentCompleted" defaultValue={formDefaults.qcAssessmentCompleted}/>
  </div></section>

  <section className="form-section"><h2>5. Productos termolábiles / temperatura controlada</h2><div className="form-grid">
   <Tri label="Registro temperatura almacenamiento" name="storageTemperatureRecord" defaultValue={formDefaults.storageTemperatureRecord}/>
   <Tri label="Evidencia temperatura transporte retorno" name="returnTransportTempEvidence" defaultValue={formDefaults.returnTransportTempEvidence}/>
   <Tri label="Embalaje de transporte conforme" name="transportPackagingSuitable" defaultValue={formDefaults.transportPackagingSuitable}/>
   <Tri label="Temperatura recepción aceptable" name="receiptTemperatureAcceptable" defaultValue={formDefaults.receiptTemperatureAcceptable}/>
   <Tri label="Excursión evaluada/documentada" name="temperatureExcursionEvaluated" defaultValue={formDefaults.temperatureExcursionEvaluated}/>
   <Tri label="Sistema devolución termolábiles validado" name="coldChainReturnSystemValidated" defaultValue={formDefaults.coldChainReturnSystemValidated}/>
  </div></section>

  <section className="form-section"><h2>6. Declaración del cliente · Anexo V</h2><p className="section-help">Datos necesarios para generar la declaración oficial de conservación del producto devuelto.</p><div className="form-grid">
   <Field label="Responsable técnico de la entidad" name="customerDeclarationSignatoryName" defaultValue={formDefaults.customerDeclarationSignatoryName} span="span-2"/>
   <Field label="Puesto / función" name="customerDeclarationSignatoryRole" defaultValue={formDefaults.customerDeclarationSignatoryRole}/>
   <Field label="Fecha de firma" name="customerDeclarationSignedAt" type="date" defaultValue={formDefaults.customerDeclarationSignedAt}/>
   <TextArea label="Observaciones de la declaración" name="customerDeclarationObservations" defaultValue={formDefaults.customerDeclarationObservations}/>
  </div></section>

  <section className="form-section"><h2>7. Decisión de Garantía de Calidad / Dirección Técnica</h2><div className="form-grid">
   <label className="field"><span>Decisión</span><select name="decision" defaultValue={formDefaults.decision??"PENDING"}><option value="PENDING">Pendiente</option><option value="ACCEPTED">Aceptada</option><option value="REJECTED">Rechazada</option></select></label>
   <Field label="Fecha decisión" name="decisionDate" type="date" defaultValue={formDefaults.decisionDate}/>
   <TextArea label="Destino final y observaciones" name="finalDestination" defaultValue={formDefaults.finalDestination}/>
   <TextArea label="Observaciones de decisión" name="decisionObservations" defaultValue={formDefaults.decisionObservations}/>
   <Field label="Aprobación Garantía de Calidad" name="qaApprovalName" defaultValue={formDefaults.qaApprovalName} span="span-2"/>
   <Field label="Aprobación Dirección Técnica" name="technicalApprovalName" defaultValue={formDefaults.technicalApprovalName} span="span-2"/>
   <Field label="Gestión destrucción" name="destructionManagedBy" defaultValue={formDefaults.destructionManagedBy}/>
   <Field label="Certificado destrucción" name="destructionCertificate" defaultValue={formDefaults.destructionCertificate} span="span-2"/>
   <Tri label="Trazabilidad actualizada" name="traceabilityUpdated" defaultValue={formDefaults.traceabilityUpdated}/>
   <Field label="Fecha cierre" name="closedAt" type="date" defaultValue={formDefaults.closedAt}/>
   <label className="field"><span>Estado</span><select name="status" value={recordStatus} onChange={e=>setRecordStatus(e.target.value as "DRAFT"|"OPEN"|"CLOSED")}>{(mode==="create"||formDefaults.status==="DRAFT")?<option value="DRAFT">Borrador</option>:null}<option value="OPEN">Abierta</option><option value="CLOSED">Cerrada</option></select><small className="muted-note">{draft?"En borrador pueden quedar campos pendientes. Al abrir se validarán los obligatorios.":"Expediente en ciclo operativo."}</small></label>
  </div></section>

  <section className="form-section"><h2>8. Control interno</h2><div className="form-grid">
   <TextArea label="Observaciones internas" name="internalObservations" defaultValue={formDefaults.internalObservations}/>
   <label className="field"><span>Documento firmado disponible</span><select name="signedDocumentAvailable" defaultValue={formDefaults.signedDocumentAvailable??""}><option value="">No informado</option><option value="true">Sí</option><option value="false">No</option></select></label>
   <label className="field"><span>Control del dato</span><select name="dataQualityStatus" defaultValue={formDefaults.dataQualityStatus??"REVIEW_REQUIRED"}><option value="COMPLETE">Completo</option><option value="INCOMPLETE">Incompleto</option><option value="REVIEW_REQUIRED">Pendiente revisar</option></select></label>
   {mode==="edit"?<TextArea label="Motivo del cambio" name="changeReason"/>:null}
  </div></section>

  <div className="form-footer"><Link className="button" href={returnId?`/returns/${returnId}`:"/returns"}>Cancelar</Link><button className="button primary" disabled={pending}>{pending?"Guardando…":draft?"Guardar borrador":mode==="create"?"Guardar devolución":"Guardar cambios"}</button></div>
 </form>;
}
