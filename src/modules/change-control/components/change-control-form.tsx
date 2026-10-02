"use client";

import Link from "next/link";
import { submittedDefaults } from "@/lib/forms/preserved-state";
import { ControlledBusinessCodeField } from "@/components/controlled-business-code-field";
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
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  help?: string;
  required?: boolean;
}) {
  return (
    <label className="field span-3">
      <span>{label}{required ? " *" : ""}</span>
      {help ? <small className="muted-note">{help}</small> : null}
      <textarea name={name} defaultValue={defaultValue ?? ""} required={required} />
    </label>
  );
}

function BooleanSelect({
  label,
  name,
  defaultValue,
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: "" | "true" | "false";
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}{required ? " *" : ""}</span>
      <select name={name} defaultValue={defaultValue ?? ""} required={required}>
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
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: "YES" | "NO" | "NA";
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}{required ? " *" : ""}</span>
      <select name={name} defaultValue={defaultValue ?? ""} required={required}>
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
  const formDefaults = submittedDefaults(defaults, state.submittedValues);
  const [tasks, setTasks] = useState<ChangeTaskInput[]>(
    defaults.tasks?.length ? defaults.tasks : [{ ...emptyTask }],
  );
  const [departmentId, setDepartmentId] = useState(formDefaults.departmentId ?? "");
  const [requestDate, setRequestDate] = useState(formDefaults.requestDate ?? "");
  const [recordStatus, setRecordStatus] = useState<"DRAFT" | "OPEN" | "CLOSED">(
    formDefaults.finalStatus ?? (mode === "create" ? "DRAFT" : "OPEN"),
  );
  const [dictamenResult, setDictamenResult] = useState(formDefaults.dictamenResult ?? "PENDING");
  const draft = recordStatus === "DRAFT";

  const updateTask = (index: number, patch: Partial<ChangeTaskInput>) => {
    setTasks((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  return (
    <form key={state.formRevision ?? 0} action={formAction} className="record-form">
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
          <ControlledBusinessCodeField
            recordType="CHANGE_CONTROL"
            label="N.º Control de Cambio"
            initialValue={formDefaults.businessCode}
            mode={mode}
            yearSource={requestDate}
            departmentId={departmentId}
            locked={mode === "edit" && !draft}
          />
          <label className="field">
            <span>Fecha de solicitud{draft ? "" : " *"}</span>
            <input name="requestDate" type="date" value={requestDate} onChange={(event) => setRequestDate(event.target.value)} required={!draft} />
          </label>
          <label className="field span-2">
            <span>Departamento / Área solicitante{draft ? "" : " *"}</span>
            <select name="departmentId" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} required={!draft}>
              <option value="">Seleccionar…</option>
              {departments.map((item) => (
                <option key={item.id} value={item.id}>{item.code} — {item.name}</option>
              ))}
            </select>
          </label>

          <div className="field span-3">
            <span>Alcance del cambio{draft ? "" : " *"}</span>
            <div className="checkbox-group">
              {Object.entries(scopeLabels).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    name="scope"
                    value={key}
                    defaultChecked={formDefaults.scope?.includes(key)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <Field label="Especificar Otros" name="otherScope" defaultValue={formDefaults.otherScope} />
          <Field label="Nombre y apellidos del solicitante" name="requesterName" defaultValue={formDefaults.requesterName} required={!draft} span="span-2" />
          <Field label="Puesto" name="requesterPosition" defaultValue={formDefaults.requesterPosition} required={!draft} span="span-2" />
          <TextArea label="Descripción del cambio" name="description" defaultValue={formDefaults.description} required={!draft} />
          <TextArea label="Justificación del cambio" name="justification" defaultValue={formDefaults.justification} required={!draft} />
          <TextArea label="Relación de documentos que se aportan" name="providedDocuments" defaultValue={formDefaults.providedDocuments} required={!draft} help="Si no se aportan documentos, indique No aplica." />
          <label className="field">
            <span>Solicitud</span>
            <select name="requestDecision" defaultValue={formDefaults.requestDecision ?? "PENDING"}>
              <option value="PENDING">Pendiente</option>
              <option value="ACCEPTED">Aceptada</option>
              <option value="DENIED">Denegada</option>
            </select>
          </label>
          <Field label="Responsable de dictamen" name="requestDecisionResponsible" defaultValue={formDefaults.requestDecisionResponsible} />
          <Field label="Cargo / función" name="requestDecisionRole" defaultValue={formDefaults.requestDecisionRole} />
          <Field label="Fecha aceptación/denegación" name="requestDecisionDate" type="date" defaultValue={formDefaults.requestDecisionDate} />
        </div>
      </section>

      <section className="form-section">
        <h2>2. Dictamen del cambio · Anexo IV</h2>
        <p className="section-help">
          El Dictamen aprobado constituye la línea base. Una vez aprobado, sus acciones quedan bloqueadas; las nuevas tareas se añaden desde los seguimientos.
        </p>
        <div className="form-grid">
          <TextArea label="Evaluación del cambio" name="evaluation" defaultValue={formDefaults.evaluation} required={!draft} />
          <label className="field">
            <span>Clasificación{draft ? "" : " *"}</span>
            <select name="classification" defaultValue={formDefaults.classification ?? ""} required={!draft}>
              <option value="">Pendiente</option>
              <option value="MAJOR">Mayor</option>
              <option value="MINOR">Menor</option>
            </select>
          </label>
          <Field label="Fecha prevista de implementación" name="plannedImplementationDate" type="date" defaultValue={formDefaults.plannedImplementationDate} required={!draft} />
        </div>

        <h3>2.a Implicación del cambio y requisitos</h3>
        <div className="form-grid">
          <BooleanSelect label="¿Comité de cambios?" name="committeeRequired" defaultValue={formDefaults.committeeRequired} required={!draft} />
          <Field label="Respuesta / justificación y personal implicado" name="committeeDetails" defaultValue={formDefaults.committeeDetails} span="span-2" />
          <BooleanSelect label="¿Informar a cliente?" name="clientNotificationRequired" defaultValue={formDefaults.clientNotificationRequired} required={!draft} />
          <Field label="Respuesta / justificación, fecha y evidencia cliente" name="clientNotificationDetails" defaultValue={formDefaults.clientNotificationDetails} span="span-2" />
          <BooleanSelect label="¿Autoridad sanitaria?" name="authorityRequired" defaultValue={formDefaults.authorityRequired} required={!draft} />
          <Field label="Respuesta / justificación sobre autoridad" name="authorityDetails" defaultValue={formDefaults.authorityDetails} span="span-2" />
          <TriStateSelect label="¿Reflejar en PQR?" name="pqrRequired" defaultValue={formDefaults.pqrRequired} required={!draft} />
          <Field label="Respuesta / producto(s) PQR" name="pqrProducts" defaultValue={formDefaults.pqrProducts} />
          <Field label="Respuesta / periodo PQR" name="pqrPeriod" defaultValue={formDefaults.pqrPeriod} />
          <TriStateSelect label="¿Lotes a estabilidad?" name="stabilityRequired" defaultValue={formDefaults.stabilityRequired} required={!draft} />
          <div className="field span-2">
            <span>Respuesta / tipo de estabilidad</span>
            <div className="checkbox-group">
              <label><input type="checkbox" name="stabilityAccelerated" defaultChecked={formDefaults.stabilityAccelerated} /> Acelerada</label>
              <label><input type="checkbox" name="stabilityOngoing" defaultChecked={formDefaults.stabilityOngoing} /> En curso</label>
            </div>
          </div>
          <TriStateSelect label="¿Análisis adicionales?" name="additionalAnalysisRequired" defaultValue={formDefaults.additionalAnalysisRequired} required={!draft} />
          <Field label="Respuesta / justificación de análisis" name="additionalAnalysisDetails" defaultValue={formDefaults.additionalAnalysisDetails} span="span-2" />
          <TriStateSelect label="¿Validación adicional?" name="additionalValidationRequired" defaultValue={formDefaults.additionalValidationRequired} required={!draft} />
          <Field label="Respuesta / justificación de validación" name="additionalValidationDetails" defaultValue={formDefaults.additionalValidationDetails} span="span-2" />
          <BooleanSelect label="¿Otras implicaciones?" name="otherImplicationRequired" defaultValue={formDefaults.otherImplicationRequired} required={!draft} />
          <Field label="Respuesta / justificación de otras implicaciones" name="otherImplicationDetails" defaultValue={formDefaults.otherImplicationDetails} span="span-2" />
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
                  required={!draft && dictamenResult === "APPROVED"}
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
                  required={!draft && dictamenResult === "APPROVED"}
                  onChange={(e) => updateTask(index, { description: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Responsable</span>
                <input
                  value={item.responsible}
                  disabled={baselineLocked}
                  required={!draft && dictamenResult === "APPROVED"}
                  onChange={(e) => updateTask(index, { responsible: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Fecha prevista</span>
                <input
                  type="date"
                  value={item.plannedDate}
                  disabled={baselineLocked}
                  required={!draft && dictamenResult === "APPROVED"}
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
        <h2>3. Resultado del dictamen</h2>
        <p className="section-help">El próximo seguimiento se obtiene de la última versión formal registrada y no se duplica en el expediente.</p>
        <div className="form-grid">
          <label className="field">
            <span>Resultado del dictamen</span>
            <select name="dictamenResult" value={dictamenResult} onChange={(event) => setDictamenResult(event.target.value as typeof dictamenResult)}>
              <option value="PENDING">Pendiente</option>
              <option value="APPROVED">Aprobado</option>
              <option value="REJECTED">Rechazado</option>
            </select>
          </label>
          <Field label="Fecha del dictamen" name="dictamenDate" type="date" defaultValue={formDefaults.dictamenDate} required={!draft && dictamenResult !== "PENDING"} />
          <label className="field">
            <span>Fecha del próximo seguimiento</span>
            <input type="date" value={formDefaults.nextFollowupDate ?? ""} readOnly aria-readonly="true" />
            <small className="muted-note">{formDefaults.nextFollowupDate ? "Derivada del último seguimiento registrado." : "Se informará al registrar el Seguimiento 00."}</small>
          </label>
          <Field label="Responsable de seguimiento" name="followupResponsible" defaultValue={formDefaults.followupResponsible} required={!draft && dictamenResult === "APPROVED"} span="span-2" />
          <TextArea label="Observaciones" name="dictamenObservations" defaultValue={formDefaults.dictamenObservations} required={!draft && dictamenResult !== "PENDING"} />
        </div>
      </section>

      <section className="form-section">
        <h2>4. Control interno</h2>
        <div className="form-grid">
          <label className="field">
            <span>Estado del expediente</span>
            <select name="finalStatus" value={recordStatus} onChange={(event) => setRecordStatus(event.target.value as "DRAFT" | "OPEN" | "CLOSED")}>
              {(mode === "create" || formDefaults.finalStatus === "DRAFT") ? <option value="DRAFT">Borrador</option> : null}
              <option value="OPEN">Abierto</option>
              {formDefaults.finalStatus === "CLOSED" ? <option value="CLOSED">Cerrado</option> : null}
            </select>
            <small className="muted-note">{draft ? "En borrador pueden quedar campos pendientes. Al abrir se validarán los obligatorios." : "El expediente está en ciclo operativo."}</small>
          </label>
          <TextArea label="Observaciones internas" name="internalObservations" defaultValue={formDefaults.internalObservations} />
          <BooleanSelect label="Documento firmado disponible" name="signedDocumentAvailable" defaultValue={formDefaults.signedDocumentAvailable} />
          <label className="field">
            <span>Control del dato</span>
            <select name="dataQualityStatus" defaultValue={formDefaults.dataQualityStatus ?? "REVIEW_REQUIRED"}>
              <option value="COMPLETE">Completo</option>
              <option value="INCOMPLETE">Incompleto</option>
              <option value="REVIEW_REQUIRED">Pendiente de revisar</option>
            </select>
          </label>
          {mode === "edit" ? (
            <>
              <Field label="Modificado por" name="modifiedByText" defaultValue={formDefaults.requesterName} />
              <TextArea label="Motivo del cambio" name="changeReason" />
            </>
          ) : null}
        </div>
      </section>

      <div className="form-footer">
        <Link className="button" href={changeId ? `/changes/${changeId}` : "/changes"}>Cancelar</Link>
        <button className="button primary" type="submit" disabled={pending}>
          {pending ? "Guardando…" : draft ? "Guardar borrador" : mode === "create" ? "Guardar Control de Cambio" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
