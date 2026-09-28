"use client";
import Link from "next/link";
import { useActionState,useState } from "react";
import type { DepartmentOption,ReturnFormDefaults,ReturnFormState,ReturnProductInput } from "@/modules/returns/types";
const initial:ReturnFormState={error:null};
const emptyProduct:ReturnProductInput={departmentId:"",productType:"API",otherProductType:"",productNameCode:"",format:"",lot:"",expiryReanalysis:"",quantity:"",unit:"",netWeight:"",grossWeight:"",receptionObservations:"",receivedBy:"",verifiedBy:""};

function Field({label,name,defaultValue,type="text",required=false,span=""}:{label:string;name:string;defaultValue?:string;type?:string;required?:boolean;span?:string}){return <label className={`field ${span}`}><span>{label}{required?" *":""}</span><input name={name} type={type} defaultValue={defaultValue??""} required={required}/></label>;}
function TextArea({label,name,defaultValue}:{label:string;name:string;defaultValue?:string}){return <label className="field full"><span>{label}</span><textarea name={name} defaultValue={defaultValue??""}/></label>;}
function Tri({label,name,defaultValue}:{label:string;name:string;defaultValue?:string}){return <label className="field"><span>{label}</span><select name={name} defaultValue={defaultValue??""}><option value="">No informado</option><option value="YES">Sí</option><option value="NO">No</option><option value="NA">N/A</option></select></label>;}

export function ReturnForm({mode,action,departments,defaults={},returnId,fromComplaintId}:{mode:"create"|"edit";action:(s:ReturnFormState,fd:FormData)=>Promise<ReturnFormState>;departments:DepartmentOption[];defaults?:ReturnFormDefaults;returnId?:string;fromComplaintId?:string}){
 const [state,formAction,pending]=useActionState(action,initial);const [products,setProducts]=useState(defaults.products?.length?defaults.products:[{...emptyProduct}]);
 const patch=(i:number,p:Partial<ReturnProductInput>)=>setProducts(x=>x.map((v,n)=>n===i?{...v,...p}:v));
 return <form action={formAction} className="form-stack">
  <input type="hidden" name="productsJson" value={JSON.stringify(products)}/>{fromComplaintId?<input type="hidden" name="fromComplaintId" value={fromComplaintId}/>:null}
  {state.error?<div className="form-errors"><strong>{state.error}</strong>{state.fieldErrors?.length?<ul>{state.fieldErrors.map(x=><li key={x}>{x}</li>)}</ul>:null}</div>:null}
  <section className="form-section"><h2>1. Datos generales de la devolución</h2><div className="form-grid">
   <Field label="N.º devolución" name="businessCode" defaultValue={defaults.businessCode} required/>
   <label className="field"><span>Almacén / área *</span><select name="departmentId" defaultValue={defaults.departmentId??""} required><option value="">Seleccionar…</option>{departments.map(d=><option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}</select></label>
   <Field label="Fecha comunicación" name="communicationDate" type="date" defaultValue={defaults.communicationDate} required/>
   <Field label="Fecha recepción" name="receivedAt" type="date" defaultValue={defaults.receivedAt}/>
   <Field label="Cumplimentado por" name="createdByText" defaultValue={defaults.createdByText} required/>
   {mode==="edit"?<Field label="Modificado por" name="modifiedByText" defaultValue={defaults.createdByText}/>:null}
   <label className="field"><span>Tipo *</span><select name="returnType" defaultValue={defaults.returnType??""} required><option value="">Seleccionar…</option><option value="COMMERCIAL">Comercial</option><option value="COMPLAINT">Reclamación</option><option value="RECALL">Retirada</option><option value="EXPIRY">Caducidad</option><option value="TRANSPORT">Transporte</option><option value="OTHER">Otra</option></select></label>
   <Field label="Otra · especificar" name="otherReturnType" defaultValue={defaults.otherReturnType}/>
   <Field label="Cliente / entidad" name="customerEntity" defaultValue={defaults.customerEntity} required span="span-2"/>
   <Field label="País" name="country" defaultValue={defaults.country}/>
   <Field label="Dirección" name="address" defaultValue={defaults.address} span="span-2"/>
   <Field label="Documento relacionado" name="relatedDocument" defaultValue={defaults.relatedDocument} span="span-2"/>
   <Field label="Condiciones de conservación" name="conservationConditions" defaultValue={defaults.conservationConditions} span="span-2"/>
   <Field label="N.º albarán" name="deliveryNote" defaultValue={defaults.deliveryNote}/>
  </div></section>

  <section className="form-section"><h2>2. Producto(s) devuelto(s)</h2><p className="section-help">Añadir tantas líneas como sea necesario.</p>
   <div className="table-scroll"><table className="records-table followup-task-table"><thead><tr><th>Tipo</th><th>Producto / código</th><th>Formato</th><th>Lote</th><th>Cad./reanálisis</th><th>Cantidad</th><th>Unidad</th><th>Peso neto</th><th>Peso bruto</th><th>Recibido por</th><th>Verificado por</th><th>Observaciones recepción</th><th></th></tr></thead><tbody>
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
    <td><input value={p.verifiedBy} onChange={e=>patch(i,{verifiedBy:e.target.value})}/></td>
    <td><textarea value={p.receptionObservations} onChange={e=>patch(i,{receptionObservations:e.target.value})}/></td>
    <td><button type="button" className="button danger small" onClick={()=>setProducts(x=>x.filter((_,n)=>n!==i))}>Quitar</button></td>
   </tr>)}</tbody></table></div>
   <button type="button" className="button small" onClick={()=>setProducts(x=>[...x,{...emptyProduct}])}>+ Añadir producto</button>
  </section>

  <section className="form-section"><h2>3. Motivo y documentación</h2><div className="form-grid"><TextArea label="Observaciones o incidencias" name="reasonObservations" defaultValue={defaults.reasonObservations}/><TextArea label="Documentación anexada" name="attachedDocumentation" defaultValue={defaults.attachedDocumentation}/></div></section>

  <section className="form-section"><h2>4. Comprobaciones para posible reintegración</h2><div className="form-grid">
   <Tri label="Plazo aceptable de devolución" name="withinAcceptedReturnPeriod" defaultValue={defaults.withinAcceptedReturnPeriod}/>
   <Tri label="+15/+25 ºC dentro de 10 días" name="roomTemperatureWithinTenDays" defaultValue={defaults.roomTemperatureWithinTenDays}/>
   <Tri label="+2/+8 ºC dentro de 48 h" name="coldChainWithinFortyEightHours" defaultValue={defaults.coldChainWithinFortyEightHours}/>
   <Tri label="Identificador único / Data Matrix activo" name="uniqueIdentifierActive" defaultValue={defaults.uniqueIdentifierActive}/>
   <Tri label="Tamper Evidence intacto" name="tamperEvidenceIntact" defaultValue={defaults.tamperEvidenceIntact}/>
   <Tri label="Envases íntegros" name="packagingIntegrityOk" defaultValue={defaults.packagingIntegrityOk}/>
   <Tri label="Declaración cliente disponible" name="customerDeclarationAvailable" defaultValue={defaults.customerDeclarationAvailable}/>
   <Tri label="Almacenamiento/transporte conforme" name="storageTransportConditionsOk" defaultValue={defaults.storageTransportConditionsOk}/>
   <Tri label="Sin uso/daño/contaminación" name="noUseDamageContamination" defaultValue={defaults.noUseDamageContamination}/>
   <Tri label="Sin retirada/alerta/bloqueo" name="noRecallAlertBlock" defaultValue={defaults.noRecallAlertBlock}/>
   <Tri label="Caducidad/reanálisis aceptable" name="expiryAcceptable" defaultValue={defaults.expiryAcceptable}/>
   <Tri label="Evaluación Control de Calidad" name="qcAssessmentCompleted" defaultValue={defaults.qcAssessmentCompleted}/>
  </div></section>

  <section className="form-section"><h2>5. Productos termolábiles / temperatura controlada</h2><div className="form-grid">
   <Tri label="Registro temperatura almacenamiento" name="storageTemperatureRecord" defaultValue={defaults.storageTemperatureRecord}/>
   <Tri label="Evidencia temperatura transporte retorno" name="returnTransportTempEvidence" defaultValue={defaults.returnTransportTempEvidence}/>
   <Tri label="Embalaje de transporte conforme" name="transportPackagingSuitable" defaultValue={defaults.transportPackagingSuitable}/>
   <Tri label="Temperatura recepción aceptable" name="receiptTemperatureAcceptable" defaultValue={defaults.receiptTemperatureAcceptable}/>
   <Tri label="Excursión evaluada/documentada" name="temperatureExcursionEvaluated" defaultValue={defaults.temperatureExcursionEvaluated}/>
   <Tri label="Sistema devolución termolábiles validado" name="coldChainReturnSystemValidated" defaultValue={defaults.coldChainReturnSystemValidated}/>
  </div></section>

  <section className="form-section"><h2>6. Declaración del cliente · Anexo V</h2><p className="section-help">Datos que se trasladarán a la Declaración del Cliente sobre Conservación de Producto Devuelto.</p><div className="form-grid">
   <Field label="Nombre del declarante" name="customerDeclarationSignatory" defaultValue={defaults.customerDeclarationSignatory} span="span-2"/>
   <Field label="Cargo / calidad en que declara" name="customerDeclarationRole" defaultValue={defaults.customerDeclarationRole} span="span-2"/>
   <Field label="Fecha de declaración" name="customerDeclarationSignedAt" type="date" defaultValue={defaults.customerDeclarationSignedAt}/>
   <TextArea label="Observaciones / incidencias declaradas por el cliente" name="customerDeclarationObservations" defaultValue={defaults.customerDeclarationObservations}/>
  </div></section>

  <section className="form-section"><h2>7. Decisión de Garantía de Calidad / Dirección Técnica</h2><div className="form-grid">
   <label className="field"><span>Decisión</span><select name="decision" defaultValue={defaults.decision??"PENDING"}><option value="PENDING">Pendiente</option><option value="ACCEPTED">Aceptada</option><option value="REJECTED">Rechazada</option></select></label>
   <Field label="Fecha decisión" name="decisionDate" type="date" defaultValue={defaults.decisionDate}/>
   <TextArea label="Destino final y observaciones" name="finalDestination" defaultValue={defaults.finalDestination}/>
   <TextArea label="Observaciones de decisión" name="decisionObservations" defaultValue={defaults.decisionObservations}/>
   <Field label="Aprobación Garantía de Calidad" name="qaApprovalName" defaultValue={defaults.qaApprovalName} span="span-2"/>
   <Field label="Aprobación Dirección Técnica" name="technicalApprovalName" defaultValue={defaults.technicalApprovalName} span="span-2"/>
   <Field label="Gestión destrucción" name="destructionManagedBy" defaultValue={defaults.destructionManagedBy}/>
   <Field label="Certificado destrucción" name="destructionCertificate" defaultValue={defaults.destructionCertificate} span="span-2"/>
   <Tri label="Trazabilidad actualizada" name="traceabilityUpdated" defaultValue={defaults.traceabilityUpdated}/>
   <Field label="Fecha cierre" name="closedAt" type="date" defaultValue={defaults.closedAt}/>
   <label className="field"><span>Estado</span><select name="status" defaultValue={defaults.status??"OPEN"}><option value="OPEN">Abierta</option><option value="CLOSED">Cerrada</option></select></label>
  </div></section>

  <section className="form-section"><h2>8. Control interno</h2><div className="form-grid">
   <TextArea label="Observaciones internas" name="internalObservations" defaultValue={defaults.internalObservations}/>
   <label className="field"><span>Documento firmado disponible</span><select name="signedDocumentAvailable" defaultValue={defaults.signedDocumentAvailable??""}><option value="">No informado</option><option value="true">Sí</option><option value="false">No</option></select></label>
   <label className="field"><span>Control del dato</span><select name="dataQualityStatus" defaultValue={defaults.dataQualityStatus??"REVIEW_REQUIRED"}><option value="COMPLETE">Completo</option><option value="INCOMPLETE">Incompleto</option><option value="REVIEW_REQUIRED">Pendiente revisar</option></select></label>
   {mode==="edit"?<TextArea label="Motivo del cambio" name="changeReason"/>:null}
  </div></section>

  <div className="form-footer"><Link className="button" href={returnId?`/returns/${returnId}`:"/returns"}>Cancelar</Link><button className="button primary" disabled={pending}>{pending?"Guardando…":mode==="create"?"Guardar devolución":"Guardar cambios"}</button></div>
 </form>;
}
