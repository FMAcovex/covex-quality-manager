"use client";
import { deviationVersionLabel } from "@/modules/deviations/version-mode";

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

function FieldIssue({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <small className="field-error">{messages[0]}</small>;
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  span = "",
  required = false,
  issues,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  span?: string;
  required?: boolean;
  issues?: string[];
}) {
  return (
    <label className={`field ${span} ${issues?.length ? "has-error" : ""}`}>
      <span>{label}{required ? " *" : ""}</span>
      <input name={name} type={type} defaultValue={defaultValue ?? ""} required={required} aria-invalid={issues?.length ? true : undefined} />
      <FieldIssue messages={issues} />
    </label>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
  help,
  required = false,
  issues,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  help?: string;
  required?: boolean;
  issues?: string[];
}) {
  return (
    <label className={`field full ${issues?.length ? "has-error" : ""}`}>
      <span>{label}{required ? " *" : ""}</span>
      {help ? <small className="muted-note">{help}</small> : null}
      <textarea name={name} defaultValue={defaultValue ?? ""} required={required} aria-invalid={issues?.length ? true : undefined} />
      <FieldIssue messages={issues} />
    </label>
  );
}

function TriStateSelect({
  label,
  name,
  defaultValue,
  required = false,
  issues,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  issues?: string[];
}) {
  return (
    <label className={`field ${issues?.length ? "has-error" : ""}`}>
      <span>{label}{required ? " *" : ""}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        aria-invalid={issues?.length ? true : undefined}
      >
        <option value="">No informado</option>
        <option value="YES">Sí</option>
        <option value="NO">No</option>
        <option value="NA">N/A</option>
      </select>
      <FieldIssue messages={issues} />
    </label>
  );
}

export function DeviationForm({
  action,
  departments,
  defaults = {},
  mode,
  deviationId,
  currentVersionSequence = 0,
}: {
  action: FormAction;
  departments: DepartmentOption[];
  defaults?: DeviationFormDefaults;
  mode: "create" | "edit";
  deviationId?: string;
  currentVersionSequence?: number;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [actions, setActions] = useState<ImmediateActionInput[]>(defaults.immediateActions ?? []);
  const [capas, setCapas] = useState<CapaPlanInput[]>(defaults.capaPlans ?? []);
  const issues = state.fieldIssues ?? {};

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
      <input type="hidden" name="provenance" value={defaults.provenance ?? ""} />
      <input type="hidden" name="processEquipmentSystem" value={defaults.processEquipmentSystem ?? ""} />

      {state.error ? (
        <div className="form-errors">
          <strong>{state.error}</strong>
          {state.fieldErrors?.length ? (
            <ul>{state.fieldErrors.map((error) => <li key={error}>{error}</li>)}</ul>
          ) : null}
        </div>
      ) : null}

      <section className="form-section">
        <h2>Identificación</h2>
        <p className="section-help">Datos que identifican el expediente y su registro inicial.</p>
        <div className="form-grid">
          <Field label="Codificación" name="businessCode" defaultValue={defaults.businessCode} required issues={issues.businessCode} />
          <label className={`field ${issues.departmentId?.length ? "has-error" : ""}`}>
            <span>Departamento *</span>
            <select name="departmentId" defaultValue={defaults.departmentId ?? ""} required aria-invalid={issues.departmentId?.length ? true : undefined}>
              <option value="">Seleccionar…</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.code} — {department.name}
                </option>
              ))}
            </select>
            <FieldIssue messages={issues.departmentId} />
          </label>
          <Field label="Fecha apertura" name="issueDate" type="date" defaultValue={defaults.issueDate} required issues={issues.issueDate} />
          <Field label="Fecha/hora del evento" name="eventDateTime" type="datetime-local" defaultValue={defaults.eventDateTime} required issues={issues.eventDateTime} />
          <Field label="Detectado por" name="detectedBy" defaultValue={defaults.detectedBy} required issues={issues.detectedBy} />
          <Field label="Cumplimentado por" name="createdByText" defaultValue={defaults.createdByText} required issues={issues.createdByText} />
          <Field label="Breve descripción del proceso/equipo/sistema afectado" name="materialProcessAffected" defaultValue={defaults.materialProcessAffected} span="span-2" required issues={issues.materialProcessAffected} />
        </div>
      </section>

      <section className="form-section">
        <h2>A. Origen</h2>
        <p className="section-help">Origen principal de la desviación y datos asociados, manteniendo la información existente del expediente.</p>
        <div className="deviation-origin-grid">
          <div className="deviation-origin-group">
            <h3>Producto terminado / Sistema</h3>
            <div className="form-grid">
              <Field label="Producto terminado / sistema" name="finishedProductSystem" defaultValue={defaults.finishedProductSystem} span="span-2" />
              <Field label="Nº de lote" name="productLot" defaultValue={defaults.productLot} />
              <Field label="Tamaño de lote" name="lotSize" defaultValue={defaults.lotSize} />
              <Field label="Cantidad afectada" name="affectedQuantity" defaultValue={defaults.affectedQuantity} />
            </div>
          </div>

          <div className="deviation-origin-group">
            <h3>Cliente</h3>
            <div className="form-grid">
              <Field label="Cliente" name="client" defaultValue={defaults.client} span="span-2" />
            </div>
          </div>

          <div className="deviation-origin-group">
            <h3>Materia prima / Material de acondicionamiento</h3>
            <div className="form-grid">
              <Field label="Materia prima / material de acondicionamiento" name="rawOrPackagingMaterial" defaultValue={defaults.rawOrPackagingMaterial} span="span-2" />
              <Field label="Nº de lote" name="materialLot" defaultValue={defaults.materialLot} />
              <Field label="Tamaño de lote / cantidad" name="materialLotSize" defaultValue={defaults.materialLotSize} />
              <Field label="Cantidad afectada" name="materialAffectedQuantity" defaultValue={defaults.materialAffectedQuantity} />
            </div>
          </div>

          <div className="deviation-origin-group">
            <h3>Proveedor</h3>
            <div className="form-grid">
              <Field label="Proveedor" name="supplier" defaultValue={defaults.supplier} span="span-2" />
              <Field label="Lote de proveedor" name="supplierLot" defaultValue={defaults.supplierLot} />
            </div>
          </div>

          <div className="deviation-origin-group">
            <h3>Equipo / Línea afectada</h3>
            <div className="form-grid">
              <Field label="Equipo o línea afectada" name="affectedEquipmentLine" defaultValue={defaults.affectedEquipmentLine} span="span-2" />
            </div>
          </div>

          <div className="deviation-origin-group">
            <h3>Otros</h3>
            <div className="form-grid">
              <Field label="Especificar" name="otherOrigin" defaultValue={defaults.otherOrigin} span="span-2" />
            </div>
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2>B. Documentación afectada</h2>
        <p className="section-help">Documentos, procedimientos, instrucciones o registros afectados por la desviación.</p>
        <div className="form-grid">
          <TextArea label="Documentación afectada" name="affectedDocumentation" defaultValue={defaults.affectedDocumentation} />
        </div>
      </section>

      <section className="form-section">
        <h2>C. Descripción del evento</h2>
        <p className="section-help">Registrar hechos observables. No incluir aquí causas, impacto, hipótesis ni acciones futuras.</p>
        <div className="form-grid">
          <TextArea label="¿Qué sucedió / qué debía haber sucedido?" name="whatHappened" defaultValue={defaults.whatHappened} required issues={issues.whatHappened} />
          <TextArea label="¿Quién estuvo implicado y cuál fue su papel?" name="whoInvolved" defaultValue={defaults.whoInvolved} required issues={issues.whoInvolved} />
          <TextArea label="¿Cuándo ocurrió?" name="whenHappened" defaultValue={defaults.whenHappened} required issues={issues.whenHappened} />
          <TextArea label="¿Dónde ocurrió?" name="whereHappened" defaultValue={defaults.whereHappened} required issues={issues.whereHappened} />
          <TextArea label="¿Cómo se detectó / cómo ocurrió?" name="howHappened" defaultValue={defaults.howHappened} required issues={issues.howHappened} />
        </div>
      </section>

      <section className="form-section">
        <h2>D. Acción inmediata</h2>
        <p className="section-help">Solo actuaciones ya ejecutadas para contener, corregir o controlar el evento. No confundir con CAPA.</p>
        {issues.immediateActionsJson?.length ? <div className="field-error-block"><FieldIssue messages={issues.immediateActionsJson} /></div> : null}
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
        <h2>E. Investigación</h2>
        <p className="section-help">Documentar la investigación realizada y si las evidencias permiten alcanzar una conclusión.</p>
        <div className="form-grid">
          <TextArea label="Investigación realizada / resultado y conclusiones" name="investigation" defaultValue={defaults.investigation} required issues={issues.investigation} />
          <TriStateSelect label="¿Investigación concluyente?" name="investigationConclusive" defaultValue={defaults.investigationConclusive} required issues={issues.investigationConclusive} />
        </div>
      </section>

      <section className="form-section">
        <h2>F-G. Causa raíz</h2>
        <p className="section-help">Metodología de análisis, causa de fondo, recurrencia y antecedentes relacionados.</p>
        <div className="form-grid">
          <div className="field full">
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
          <TextArea label="Causa raíz" name="rootCause" defaultValue={defaults.rootCause} help="Registrar únicamente la causa de fondo sustentada por la investigación." issues={issues.rootCause} />
          <TriStateSelect label="¿Causa raíz recurrente?" name="recurrentRootCause" defaultValue={defaults.recurrentRootCause} />
          <div className="field span-3">
            <span>Antecedentes / detalle de recurrencia</span>
            <textarea name="recurrenceDetails" defaultValue={defaults.recurrenceDetails ?? ""} />
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2>H. Clasificación de la desviación</h2>
        <p className="section-help">Clasificación GMP del evento según su criticidad.</p>
        <div className="form-grid">
          <label className={`field ${issues.classification?.length ? "has-error" : ""}`}>
            <span>Clasificación</span>
            <select name="classification" defaultValue={defaults.classification ?? ""} aria-invalid={issues.classification?.length ? true : undefined}>
              <option value="">No clasificada</option>
              <option value="CRITICAL">Crítica</option>
              <option value="MAJOR">Mayor</option>
              <option value="MINOR">Menor</option>
            </select>
            <FieldIssue messages={issues.classification} />
          </label>
        </div>
      </section>

      <section className="form-section">
        <h2>I. Impacto</h2>
        <p className="section-help">La evaluación de impacto debe apoyarse en la investigación y no introducir nuevas causas.</p>
        <div className="form-grid">
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
        <h2>J. CAPA</h2>
        <p className="section-help">Las CAPA deben derivar de la causa raíz. Se mantienen las propuestas y vínculos existentes sin cambiar su lógica en D1.</p>
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
        {issues.capaPlansJson?.length ? <div className="field-error-block"><FieldIssue messages={issues.capaPlansJson} /></div> : null}
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
        <h2>K-L. Conclusión y cierre</h2>
        <p className="section-help">La conclusión sintetiza investigación, causa, impacto, CAPA y disposición. No debe introducir información nueva.</p>
        <div className="form-grid">
          <TextArea label="Conclusión / cierre" name="conclusion" defaultValue={defaults.conclusion} issues={issues.conclusion} />
          <Field label="Disposición final" name="disposition" defaultValue={defaults.disposition} span="span-2" />
          <Field label="Cantidad" name="dispositionQuantity" defaultValue={defaults.dispositionQuantity} />
          <TriStateSelect label="Notificación al cliente" name="clientNotification" defaultValue={defaults.clientNotification} />
          <TextArea label="Comentarios de disposición" name="dispositionComments" defaultValue={defaults.dispositionComments} />
        </div>
      </section>

      <section className="form-section">
        <h2>Información final del expediente</h2>
        <p className="section-help">Estado administrativo y controles finales del expediente.</p>
        <div className="form-grid">
          <Field label="Fecha cierre" name="closedAt" type="date" defaultValue={defaults.closedAt} issues={issues.closedAt} />
          <label className="field">
            <span>Estado</span>
            <select name="status" defaultValue={defaults.status ?? "OPEN"}>
              <option value="OPEN">Abierta</option>
              <option value="CLOSED">Cerrada</option>
            </select>
          </label>
          <label className="field">
            <span>Control de estado</span>
            <select name="dataQualityStatus" defaultValue={defaults.dataQualityStatus ?? "REVIEW_REQUIRED"}>
              <option value="COMPLETE">Completo</option>
              <option value="INCOMPLETE">Incompleto</option>
              <option value="REVIEW_REQUIRED">Pendiente de revisar</option>
            </select>
          </label>
          <div className="field">
            <span>Documento firmado</span>
            <input
              type="hidden"
              name="signedDocumentAvailable"
              value={defaults.signedDocumentAvailable ?? ""}
            />
            <small className="muted-note">
              El PDF firmado se carga y controla por versión desde la pestaña Versiones del expediente.
            </small>
          </div>
          <TextArea label="Observaciones internas" name="internalObservations" defaultValue={defaults.internalObservations} />
        </div>
      </section>

      {mode === "edit" ? (
        <section className="form-section">
          <h2>Edición / nueva versión</h2>
          <p className="section-help">Campos propios de la modificación y del versionado. Se mantienen separados de los apartados A-L.</p>
          <div className="form-grid">
            <Field label="Modificado por" name="modifiedByText" defaultValue={defaults.createdByText} />
            <TextArea
              label="Motivo del cambio / seguimiento"
              name="changeReason"
              help={`Obligatorio al generar ${deviationVersionLabel(currentVersionSequence + 1)}. Quedará asociado a la versión.`}
              issues={issues.changeReason}
            />
          </div>
        </section>
      ) : null}

      <div className="form-footer">
        <Link className="button" href={deviationId ? `/deviations/${deviationId}` : "/deviations"}>Cancelar</Link>
        {mode === "create" ? (
          <button type="submit" className="button primary" disabled={pending}>
            {pending ? "Guardando…" : "Guardar desviación"}
          </button>
        ) : (
          <div className="version-submit-group">
            <div className="version-submit-note">
              <strong>Versión vigente {deviationVersionLabel(currentVersionSequence)}</strong>
              <span>Guardar cambios mantiene esta versión. Generar una nueva versión congela la vigente.</span>
            </div>
            <button
              type="submit"
              name="saveMode"
              value="update-current"
              className="button"
              disabled={pending}
            >
              {pending ? "Guardando…" : "Guardar cambios"}
            </button>
            <button
              type="submit"
              name="saveMode"
              value="new-version"
              className="button primary"
              disabled={pending}
            >
              {pending ? "Guardando…" : `Generar nueva versión / seguimiento ${deviationVersionLabel(currentVersionSequence + 1)}`}
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
