"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type {
  CapaPlanInput,
  DepartmentOption,
  DeviationFormDefaults,
  FormState,
  ImmediateActionInput,
} from "@/modules/deviations/types";

type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

const emptyAction: ImmediateActionInput = { description: "", executedBy: "", executedAt: "" };
const emptyCapa: CapaPlanInput = {
  actionType: "CORRECTIVE",
  description: "",
  plannedExecutionDate: "",
  responsible: "",
};

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  span = "",
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  span?: string;
  required?: boolean;
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

function TriStateSelect({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
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

export function DeviationForm({
  action,
  departments,
  defaults = {},
  mode,
  deviationId,
}: {
  action: FormAction;
  departments: DepartmentOption[];
  defaults?: DeviationFormDefaults;
  mode: "create" | "edit";
  deviationId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [actions, setActions] = useState<ImmediateActionInput[]>(defaults.immediateActions ?? []);
  const [capas, setCapas] = useState<CapaPlanInput[]>(defaults.capaPlans ?? []);

  function updateAction(index: number, patch: Partial<ImmediateActionInput>) {
    setActions((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function updateCapa(index: number, patch: Partial<CapaPlanInput>) {
    setCapas((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  return (
    <form action={formAction} className="form-stack">
      <input type="hidden" name="immediateActionsJson" value={JSON.stringify(actions)} />
      <input type="hidden" name="capaPlansJson" value={JSON.stringify(capas)} />

      {state.error ? (
        <div className="form-errors">
          <strong>{state.error}</strong>
          {state.fieldErrors?.length ? (
            <ul>{state.fieldErrors.map((error) => <li key={error}>{error}</li>)}</ul>
          ) : null}
        </div>
      ) : null}

      <section className="form-section">
        <h2>1. Identificación y origen</h2>
        <p className="section-help">Datos que identifican el expediente y el contexto en el que se detectó el evento.</p>
        <div className="form-grid">
          <Field label="Codificación" name="businessCode" defaultValue={defaults.businessCode} required />
          <label className="field">
            <span>Departamento *</span>
            <select name="departmentId" defaultValue={defaults.departmentId ?? ""} required>
              <option value="">Seleccionar…</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.code} — {department.name}
                </option>
              ))}
            </select>
          </label>
          <Field label="Fecha apertura" name="issueDate" type="date" defaultValue={defaults.issueDate} required />
          <Field label="Fecha/hora del evento" name="eventDateTime" type="datetime-local" defaultValue={defaults.eventDateTime} />
          <Field label="Detectado por" name="detectedBy" defaultValue={defaults.detectedBy} />
          <Field label="Cumplimentado por" name="createdByText" defaultValue={defaults.createdByText} required />
          {mode === "edit" ? (
            <Field label="Modificado por" name="modifiedByText" defaultValue={defaults.createdByText} />
          ) : null}
          <Field label="Material / proceso afectado" name="materialProcessAffected" defaultValue={defaults.materialProcessAffected} span="span-2" />
          <Field label="Procedencia" name="provenance" defaultValue={defaults.provenance} span="span-2" />
          <Field label="Proceso / equipo / sistema" name="processEquipmentSystem" defaultValue={defaults.processEquipmentSystem} span="span-2" />
          <Field label="Producto terminado / sistema" name="finishedProductSystem" defaultValue={defaults.finishedProductSystem} span="span-2" />
          <Field label="Lote producto" name="productLot" defaultValue={defaults.productLot} />
          <Field label="Tamaño lote" name="lotSize" defaultValue={defaults.lotSize} />
          <Field label="Cantidad afectada" name="affectedQuantity" defaultValue={defaults.affectedQuantity} />
          <Field label="Cliente" name="client" defaultValue={defaults.client} />
          <Field label="Materia prima / material acond." name="rawOrPackagingMaterial" defaultValue={defaults.rawOrPackagingMaterial} span="span-2" />
          <Field label="Lote material" name="materialLot" defaultValue={defaults.materialLot} />
          <Field label="Tamaño lote material" name="materialLotSize" defaultValue={defaults.materialLotSize} />
          <Field label="Cantidad material afectada" name="materialAffectedQuantity" defaultValue={defaults.materialAffectedQuantity} />
          <Field label="Proveedor" name="supplier" defaultValue={defaults.supplier} />
          <Field label="Lote proveedor" name="supplierLot" defaultValue={defaults.supplierLot} />
          <Field label="Equipo / línea afectada" name="affectedEquipmentLine" defaultValue={defaults.affectedEquipmentLine} />
          <Field label="Otro origen" name="otherOrigin" defaultValue={defaults.otherOrigin} span="span-2" />
          <TextArea label="Documentación afectada" name="affectedDocumentation" defaultValue={defaults.affectedDocumentation} />
        </div>
      </section>

      <section className="form-section">
        <h2>2. Descripción del evento</h2>
        <p className="section-help">Registrar hechos observables. No incluir aquí causas, impacto, hipótesis ni acciones futuras.</p>
        <div className="form-grid">
          <TextArea label="¿Qué sucedió / qué debía haber sucedido? *" name="whatHappened" defaultValue={defaults.whatHappened} />
          <TextArea label="¿Quién estuvo implicado y cuál fue su papel?" name="whoInvolved" defaultValue={defaults.whoInvolved} />
          <TextArea label="¿Cuándo ocurrió?" name="whenHappened" defaultValue={defaults.whenHappened} />
          <TextArea label="¿Dónde ocurrió?" name="whereHappened" defaultValue={defaults.whereHappened} />
          <TextArea label="¿Cómo se detectó / cómo ocurrió?" name="howHappened" defaultValue={defaults.howHappened} />
        </div>
      </section>

      <section className="form-section">
        <h2>3. Acciones correctoras inmediatas</h2>
        <p className="section-help">Solo actuaciones ya ejecutadas para contener, corregir o controlar el evento. No confundir con CAPA.</p>
        <div className="dynamic-list">
          {actions.map((item, index) => (
            <div className="dynamic-row" key={index}>
              <label className="field">
                <span>Acción ejecutada</span>
                <input value={item.description} onChange={(e) => updateAction(index, { description: e.target.value })} />
              </label>
              <label className="field">
                <span>Ejecutada por</span>
                <input value={item.executedBy} onChange={(e) => updateAction(index, { executedBy: e.target.value })} />
              </label>
              <label className="field">
                <span>Fecha</span>
                <input type="date" value={item.executedAt} onChange={(e) => updateAction(index, { executedAt: e.target.value })} />
              </label>
              <button type="button" className="button danger small" onClick={() => setActions((current) => current.filter((_, i) => i !== index))}>Quitar</button>
            </div>
          ))}
          <div><button type="button" className="button small" onClick={() => setActions((current) => [...current, { ...emptyAction }])}>+ Añadir acción inmediata</button></div>
        </div>
      </section>

      <section className="form-section">
        <h2>4. Investigación y causa raíz</h2>
        <p className="section-help">La investigación recoge revisiones, evidencias, comparaciones, hipótesis y deducciones. La causa raíz se registra por separado cuando esté sustentada.</p>
        <div className="form-grid">
          <TextArea label="Investigación" name="investigation" defaultValue={defaults.investigation} />
          <TriStateSelect label="¿Investigación concluyente?" name="investigationConclusive" defaultValue={defaults.investigationConclusive} />
          <div className="field span-3">
            <span>Metodología empleada</span>
            <div className="checkbox-group">
              {[
                ["BRAINSTORMING", "Brainstorming"],
                ["FIVE_WHYS", "5 porqués"],
                ["FTA", "FTA"],
                ["ISHIKAWA", "Ishikawa"],
              ].map(([value, label]) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    name="investigationMethods"
                    value={value}
                    defaultChecked={defaults.investigationMethods?.includes(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <TextArea label="Causa raíz" name="rootCause" defaultValue={defaults.rootCause} help="Registrar únicamente la causa de fondo sustentada por la investigación." />
          <TriStateSelect label="¿Causa raíz recurrente?" name="recurrentRootCause" defaultValue={defaults.recurrentRootCause} />
          <div className="field span-3">
            <span>Antecedentes / detalle de recurrencia</span>
            <textarea name="recurrenceDetails" defaultValue={defaults.recurrenceDetails ?? ""} />
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2>5. Clasificación e impacto</h2>
        <p className="section-help">La evaluación de impacto debe apoyarse en la investigación y no introducir nuevas causas.</p>
        <div className="form-grid">
          <label className="field">
            <span>Clasificación</span>
            <select name="classification" defaultValue={defaults.classification ?? ""}>
              <option value="">No clasificada</option>
              <option value="CRITICAL">Crítica</option>
              <option value="MAJOR">Mayor</option>
              <option value="MINOR">Menor</option>
            </select>
          </label>
          <TriStateSelect label="Impacto validación" name="validationImpact" defaultValue={defaults.validationImpact} />
          <TriStateSelect label="Impacto registro" name="registrationImpact" defaultValue={defaults.registrationImpact} />
          <TriStateSelect label="Impacto estabilidad" name="stabilityImpact" defaultValue={defaults.stabilityImpact} />
          <TriStateSelect label="Otros procesos / productos" name="otherProcessesImpact" defaultValue={defaults.otherProcessesImpact} />
          <TriStateSelect label="Afecta a producto terminado" name="affectsFinishedProduct" defaultValue={defaults.affectsFinishedProduct} />
          <div className="field span-2">
            <span>Detalle otros procesos / productos</span>
            <textarea name="otherProcessesImpactDetails" defaultValue={defaults.otherProcessesImpactDetails ?? ""} />
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2>6. CAPA</h2>
        <p className="section-help">Las CAPA deben derivar de la causa raíz. En este hito se registran como propuestas vinculadas a la desviación; el expediente CAPA completo se incorpora en el Hito 6.</p>
        <div className="form-grid">
          <label className="field">
            <span>¿Procede abrir CAPA?</span>
            <select name="capaRequired" defaultValue={defaults.capaRequired ?? ""}>
              <option value="">Pendiente</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </label>
        </div>
        <div className="dynamic-list" style={{ marginTop: 12 }}>
          {capas.map((item, index) => (
            <div className="dynamic-row capa" key={index}>
              <label className="field">
                <span>Tipo</span>
                <select value={item.actionType} onChange={(e) => updateCapa(index, { actionType: e.target.value as CapaPlanInput["actionType"] })}>
                  <option value="CORRECTIVE">Correctiva</option>
                  <option value="PREVENTIVE">Preventiva</option>
                </select>
              </label>
              <label className="field">
                <span>Acción CAPA propuesta</span>
                <input value={item.description} onChange={(e) => updateCapa(index, { description: e.target.value })} />
              </label>
              <label className="field">
                <span>Fecha prevista</span>
                <input type="date" value={item.plannedExecutionDate} onChange={(e) => updateCapa(index, { plannedExecutionDate: e.target.value })} />
              </label>
              <label className="field">
                <span>Responsable</span>
                <input value={item.responsible} onChange={(e) => updateCapa(index, { responsible: e.target.value })} />
              </label>
              <button type="button" className="button danger small" onClick={() => setCapas((current) => current.filter((_, i) => i !== index))}>Quitar</button>
            </div>
          ))}
          <div><button type="button" className="button small" onClick={() => setCapas((current) => [...current, { ...emptyCapa }])}>+ Añadir CAPA propuesta</button></div>
        </div>
      </section>

      <section className="form-section">
        <h2>7. Conclusión y cierre</h2>
        <p className="section-help">La conclusión sintetiza investigación, causa, impacto, CAPA y disposición. No debe introducir información nueva.</p>
        <div className="form-grid">
          <TextArea label="Conclusión / cierre" name="conclusion" defaultValue={defaults.conclusion} />
          <Field label="Disposición final" name="disposition" defaultValue={defaults.disposition} span="span-2" />
          <Field label="Cantidad" name="dispositionQuantity" defaultValue={defaults.dispositionQuantity} />
          <TriStateSelect label="Notificación al cliente" name="clientNotification" defaultValue={defaults.clientNotification} />
          <TextArea label="Comentarios de disposición" name="dispositionComments" defaultValue={defaults.dispositionComments} />
          <Field label="Fecha cierre" name="closedAt" type="date" defaultValue={defaults.closedAt} />
          <label className="field">
            <span>Estado</span>
            <select name="status" defaultValue={defaults.status ?? "OPEN"}>
              <option value="OPEN">Abierta</option>
              <option value="CLOSED">Cerrada</option>
            </select>
          </label>
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
              <option value="REVIEW_REQUIRED">Pendiente de revisar</option>
            </select>
          </label>
          <TextArea label="Observaciones internas" name="internalObservations" defaultValue={defaults.internalObservations} />
          {mode === "edit" ? (
            <TextArea label="Motivo del cambio (opcional en V1)" name="changeReason" />
          ) : null}
        </div>
      </section>

      <div className="form-footer">
        <Link className="button" href={deviationId ? `/deviations/${deviationId}` : "/deviations"}>Cancelar</Link>
        <button type="submit" className="button primary" disabled={pending}>
          {pending ? "Guardando…" : mode === "create" ? "Guardar desviación" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
