"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type {
  ChangeControlFormDefaults,
  ChangeControlFormState,
  ChangeTaskInput,
} from "@/modules/change-control/types";
import { scopeLabels } from "@/modules/change-control/domain";

type Department = { id: string; code: string; name: string };

const initialState: ChangeControlFormState = { error: null };
const emptyTask: ChangeTaskInput = {
  departmentId: "",
  description: "",
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
    <label className="field span-3">
      <span>{label}</span>
      {help ? <small className="muted-note">{help}</small> : null}
      <textarea name={name} defaultValue={defaultValue ?? ""} />
    </label>
  );
}

function BooleanSelect({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: "" | "true" | "false";
}) {
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

function TriStateSelect({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: "YES" | "NO" | "NA";
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} defaultValue={defaultValue ?? ""}>
        <option value="">No informado</option>
        <option value="YES">Sí</option>
        <option value="NO">No</option>
        <option value="NA">No aplica</option>
      </select>
    </label>
  );
}

export function ChangeControlForm({
  mode,
  action,
  departments,
  defaults = {},
  changeId,
  baselineLocked = false,
}: {
  mode: "create" | "edit";
  action: (state: ChangeControlFormState, formData: FormData) => Promise<ChangeControlFormState>;
  departments: Department[];
  defaults?: ChangeControlFormDefaults;
  changeId?: string;
  baselineLocked?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [tasks, setTasks] = useState<ChangeTaskInput[]>(
    defaults.tasks?.length ? defaults.tasks : [{ ...emptyTask }],
  );

  const updateTask = (index: number, patch: Partial<ChangeTaskInput>) => {
    setTasks((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  return (
    <form action={formAction} className="record-form">
      <input type="hidden" name="tasksJson" value={JSON.stringify(tasks)} />

      {state.error ? (
        <div className="form-errors">
          <strong>{state.error}</strong>
          {state.fieldErrors?.length ? (
            <ul>{state.fieldErrors.map((error) => <li key={error}>{error}</li>)}</ul>
          ) : null}
        </div>
      ) : null}

      <section className="form-section">
        <h2>1. Solicitud de cambio · Anexo III</h2>
        <p className="section-help">
          Identificación, alcance, solicitante, descripción, justificación y aceptación de la solicitud.
        </p>
        <div className="form-grid">
          <Field label="N.º Control de Cambio" name="businessCode" defaultValue={defaults.businessCode} required />
          <Field label="Fecha de solicitud" name="requestDate" type="date" defaultValue={defaults.requestDate} required />
          <label className="field span-2">
            <span>Departamento / Área solicitante *</span>
            <select name="departmentId" defaultValue={defaults.departmentId ?? ""} required>
              <option value="">Seleccionar…</option>
              {departments.map((item) => (
                <option key={item.id} value={item.id}>{item.code} — {item.name}</option>
              ))}
            </select>
          </label>

          <div className="field span-3">
            <span>Alcance del cambio *</span>
            <div className="checkbox-group">
              {Object.entries(scopeLabels).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    name="scope"
                    value={key}
                    defaultChecked={defaults.scope?.includes(key)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <Field label="Especificar Otros" name="otherScope" defaultValue={defaults.otherScope} />
          <Field label="Nombre y apellidos del solicitante" name="requesterName" defaultValue={defaults.requesterName} required span="span-2" />
          <Field label="Puesto" name="requesterPosition" defaultValue={defaults.requesterPosition} span="span-2" />
          <TextArea label="Descripción del cambio *" name="description" defaultValue={defaults.description} />
          <TextArea label="Justificación del cambio *" name="justification" defaultValue={defaults.justification} />
          <TextArea label="Relación de documentos que se aportan" name="providedDocuments" defaultValue={defaults.providedDocuments} />
          <label className="field">
            <span>Solicitud</span>
            <select name="requestDecision" defaultValue={defaults.requestDecision ?? "PENDING"}>
              <option value="PENDING">Pendiente</option>
              <option value="ACCEPTED">Aceptada</option>
              <option value="DENIED">Denegada</option>
            </select>
          </label>
          <Field label="Responsable que acepta/deniega" name="requestDecisionResponsible" defaultValue={defaults.requestDecisionResponsible} />
          <Field label="Cargo / función" name="requestDecisionRole" defaultValue={defaults.requestDecisionRole} />
          <Field label="Fecha aceptación/denegación" name="requestDecisionDate" type="date" defaultValue={defaults.requestDecisionDate} />
        </div>
      </section>

      <section className="form-section">
        <h2>2. Dictamen del cambio · Anexo IV</h2>
        <p className="section-help">
          El Dictamen aprobado constituye la línea base. Una vez aprobado, sus acciones quedan bloqueadas; las nuevas tareas se añaden desde los seguimientos.
        </p>
        <div className="form-grid">
          <TextArea label="Evaluación del cambio" name="evaluation" defaultValue={defaults.evaluation} />
          <label className="field">
            <span>Clasificación</span>
            <select name="classification" defaultValue={defaults.classification ?? ""}>
              <option value="">Pendiente</option>
              <option value="MAJOR">Mayor</option>
              <option value="MINOR">Menor</option>
            </select>
          </label>
          <Field label="Fecha prevista de implementación" name="plannedImplementationDate" type="date" defaultValue={defaults.plannedImplementationDate} />
          <label className="field">
            <span>Resultado del Dictamen</span>
            <select name="dictamenResult" defaultValue={defaults.dictamenResult ?? "PENDING"}>
              <option value="PENDING">Pendiente</option>
              <option value="APPROVED">Aprobado</option>
              <option value="REJECTED">Rechazado</option>
            </select>
          </label>
          <Field label="Fecha del Dictamen / aprobación" name="dictamenDate" type="date" defaultValue={defaults.dictamenDate} />
          <Field label="Responsable de seguimiento" name="followupResponsible" defaultValue={defaults.followupResponsible} span="span-2" />
          <Field label="Aprobación · nombres/cargos" name="approvalNames" defaultValue={defaults.approvalNames} span="span-2" />
          <TextArea label="Observaciones del Dictamen" name="dictamenObservations" defaultValue={defaults.dictamenObservations} />
        </div>

        <h3>Plan de ejecución</h3>
        {baselineLocked ? (
          <div className="analytics-note">
            <strong>Baseline aprobado bloqueado.</strong> Las acciones del Dictamen ya no pueden modificarse. Las acciones adicionales deben incorporarse en un seguimiento y quedarán identificadas como nuevas.
          </div>
        ) : null}
        <div className="dynamic-list">
          {tasks.map((item, index) => (
            <div className="dynamic-row change-task-row" key={item.id ?? index}>
              <label className="field">
                <span>Departamento</span>
                <select
                  value={item.departmentId}
                  disabled={baselineLocked}
                  onChange={(e) => updateTask(index, { departmentId: e.target.value })}
                >
                  <option value="">Seleccionar…</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.code}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Acción / tarea</span>
                <textarea
                  value={item.description}
                  disabled={baselineLocked}
                  onChange={(e) => updateTask(index, { description: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Responsable</span>
                <input
                  value={item.responsible}
                  disabled={baselineLocked}
                  onChange={(e) => updateTask(index, { responsible: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Fecha prevista</span>
                <input
                  type="date"
                  value={item.plannedDate}
                  disabled={baselineLocked}
                  onChange={(e) => updateTask(index, { plannedDate: e.target.value })}
                />
              </label>
              {!baselineLocked ? (
                <button
                  className="button danger small"
                  type="button"
                  onClick={() => setTasks((current) => current.filter((_, i) => i !== index))}
                >
                  Quitar
                </button>
              ) : null}
            </div>
          ))}
          {!baselineLocked ? (
            <div>
              <button type="button" className="button small" onClick={() => setTasks((current) => [...current, { ...emptyTask }])}>
                + Añadir acción
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="form-section">
        <h2>3. Implicaciones y requisitos asociados</h2>
        <div className="form-grid">
          <BooleanSelect label="¿Comité de cambios?" name="committeeRequired" defaultValue={defaults.committeeRequired} />
          <Field label="Justificación / personal implicado" name="committeeDetails" defaultValue={defaults.committeeDetails} span="span-2" />
          <BooleanSelect label="¿Informar a cliente?" name="clientNotificationRequired" defaultValue={defaults.clientNotificationRequired} />
          <Field label="Detalle / fecha / evidencia cliente" name="clientNotificationDetails" defaultValue={defaults.clientNotificationDetails} span="span-2" />
          <BooleanSelect label="¿Autoridad sanitaria?" name="authorityRequired" defaultValue={defaults.authorityRequired} />
          <Field label="Detalle autoridad" name="authorityDetails" defaultValue={defaults.authorityDetails} span="span-2" />
          <TriStateSelect label="¿Reflejar en PQR?" name="pqrRequired" defaultValue={defaults.pqrRequired} />
          <Field label="Producto(s) PQR" name="pqrProducts" defaultValue={defaults.pqrProducts} />
          <Field label="Periodo PQR" name="pqrPeriod" defaultValue={defaults.pqrPeriod} />
          <TriStateSelect label="¿Lotes a estabilidad?" name="stabilityRequired" defaultValue={defaults.stabilityRequired} />
          <div className="field span-2">
            <span>Tipo de estabilidad</span>
            <div className="checkbox-group">
              <label><input type="checkbox" name="stabilityAccelerated" defaultChecked={defaults.stabilityAccelerated} /> Acelerada</label>
              <label><input type="checkbox" name="stabilityOngoing" defaultChecked={defaults.stabilityOngoing} /> En curso</label>
            </div>
          </div>
          <TriStateSelect label="¿Análisis adicionales?" name="additionalAnalysisRequired" defaultValue={defaults.additionalAnalysisRequired} />
          <Field label="Especificar análisis" name="additionalAnalysisDetails" defaultValue={defaults.additionalAnalysisDetails} span="span-2" />
          <TriStateSelect label="¿Validación adicional?" name="additionalValidationRequired" defaultValue={defaults.additionalValidationRequired} />
          <Field label="Detalle validación" name="additionalValidationDetails" defaultValue={defaults.additionalValidationDetails} span="span-2" />
          <BooleanSelect label="¿Otras implicaciones?" name="otherImplicationRequired" defaultValue={defaults.otherImplicationRequired} />
          <Field label="Especificar otras implicaciones" name="otherImplicationDetails" defaultValue={defaults.otherImplicationDetails} span="span-2" />
        </div>
      </section>

      <section className="form-section">
        <h2>4. Control interno</h2>
        <div className="form-grid">
          <TextArea label="Observaciones internas" name="internalObservations" defaultValue={defaults.internalObservations} />
          <BooleanSelect label="Documento firmado disponible" name="signedDocumentAvailable" defaultValue={defaults.signedDocumentAvailable} />
          <label className="field">
            <span>Control del dato</span>
            <select name="dataQualityStatus" defaultValue={defaults.dataQualityStatus ?? "REVIEW_REQUIRED"}>
              <option value="COMPLETE">Completo</option>
              <option value="INCOMPLETE">Incompleto</option>
              <option value="REVIEW_REQUIRED">Pendiente de revisar</option>
            </select>
          </label>
          {mode === "edit" ? (
            <>
              <Field label="Modificado por" name="modifiedByText" defaultValue={defaults.requesterName} />
              <TextArea label="Motivo del cambio" name="changeReason" />
            </>
          ) : null}
        </div>
      </section>

      <div className="form-footer">
        <Link className="button" href={changeId ? `/changes/${changeId}` : "/changes"}>Cancelar</Link>
        <button className="button primary" type="submit" disabled={pending}>
          {pending ? "Guardando…" : mode === "create" ? "Guardar Control de Cambio" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
