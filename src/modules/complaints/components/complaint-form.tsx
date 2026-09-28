"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type {
  ComplaintCapaPlanInput,
  ComplaintDerivedActionInput,
  ComplaintFormDefaults,
  ComplaintFormState,
  DepartmentOption,
} from "@/modules/complaints/types";

const initial: ComplaintFormState = { error: null };
const emptyCapa: ComplaintCapaPlanInput = {
  actionType: "CORRECTIVE",
  description: "",
  plannedExecutionDate: "",
  responsible: "",
  businessCapaCode: "",
};
const emptyDerived: ComplaintDerivedActionInput = {
  typeCode: "",
  actionEvidence: "",
  responsible: "",
  plannedDate: "",
};

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
  span = "",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  span?: string;
}) {
  return (
    <label className={`field ${span}`}>
      <span>{label}{required ? " *" : ""}</span>
      <input name={name} type={type} defaultValue={defaultValue ?? ""} required={required} />
    </label>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
  help,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  help?: string;
}) {
  return (
    <label className="field full">
      <span>{label}</span>
      {help ? <small className="muted-note">{help}</small> : null}
      <textarea name={name} defaultValue={defaultValue ?? ""} />
    </label>
  );
}

function Bool({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} defaultValue={defaultValue ?? ""}>
        <option value="">No informado</option>
        <option value="true">Sí</option>
        <option value="false">No</option>
      </select>
    </label>
  );
}

function Tri({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} defaultValue={defaultValue ?? ""}>
        <option value="">No informado</option>
        <option value="YES">Sí</option>
        <option value="NO">No</option>
        <option value="NA">N/A</option>
      </select>
    </label>
  );
}

function Checks({
  label,
  name,
  options,
  selected,
}: {
  label: string;
  name: string;
  options: readonly (readonly [string, string])[];
  selected?: string[];
}) {
  return (
    <div className="field full">
      <span>{label}</span>
      <div className="checkbox-group">
        {options.map(([value, text]) => (
          <label key={value}>
            <input type="checkbox" name={name} value={value} defaultChecked={selected?.includes(value)} />
            {text}
          </label>
        ))}
      </div>
    </div>
  );
}

const detectionSourceOptions = [
  ["CLIENT", "Cliente"],
  ["DISTRIBUTOR", "Distribuidor"],
  ["MAH", "Titular / MAH"],
  ["CONSUMER", "Consumidor / usuario"],
  ["AUTHORITY", "Autoridad / entidad sanitaria"],
  ["SUPPLIER", "Proveedor"],
  ["LOGISTICS", "Transportista / operador logístico"],
  ["SUBCONTRACTOR", "Subcontrata"],
  ["INTERNAL", "Detección interna"],
  ["RECALL", "Retirada"],
  ["OTHER", "Otro"],
] as const;

const scopeOptions = [
  ["MEDICINE", "Medicamento"],
  ["API", "API"],
  ["SUPPLEMENT", "Complemento alimenticio"],
  ["COSMETIC", "Cosmética"],
  ["MEDICAL_DEVICE", "Producto sanitario"],
  ["ENVIRONMENT", "Medio ambiente"],
  ["OTHER", "Otro"],
] as const;

const objectOptions = [
  ["PRODUCT_MATERIAL", "Producto / material"],
  ["SERVICE", "Servicio"],
  ["EQUIPMENT_SYSTEM", "Equipo / sistema"],
  ["TRANSPORT", "Transporte"],
  ["SUBCONTRACTED_ACTIVITY", "Actividad subcontratada"],
  ["OTHER", "Otro"],
] as const;

const categoryOptions = [
  ["PRODUCT_QUALITY", "Calidad del producto"],
  ["SPECIFICATIONS_ANALYSIS", "Especificaciones / análisis"],
  ["PACKAGING_CONTAINER", "Acondicionamiento / envase"],
  ["LABEL_DOCUMENTATION", "Etiquetado / documentación"],
  ["QUANTITY_CONTENT", "Cantidad / contenido"],
  ["TRANSPORT_STORAGE", "Transporte / almacenamiento"],
  ["SERVICE_SUPPLY", "Servicio / suministro"],
  ["EQUIPMENT_SYSTEM", "Equipo / sistema"],
  ["ENVIRONMENT", "Medio ambiente"],
  ["OTHER", "Otro"],
] as const;

const containmentOptions = [
  ["BLOCK_QUARANTINE", "Bloqueo / cuarentena"],
  ["SUSPEND_USE_DISTRIBUTION", "Suspender uso / distribución"],
  ["NOTIFY_STAKEHOLDERS", "Aviso a cliente / proveedor / titular / autoridad"],
  ["NONE", "Ninguna"],
  ["OTHER", "Otra"],
] as const;

const resolutionOptions = [
  ["RETURN", "Devolución"],
  ["CORRECTIVE_ACTION", "Acc. correctora"],
  ["PREVENTIVE_ACTION", "Acc. preventiva"],
  ["IMMEDIATE_ACTION", "Acc. inmediata"],
  ["RECALL", "Retirada del mercado"],
  ["CREDIT", "Abono"],
  ["REPLACEMENT", "Reposición"],
  ["REJECT", "Rechazo"],
  ["REPROCESS", "Reproceso"],
  ["DISPOSE", "Eliminación"],
  ["KEEP_AS_IS", "Mantener situación"],
  ["SUPPLIER_INVESTIGATION", "Investigación proveedor"],
  ["SUPPLIER_EVALUATION", "Evaluación proveedor"],
  ["OPEN_DEVIATION", "Abrir desviación"],
  ["OPEN_CAPA", "Abrir CAPA"],
  ["OPEN_CHANGE", "Abrir cambio"],
  ["OTHER", "Otros"],
] as const;

export function ComplaintForm({
  mode,
  action,
  departments,
  defaults = {},
  complaintId,
}: {
  mode: "create" | "edit";
  action: (s: ComplaintFormState, fd: FormData) => Promise<ComplaintFormState>;
  departments: DepartmentOption[];
  defaults?: ComplaintFormDefaults;
  complaintId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [capas, setCapas] = useState<ComplaintCapaPlanInput[]>(defaults.capaPlans ?? []);
  const [derivedActions, setDerivedActions] = useState<ComplaintDerivedActionInput[]>(
    defaults.derivedActions ?? [],
  );

  const patchCapa = (i: number, p: Partial<ComplaintCapaPlanInput>) =>
    setCapas((x) => x.map((v, n) => (n === i ? { ...v, ...p } : v)));
  const patchDerived = (i: number, p: Partial<ComplaintDerivedActionInput>) =>
    setDerivedActions((x) => x.map((v, n) => (n === i ? { ...v, ...p } : v)));

  return (
    <form action={formAction} className="form-stack">
      <input type="hidden" name="capaPlansJson" value={JSON.stringify(capas)} />
      <input type="hidden" name="derivedActionsJson" value={JSON.stringify(derivedActions)} />

      {state.error ? (
        <div className="form-errors">
          <strong>{state.error}</strong>
          {state.fieldErrors?.length ? <ul>{state.fieldErrors.map((x) => <li key={x}>{x}</li>)}</ul> : null}
        </div>
      ) : null}

      <section className="form-section">
        <h2>1. Registro e identificación · Parte I</h2>
        <p className="section-help">Estructura preparada para el futuro GC-00/027/03 y su Anexo III.</p>
        <div className="form-grid">
          <Field label="N.º reclamación" name="businessCode" defaultValue={defaults.businessCode} required />
          <label className="field">
            <span>Departamento *</span>
            <select name="departmentId" defaultValue={defaults.departmentId ?? ""} required>
              <option value="">Seleccionar…</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
            </select>
          </label>
          <Field label="Fecha apertura" name="openedAt" type="date" defaultValue={defaults.openedAt} required />
          <Field label="Fecha detección" name="detectionDate" type="date" defaultValue={defaults.detectionDate} />
          <Field label="Fecha recepción" name="receivedAt" type="date" defaultValue={defaults.receivedAt} />
          <Field label="Detectado por" name="detectedBy" defaultValue={defaults.detectedBy} />
          <Field label="Cumplimentado por" name="createdByText" defaultValue={defaults.createdByText} required />
          {mode === "edit" ? <Field label="Modificado por" name="modifiedByText" defaultValue={defaults.createdByText} /> : null}
          <label className="field">
            <span>Tipo *</span>
            <select name="complaintType" defaultValue={defaults.complaintType ?? ""} required>
              <option value="">Seleccionar…</option>
              <option value="PROVIDER">A proveedor / subcontrata</option>
              <option value="CUSTOMER">De cliente / agente externo</option>
            </select>
          </label>
          <Field label="Cliente / proveedor / entidad" name="partyName" defaultValue={defaults.partyName} required span="span-2" />
          <Field label="Contacto" name="contact" defaultValue={defaults.contact} span="span-2" />
          <Checks label="Origen / fuente de detección" name="detectionSources" options={detectionSourceOptions} selected={defaults.detectionSources} />
          <Field label="Otro origen · especificar" name="otherDetectionSource" defaultValue={defaults.otherDetectionSource} span="span-2" />
          <Checks label="Ámbito" name="scopeCategories" options={scopeOptions} selected={defaults.scopeCategories} />
          <Field label="Otro ámbito · especificar" name="otherScopeCategory" defaultValue={defaults.otherScopeCategory} span="span-2" />
          <Checks label="Objeto afectado" name="affectedObjects" options={objectOptions} selected={defaults.affectedObjects} />
          <Field label="Otro objeto · especificar" name="otherAffectedObject" defaultValue={defaults.otherAffectedObject} span="span-2" />
          <Field label="Ámbito afectado · texto complementario" name="affectedScope" defaultValue={defaults.affectedScope} span="span-2" />
          <Field label="Referencia material / servicio / equipo" name="reference" defaultValue={defaults.reference} span="span-2" />
          <Field label="Lote / referencia" name="lotReference" defaultValue={defaults.lotReference} />
          <Field label="Cantidad" name="quantity" defaultValue={defaults.quantity} />
          <Field label="Caducidad / reanálisis" name="expiryReanalysis" defaultValue={defaults.expiryReanalysis} />
          <Field label="Pedido / albarán / certificado" name="purchaseDeliveryReference" defaultValue={defaults.purchaseDeliveryReference} span="span-2" />
          <Checks label="Categoría / motivo" name="complaintCategories" options={categoryOptions} selected={defaults.complaintCategories} />
          <Field label="Otra categoría · especificar" name="otherComplaintCategory" defaultValue={defaults.otherComplaintCategory} span="span-2" />
          <TextArea label="Descripción de la reclamación *" name="description" defaultValue={defaults.description} />
          <Bool label="¿Reclamación recurrente?" name="recurrent" defaultValue={defaults.recurrent} />
          <Field label="Referencia recurrencia" name="recurrenceReference" defaultValue={defaults.recurrenceReference} span="span-2" />
          <TextArea label="Evidencias / documentación adjunta" name="attachedDocumentation" defaultValue={defaults.attachedDocumentation} />
          <Field label="Emitido por" name="emittedBy" defaultValue={defaults.emittedBy} />
          <Field label="Validado por Garantía de Calidad" name="qaValidatedBy" defaultValue={defaults.qaValidatedBy} span="span-2" />
        </div>
      </section>

      <section className="form-section">
        <h2>2. Evaluación inicial, contención, investigación e impacto</h2>
        <div className="form-grid">
          <Bool label="Impacto calidad / cumplimiento GMP" name="impactQualityGmp" defaultValue={defaults.impactQualityGmp} />
          <Bool label="Impacto seguridad / eficacia / paciente o usuario" name="impactSafetyEfficacy" defaultValue={defaults.impactSafetyEfficacy} />
          <Bool label="Impacto regulatorio" name="impactRegulatory" defaultValue={defaults.impactRegulatory} />
          <Bool label="Impacto medio ambiente" name="impactEnvironment" defaultValue={defaults.impactEnvironment} />
          <Bool label="Impacto otros lotes/productos/clientes/similares" name="impactOtherSimilar" defaultValue={defaults.impactOtherSimilar} />
          <Checks label="Medidas inmediatas / contención" name="containmentActions" options={containmentOptions} selected={defaults.containmentActions} />
          <Field label="Otra medida de contención" name="otherContainmentAction" defaultValue={defaults.otherContainmentAction} span="span-2" />
          <TextArea label="Justificación de riesgo, alcance y medidas" name="containmentJustification" defaultValue={defaults.containmentJustification} help="Incluir estado, responsable, fecha y referencia cuando aplique." />
          <TextArea label="Investigación, evidencias y alcance" name="investigation" defaultValue={defaults.investigation} />
          <TextArea label="Evaluación global del impacto" name="impactAssessment" defaultValue={defaults.impactAssessment} />
          <label className="field">
            <span>Resultado investigación</span>
            <select name="investigationResult" defaultValue={defaults.investigationResult ?? ""}>
              <option value="">Pendiente</option>
              <option value="PROCEDENT">Procedente</option>
              <option value="NOT_PROCEDENT">No procedente</option>
              <option value="INCONCLUSIVE">No concluyente</option>
              <option value="NOT_ATTRIBUTABLE_TO_COVEX">No atribuible a COVEX</option>
            </select>
          </label>
          <TextArea label="Análisis de causa raíz" name="rootCause" defaultValue={defaults.rootCause} />
        </div>
      </section>

      <section className="form-section">
        <h2>3. Clasificación y evaluación regulatoria</h2>
        <div className="form-grid">
          <label className="field">
            <span>Clasificación</span>
            <select name="classification" defaultValue={defaults.classification ?? ""}>
              <option value="">Pendiente</option>
              <option value="CRITICAL">Crítica</option>
              <option value="MAJOR">Mayor</option>
              <option value="MINOR">Menor</option>
              <option value="NO_GMP_IMPACT">Sin impacto GMP</option>
            </select>
          </label>
          <Field label="Fecha evaluación inicial" name="initialEvaluationDate" type="date" defaultValue={defaults.initialEvaluationDate} />
          <Field label="Fecha conclusión inicial" name="initialConclusionDate" type="date" defaultValue={defaults.initialConclusionDate} />
          <Tri label="¿Puede requerir retirada de producto?" name="recallPotential" defaultValue={defaults.recallPotential} />
          <Tri label="¿Requiere activar GC-00/029?" name="recallProcedureRequired" defaultValue={defaults.recallProcedureRequired} />
          <Tri label="¿Requiere notificación a autoridad sanitaria?" name="authorityNotificationRequired" defaultValue={defaults.authorityNotificationRequired} />
          <Tri label="¿Requiere comunicación al titular / cliente responsable?" name="responsibleClientCommunicationRequired" defaultValue={defaults.responsibleClientCommunicationRequired} />
          <TextArea label="Justificación de la evaluación regulatoria" name="regulatoryJustification" defaultValue={defaults.regulatoryJustification} />
        </div>
      </section>

      <section className="form-section">
        <h2>4. Líneas de actuación, resolución y acciones derivadas</h2>
        <div className="form-grid">
          <TextArea label="Líneas de actuación y resolución" name="resolutionLines" defaultValue={defaults.resolutionLines} />
          <Checks label="Implicación de la resolución" name="resolutionActions" options={resolutionOptions} selected={defaults.resolutionActions} />
          <TextArea label="Acción inmediata · detalle" name="immediateActionDetails" defaultValue={defaults.immediateActionDetails} />
          <TextArea label="Otros · detalle" name="otherResolutionDetails" defaultValue={defaults.otherResolutionDetails} />
        </div>

        <h3>Acciones y registros vinculados</h3>
        <p className="section-help">Corresponde a la tabla del Anexo III: tipo/código, acción o evidencia, responsable y fecha prevista.</p>
        <div className="dynamic-list">
          {derivedActions.map((x, i) => (
            <div className="dynamic-row capa" key={x.id ?? i}>
              <label className="field"><span>Tipo / código</span><input value={x.typeCode} onChange={(e) => patchDerived(i, { typeCode: e.target.value })} /></label>
              <label className="field"><span>Acción / evidencia</span><input value={x.actionEvidence} onChange={(e) => patchDerived(i, { actionEvidence: e.target.value })} /></label>
              <label className="field"><span>Responsable</span><input value={x.responsible} onChange={(e) => patchDerived(i, { responsible: e.target.value })} /></label>
              <label className="field"><span>Fecha prevista</span><input type="date" value={x.plannedDate} onChange={(e) => patchDerived(i, { plannedDate: e.target.value })} /></label>
              <button className="button danger small" type="button" onClick={() => setDerivedActions((a) => a.filter((_, n) => n !== i))}>Quitar</button>
            </div>
          ))}
          <div><button className="button small" type="button" onClick={() => setDerivedActions((x) => [...x, { ...emptyDerived }])}>+ Añadir acción / registro</button></div>
        </div>

        <h3>CAPA propuestas / asociadas</h3>
        <div className="dynamic-list">
          {capas.map((x, i) => (
            <div className="dynamic-row capa" key={x.id ?? i}>
              <label className="field"><span>Tipo</span><select value={x.actionType} onChange={(e) => patchCapa(i, { actionType: e.target.value as ComplaintCapaPlanInput["actionType"] })}><option value="CORRECTIVE">Correctiva</option><option value="PREVENTIVE">Preventiva</option></select></label>
              <label className="field"><span>Descripción</span><input value={x.description} onChange={(e) => patchCapa(i, { description: e.target.value })} /></label>
              <label className="field"><span>Fecha prevista</span><input type="date" value={x.plannedExecutionDate} onChange={(e) => patchCapa(i, { plannedExecutionDate: e.target.value })} /></label>
              <label className="field"><span>Responsable</span><input value={x.responsible} onChange={(e) => patchCapa(i, { responsible: e.target.value })} /></label>
              <label className="field"><span>Código CAPA</span><input value={x.businessCapaCode ?? ""} onChange={(e) => patchCapa(i, { businessCapaCode: e.target.value })} /></label>
              <button className="button danger small" type="button" onClick={() => setCapas((a) => a.filter((_, n) => n !== i))}>Quitar</button>
            </div>
          ))}
          <div><button className="button small" type="button" onClick={() => setCapas((x) => [...x, { ...emptyCapa }])}>+ Añadir CAPA</button></div>
        </div>
      </section>

      <section className="form-section">
        <h2>5. Comunicación y conclusión de Parte I</h2>
        <div className="form-grid">
          <Field label="Fecha comunicación" name="communicationDate" type="date" defaultValue={defaults.communicationDate} />
          <Field label="Medio" name="communicationMedium" defaultValue={defaults.communicationMedium} />
          <Field label="Emisor / destinatario" name="communicationSenderRecipient" defaultValue={defaults.communicationSenderRecipient} span="span-2" />
          <TextArea label="Resumen de lo comunicado o solicitado" name="communicationSummary" defaultValue={defaults.communicationSummary} />
          <TextArea label="Comunicación complementaria" name="externalCommunication" defaultValue={defaults.externalCommunication} />
          <TextArea label="Conclusión, pendientes y justificación" name="conclusion" defaultValue={defaults.conclusion} />
          <Bool label="¿Continúa en Parte II?" name="continueToPartII" defaultValue={defaults.continueToPartII} />
          <Bool label="¿Verificación de eficacia necesaria?" name="effectivenessRequired" defaultValue={defaults.effectivenessRequired} />
          <Field label="Evaluado / aprobado por" name="approvalNames" defaultValue={defaults.approvalNames} span="span-2" />
        </div>
      </section>

      <section className="form-section">
        <h2>6. Parte II · Seguimiento y cierre</h2>
        <p className="section-help">La respuesta formal a cliente/proveedor no se genera desde la app; aquí se registra su recepción/resumen para el seguimiento y cierre.</p>
        <div className="form-grid">
          <Field label="Fecha respuesta" name="responseDate" type="date" defaultValue={defaults.responseDate} />
          <Field label="Medio de respuesta" name="responseMedium" defaultValue={defaults.responseMedium} span="span-2" />
          <TextArea label="Resumen de la respuesta / compromisos" name="responseSummary" defaultValue={defaults.responseSummary} />
          <Bool label="¿Respuesta suficiente?" name="responseSufficient" defaultValue={defaults.responseSufficient} />
          <label className="field">
            <span>Verificación de eficacia</span>
            <select name="effectivenessStatus" defaultValue={defaults.effectivenessStatus ?? "PENDING"}>
              <option value="PENDING">Pendiente</option>
              <option value="ACCEPTABLE">Conforme / aceptable</option>
              <option value="NOT_ACCEPTABLE">No conforme / no aceptable</option>
              <option value="NOT_REQUIRED">N/A / no requerida</option>
            </select>
          </label>
          <TextArea label="Valoración de eficacia" name="effectivenessAssessment" defaultValue={defaults.effectivenessAssessment} />
          <label className="field">
            <span>Estado de las acciones</span>
            <select name="closureActionStatus" defaultValue={defaults.closureActionStatus ?? ""}>
              <option value="">No informado</option>
              <option value="COMPLETED">Completadas</option>
              <option value="LINKED">Vinculadas a seguimiento independiente</option>
              <option value="PENDING">Pendientes</option>
            </select>
          </label>
          <Field label="Referencias de seguimiento" name="closureActionReferences" defaultValue={defaults.closureActionReferences} span="span-2" />
          <Field label="Responsable del seguimiento" name="closureActionResponsible" defaultValue={defaults.closureActionResponsible} span="span-2" />
          <TextArea label="Conclusión y cierre" name="closeConclusion" defaultValue={defaults.closeConclusion} />
          <Field label="Aprobaciones del cierre" name="closeApprovalNames" defaultValue={defaults.closeApprovalNames} span="span-2" />
          <Field label="Fecha cierre" name="closedAt" type="date" defaultValue={defaults.closedAt} />
          <label className="field">
            <span>Estado final</span>
            <select name="status" defaultValue={defaults.status ?? "OPEN"}>
              <option value="OPEN">Abierta / en seguimiento</option>
              <option value="CLOSED">Cerrada</option>
            </select>
          </label>
        </div>
      </section>

      <section className="form-section">
        <h2>7. Control interno</h2>
        <div className="form-grid">
          <TextArea label="Observaciones internas" name="internalObservations" defaultValue={defaults.internalObservations} />
          <label className="field">
            <span>Documento firmado disponible</span>
            <select name="signedDocumentAvailable" defaultValue={defaults.signedDocumentAvailable ?? ""}>
              <option value="">No informado</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </label>
          <label className="field">
            <span>Control del dato</span>
            <select name="dataQualityStatus" defaultValue={defaults.dataQualityStatus ?? "REVIEW_REQUIRED"}>
              <option value="COMPLETE">Completo</option>
              <option value="INCOMPLETE">Incompleto</option>
              <option value="REVIEW_REQUIRED">Pendiente revisar</option>
            </select>
          </label>
          {mode === "edit" ? <TextArea label="Motivo del cambio" name="changeReason" /> : null}
        </div>
      </section>

      <div className="form-footer">
        <Link className="button" href={complaintId ? `/complaints/${complaintId}` : "/complaints"}>Cancelar</Link>
        <button className="button primary" disabled={pending}>
          {pending ? "Guardando…" : mode === "create" ? "Guardar reclamación" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
