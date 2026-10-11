"use client";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";

import Link from "next/link";
import { submittedDefaults } from "@/lib/forms/preserved-state";
import { ControlledBusinessCodeField } from "@/components/controlled-business-code-field";
import { useActionState, useEffect, useState } from "react";
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

function FieldIssue({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <small className="field-error">{messages[0]}</small>;
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
  span = "",
  issues,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  span?: string;
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
    <label className={`field span-3 ${issues?.length ? "has-error" : ""}`}>
      <span>{label}{required ? " *" : ""}</span>
      {help ? <small className="muted-note">{help}</small> : null}
      <textarea name={name} defaultValue={defaultValue ?? ""} required={required} aria-invalid={issues?.length ? true : undefined} />
      <FieldIssue messages={issues} />
    </label>
  );
}

function BooleanSelect({
  label,
  name,
  defaultValue,
  required = false,
  issues,
}: {
  label: string;
  name: string;
  defaultValue?: "" | "true" | "false";
  required?: boolean;
  issues?: string[];
}) {
  return (
    <label className={`field ${issues?.length ? "has-error" : ""}`}>
      <span>{label}{required ? " *" : ""}</span>
      <select name={name} defaultValue={defaultValue ?? ""} required={required} aria-invalid={issues?.length ? true : undefined}>
        <option value="">No informado</option>
        <option value="true">Sí</option>
        <option value="false">No</option>
      </select>
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
  defaultValue?: "YES" | "NO" | "NA";
  required?: boolean;
  issues?: string[];
}) {
  return (
    <label className={`field ${issues?.length ? "has-error" : ""}`}>
      <span>{label}{required ? " *" : ""}</span>
      <select name={name} defaultValue={defaultValue ?? ""} required={required} aria-invalid={issues?.length ? true : undefined}>
        <option value="">No informado</option>
        <option value="YES">Sí</option>
        <option value="NO">No</option>
        <option value="NA">No aplica</option>
      </select>
      <FieldIssue messages={issues} />
    </label>
  );
}

export function ChangeControlForm({
  mode,
  action,
  departments,
  defaults = {},
  changeId,
  cancelHref,
  returnTo,
  detailTab,
  baselineLocked = false,
}: {
  mode: "create" | "edit";
  action: (state: ChangeControlFormState, formData: FormData) => Promise<ChangeControlFormState>;
  departments: Department[];
  defaults?: ChangeControlFormDefaults;
  changeId?: string;
  cancelHref?: string;
  returnTo?: string;
  detailTab?: string;
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
  const issues = state.fieldIssues ?? {};

  useEffect(() => {
    if (!state.formRevision || !Object.keys(issues).length) return;
    window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(
        '.record-form [aria-invalid="true"], .record-form [data-error-anchor="true"]',
      );
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        target.focus({ preventScroll: true });
      }
    });
  }, [state.formRevision, issues]);

  const updateTask = (index: number, patch: Partial<ChangeTaskInput>) => {
    setTasks((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  return (
    <form key={state.formRevision ?? 0} action={formAction} className="record-form">
    <UnsavedChangesGuard pending={pending} saveError={Boolean(state.error)} />
      <input type="hidden" name="returnTo" value={returnTo ?? ""}/>
    <input type="hidden" name="detailTab" value={detailTab ?? ""}/>
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

          <div className={`field span-3 ${issues.scope?.length ? "has-error" : ""}`} data-error-anchor={issues.scope?.length ? "true" : undefined}>
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
            <FieldIssue messages={issues.scope} />
          </div>
          <Field label="Especificar Otros" name="otherScope" defaultValue={formDefaults.otherScope} issues={issues.otherScope} />
          <Field label="Nombre y apellidos del solicitante" name="requesterName" defaultValue={formDefaults.requesterName} required={!draft} span="span-2" issues={issues.requesterName} />
          <Field label="Puesto" name="requesterPosition" defaultValue={formDefaults.requesterPosition} required={!draft} span="span-2" issues={issues.requesterPosition} />
          <TextArea label="Descripción del cambio" name="description" defaultValue={formDefaults.description} required={!draft} issues={issues.description} />
          <TextArea label="Justificación del cambio" name="justification" defaultValue={formDefaults.justification} required={!draft} issues={issues.justification} />
          <TextArea label="Relación de documentos que se aportan" name="providedDocuments" defaultValue={formDefaults.providedDocuments} required={!draft} help="Si no se aportan documentos, indique No aplica." issues={issues.providedDocuments} />
          <label className="field">
            <span>Solicitud</span>
            <select name="requestDecision" defaultValue={formDefaults.requestDecision ?? "PENDING"}>
              <option value="PENDING">Pendiente</option>
              <option value="ACCEPTED">Aceptada</option>
              <option value="DENIED">Denegada</option>
            </select>
          </label>
          <Field label="Responsable de dictamen" name="requestDecisionResponsible" defaultValue={formDefaults.requestDecisionResponsible} issues={issues.requestDecisionResponsible} />
          <Field label="Cargo / función" name="requestDecisionRole" defaultValue={formDefaults.requestDecisionRole} issues={issues.requestDecisionRole} />
          <Field label="Fecha aceptación/denegación" name="requestDecisionDate" type="date" defaultValue={formDefaults.requestDecisionDate} issues={issues.requestDecisionDate} />
        </div>
      </section>

      <section className="form-section">
        <h2>2. Dictamen del cambio · Anexo IV</h2>
        <p className="section-help">
          El Dictamen aprobado constituye la línea base. Una vez aprobado, sus acciones quedan bloqueadas; las nuevas tareas se añaden desde los seguimientos.
        </p>
        <div className="form-grid">
          <TextArea label="Evaluación del cambio" name="evaluation" defaultValue={formDefaults.evaluation} required={!draft} issues={issues.evaluation} />
          <label className="field">
            <span>Clasificación{draft ? "" : " *"}</span>
            <select name="classification" defaultValue={formDefaults.classification ?? ""} required={!draft}>
              <option value="">Pendiente</option>
              <option value="MAJOR">Mayor</option>
              <option value="MINOR">Menor</option>
            </select>
          </label>
          <Field label="Fecha prevista de implementación" name="plannedImplementationDate" type="date" defaultValue={formDefaults.plannedImplementationDate} required={!draft} issues={issues.plannedImplementationDate} />
        </div>

        <h3>2.a Implicación del cambio y requisitos</h3>
        <div className="change-implication-list">
          <div className="change-implication-row">
            <div className="change-implication-question">
              <BooleanSelect label="¿Comité de cambios?" name="committeeRequired" defaultValue={formDefaults.committeeRequired} required={!draft} issues={issues.committeeRequired} />
            </div>
            <div className="change-implication-answer">
              <Field label="Justificación y personal implicado" name="committeeDetails" defaultValue={formDefaults.committeeDetails} issues={issues.committeeDetails} />
            </div>
          </div>

          <div className="change-implication-row">
            <div className="change-implication-question">
              <BooleanSelect label="¿Informar a cliente?" name="clientNotificationRequired" defaultValue={formDefaults.clientNotificationRequired} required={!draft} issues={issues.clientNotificationRequired} />
            </div>
            <div className="change-implication-answer">
              <Field label="Justificación, fecha y evidencia cliente" name="clientNotificationDetails" defaultValue={formDefaults.clientNotificationDetails} issues={issues.clientNotificationDetails} />
            </div>
          </div>

          <div className="change-implication-row">
            <div className="change-implication-question">
              <BooleanSelect label="¿Autoridad sanitaria?" name="authorityRequired" defaultValue={formDefaults.authorityRequired} required={!draft} issues={issues.authorityRequired} />
            </div>
            <div className="change-implication-answer">
              <Field label="Justificación sobre autoridad" name="authorityDetails" defaultValue={formDefaults.authorityDetails} issues={issues.authorityDetails} />
            </div>
          </div>

          <div className="change-implication-row">
            <div className="change-implication-question">
              <TriStateSelect label="¿Reflejar en PQR?" name="pqrRequired" defaultValue={formDefaults.pqrRequired} required={!draft} issues={issues.pqrRequired} />
            </div>
            <div className="change-implication-answer change-pqr-answer">
              <Field label="Producto(s)" name="pqrProducts" defaultValue={formDefaults.pqrProducts} issues={issues.pqrProducts} />
              <Field label="Periodo" name="pqrPeriod" defaultValue={formDefaults.pqrPeriod} issues={issues.pqrPeriod} />
            </div>
          </div>

          <div className="change-implication-row">
            <div className="change-implication-question">
              <TriStateSelect label="¿Lotes a estabilidad?" name="stabilityRequired" defaultValue={formDefaults.stabilityRequired} required={!draft} issues={issues.stabilityRequired} />
            </div>
            <div className="change-implication-answer">
              <div className="field">
                <span>Tipo de estabilidad</span>
                <div className="checkbox-group">
                  <label><input type="checkbox" name="stabilityAccelerated" defaultChecked={formDefaults.stabilityAccelerated} /> Acelerada</label>
                  <label><input type="checkbox" name="stabilityOngoing" defaultChecked={formDefaults.stabilityOngoing} /> En curso</label>
                </div>
              </div>
            </div>
          </div>

          <div className="change-implication-row">
            <div className="change-implication-question">
              <TriStateSelect label="¿Análisis adicionales?" name="additionalAnalysisRequired" defaultValue={formDefaults.additionalAnalysisRequired} required={!draft} issues={issues.additionalAnalysisRequired} />
            </div>
            <div className="change-implication-answer">
              <Field label="Justificación de análisis" name="additionalAnalysisDetails" defaultValue={formDefaults.additionalAnalysisDetails} issues={issues.additionalAnalysisDetails} />
            </div>
          </div>

          <div className="change-implication-row">
            <div className="change-implication-question">
              <TriStateSelect label="¿Validación adicional?" name="additionalValidationRequired" defaultValue={formDefaults.additionalValidationRequired} required={!draft} issues={issues.additionalValidationRequired} />
            </div>
            <div className="change-implication-answer">
              <Field label="Justificación de validación" name="additionalValidationDetails" defaultValue={formDefaults.additionalValidationDetails} issues={issues.additionalValidationDetails} />
            </div>
          </div>

          <div className="change-implication-row">
            <div className="change-implication-question">
              <BooleanSelect label="¿Otras implicaciones?" name="otherImplicationRequired" defaultValue={formDefaults.otherImplicationRequired} required={!draft} issues={issues.otherImplicationRequired} />
            </div>
            <div className="change-implication-answer">
              <Field label="Justificación de otras implicaciones" name="otherImplicationDetails" defaultValue={formDefaults.otherImplicationDetails} issues={issues.otherImplicationDetails} />
            </div>
          </div>
        </div>

        <h3>Plan de ejecución</h3>
        {baselineLocked ? (
          <div className="analytics-note">
            <strong>Baseline aprobado bloqueado.</strong> Las acciones del Dictamen ya no pueden modificarse. Las acciones adicionales deben incorporarse en un seguimiento y quedarán identificadas como nuevas.
          </div>
        ) : null}
        <div className={`dynamic-list ${issues.tasks?.length ? "has-error" : ""}`} data-error-anchor={issues.tasks?.length ? "true" : undefined}>
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
          <FieldIssue messages={issues.tasks} />
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
          <Field label="Fecha del dictamen" name="dictamenDate" type="date" defaultValue={formDefaults.dictamenDate} required={!draft && dictamenResult !== "PENDING"} issues={issues.dictamenDate} />
          <Field label="Fecha del próximo seguimiento" name="nextFollowupDate" type="date" defaultValue={formDefaults.nextFollowupDate} required={!draft && dictamenResult === "APPROVED"} issues={issues.nextFollowupDate} />
          <Field label="Responsable de seguimiento" name="followupResponsible" defaultValue={formDefaults.followupResponsible} required={!draft && dictamenResult === "APPROVED"} span="span-2" issues={issues.followupResponsible} />
          <TextArea label="Observaciones" name="dictamenObservations" defaultValue={formDefaults.dictamenObservations} required={!draft && dictamenResult !== "PENDING"} issues={issues.dictamenObservations} />
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
        <Link className="button" href={cancelHref ?? (changeId ? `/changes/${changeId}` : "/changes")}>Cancelar</Link>
        <button className="button primary" type="submit" disabled={pending}>
          {pending ? "Guardando…" : draft ? "Guardar borrador" : mode === "create" ? "Guardar Control de Cambio" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
