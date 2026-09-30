"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { submittedDefaults } from "@/lib/forms/preserved-state";
import { ControlledBusinessCodeField } from "@/components/controlled-business-code-field";
import { CapaOriginSelector } from "@/modules/capa/components/capa-origin-selector";
import type {
  CapaActionFollowupInput,
  CapaFormDefaults,
  CapaFormState,
  CapaOriginInput,
  CapaPlannedActionInput,
} from "@/modules/capa/types";

type Department = { id: string; code: string; name: string };

const initialState: CapaFormState = { error: null };
const emptyAction: CapaPlannedActionInput = { description: "", responsible: "", plannedExecutionDate: "", impact: "" };
const emptyActionFollowup: CapaActionFollowupInput = { followupDate: "", description: "" };

function FieldIssue({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <small className="field-error">{messages[0]}</small>;
}

function Field({
  label, name, defaultValue, type = "text", required = false, span = "", issues,
}: {
  label: string; name: string; defaultValue?: string; type?: string; required?: boolean; span?: string; issues?: string[];
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
  label, name, defaultValue, help, required = false, issues,
}: {
  label: string; name: string; defaultValue?: string; help?: string; required?: boolean; issues?: string[];
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

function parseSubmittedArray<T>(raw: string | string[] | undefined, fallback: T[]) {
  if (typeof raw !== "string") return fallback;
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value as T[] : fallback;
  } catch {
    return fallback;
  }
}

export function CapaForm({
  mode,
  action,
  departments,
  defaults = {},
  capaId,
  qmsRecordId,
  fromDeviationPlanId,
  fromComplaintPlanId,
  fromComplaintId,
}: {
  mode: "create" | "edit";
  action: (state: CapaFormState, formData: FormData) => Promise<CapaFormState>;
  departments: Department[];
  defaults?: CapaFormDefaults;
  capaId?: string;
  qmsRecordId?: string;
  fromDeviationPlanId?: string;
  fromComplaintPlanId?: string;
  fromComplaintId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formDefaults = submittedDefaults(defaults, state.submittedValues);
  const [actions, setActions] = useState<CapaPlannedActionInput[]>(
    defaults.plannedActions?.length ? defaults.plannedActions : [{ ...emptyAction }],
  );
  const [actionFollowups, setActionFollowups] = useState<CapaActionFollowupInput[]>(
    defaults.actionFollowups ?? [],
  );
  const [origins, setOrigins] = useState<CapaOriginInput[]>(defaults.origins ?? []);
  const [actionType, setActionType] = useState<"CORRECTIVE" | "PREVENTIVE">(
    (formDefaults.actionType as "CORRECTIVE" | "PREVENTIVE" | undefined) ?? "CORRECTIVE",
  );
  const [departmentId, setDepartmentId] = useState(formDefaults.departmentId ?? "");
  const [openedAt, setOpenedAt] = useState(formDefaults.openedAt ?? "");
  const [recordStatus, setRecordStatus] = useState<"DRAFT" | "OPEN" | "CLOSED" | "CANCELLED">(
    formDefaults.status ?? (mode === "create" ? "DRAFT" : "OPEN"),
  );
  const [effectivenessStatus, setEffectivenessStatus] = useState<"CONFORMING" | "NONCONFORMING" | "PENDING" | "NA">(
    formDefaults.effectivenessStatus ?? "PENDING",
  );
  const draft = recordStatus === "DRAFT";
  const draftExisting = mode === "edit" && defaults.status === "DRAFT";
  const issues = state.fieldIssues ?? {};

  useEffect(() => {
    if (!state.submittedValues) return;
    setActions(parseSubmittedArray(state.submittedValues.plannedActionsJson, actions));
    setActionFollowups(parseSubmittedArray(state.submittedValues.actionFollowupsJson, actionFollowups));
    setOrigins(parseSubmittedArray(state.submittedValues.originsJson, origins));
    if (typeof state.submittedValues.actionType === "string") setActionType(state.submittedValues.actionType as "CORRECTIVE" | "PREVENTIVE");
    if (typeof state.submittedValues.departmentId === "string") setDepartmentId(state.submittedValues.departmentId);
    if (typeof state.submittedValues.openedAt === "string") setOpenedAt(state.submittedValues.openedAt);
    if (typeof state.submittedValues.status === "string") setRecordStatus(state.submittedValues.status as typeof recordStatus);
    if (typeof state.submittedValues.effectivenessStatus === "string") setEffectivenessStatus(state.submittedValues.effectivenessStatus as typeof effectivenessStatus);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.formRevision]);

  const updateAction = (index: number, patch: Partial<CapaPlannedActionInput>) => {
    setActions((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));
  };
  const updateActionFollowup = (index: number, patch: Partial<CapaActionFollowupInput>) => {
    setActionFollowups((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));
  };

  return (
    <form key={state.formRevision ?? 0} action={formAction} className="record-form">
      <input type="hidden" name="plannedActionsJson" value={JSON.stringify(actions)} />
      <input type="hidden" name="actionFollowupsJson" value={JSON.stringify(actionFollowups)} />
      <input type="hidden" name="originsJson" value={JSON.stringify(origins)} />
      {fromDeviationPlanId ? <input type="hidden" name="fromDeviationPlanId" value={fromDeviationPlanId} /> : null}
      {fromComplaintPlanId ? <input type="hidden" name="fromComplaintPlanId" value={fromComplaintPlanId} /> : null}
      {fromComplaintId ? <input type="hidden" name="fromComplaintId" value={fromComplaintId} /> : null}

      {state.error ? (
        <div className="form-errors">
          <strong>{state.error}</strong>
          {state.fieldErrors?.length ? <ul>{state.fieldErrors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
        </div>
      ) : null}

      <section className="form-section">
        <h2>1. Identificación y origen</h2>
        <p className="section-help">La CAPA debe mantener trazabilidad con todos los expedientes que la originan.</p>
        <div className="form-grid">
          <label className="field">
            <span>Tipo CAPA *</span>
            <select name="actionType" value={actionType} onChange={(event) => setActionType(event.target.value as "CORRECTIVE" | "PREVENTIVE")}>
              <option value="CORRECTIVE">Correctiva</option>
              <option value="PREVENTIVE">Preventiva</option>
            </select>
          </label>
          <div className="field span-2">
            <ControlledBusinessCodeField
              recordType="CAPA"
              label="Codificación AC/AP"
              initialValue={formDefaults.businessCode}
              mode={mode}
              yearSource={openedAt}
              departmentId={departmentId}
              actionType={actionType}
              locked={mode === "edit" && !draftExisting}
            />
          </div>
          <label className={`field ${issues.departmentId?.length ? "has-error" : ""}`}>
            <span>Departamento responsable{draft ? "" : " *"}</span>
            <select name="departmentId" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} required={!draft} aria-invalid={issues.departmentId?.length ? true : undefined}>
              <option value="">Seleccionar…</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.code} — {department.name}</option>)}
            </select>
            <FieldIssue messages={issues.departmentId} />
          </label>
          <label className={`field ${issues.openedAt?.length ? "has-error" : ""}`}>
            <span>Fecha apertura{draft ? "" : " *"}</span>
            <input name="openedAt" type="date" value={openedAt} onChange={(event) => setOpenedAt(event.target.value)} required={!draft} aria-invalid={issues.openedAt?.length ? true : undefined} />
            <FieldIssue messages={issues.openedAt} />
          </label>
          <Field label="Cumplimentado por" name="createdByText" defaultValue={formDefaults.createdByText} required={!draft} issues={issues.createdByText} />
          {mode === "edit" ? <Field label="Modificado por" name="modifiedByText" defaultValue={formDefaults.createdByText} /> : null}
          <CapaOriginSelector value={origins} onChange={setOrigins} currentRecordId={qmsRecordId} />
          {issues.originsJson?.length ? <div className="field-error-block span-3"><FieldIssue messages={issues.originsJson} /></div> : null}
        </div>
      </section>

      <section className="form-section">
        <h2>2. Defecto y causa raíz</h2>
        <div className="form-grid">
          <Field label="Materia / material / producto / sistema / equipo" name="applicableTo" defaultValue={formDefaults.applicableTo} span="span-3" />
          <TextArea label="Descripción breve del defecto" name="defectDescription" defaultValue={formDefaults.defectDescription} required={!draft} issues={issues.defectDescription} />
          <TextArea label="Causa raíz" name="rootCause" defaultValue={formDefaults.rootCause} required={!draft} issues={issues.rootCause} />
        </div>
      </section>

      <section className="form-section">
        <h2>3. Acción propuesta</h2>
        <p className="section-help">Define las acciones propuestas con responsable y fecha prevista cuando corresponda.</p>
        {issues.plannedActionsJson?.length ? <div className="field-error-block"><FieldIssue messages={issues.plannedActionsJson} /></div> : null}
        <div className="dynamic-list">
          {actions.map((item, index) => (
            <div className="dynamic-row capa capa-full" key={index}>
              <strong>Acción {String(index + 1).padStart(2, "0")}</strong>
              <label className="field"><span>Descripción{draft ? "" : " *"}</span><textarea required={!draft} value={item.description} onChange={(e) => updateAction(index, { description: e.target.value })} /></label>
              <label className="field"><span>Responsable</span><input value={item.responsible} onChange={(e) => updateAction(index, { responsible: e.target.value })} /></label>
              <label className="field"><span>Fecha prevista</span><input type="date" value={item.plannedExecutionDate} onChange={(e) => updateAction(index, { plannedExecutionDate: e.target.value })} /></label>
              <label className="field"><span>Impacto sobre otras áreas / registro</span><textarea value={item.impact} onChange={(e) => updateAction(index, { impact: e.target.value })} /></label>
              <button type="button" className="button danger small" onClick={() => setActions((current) => current.filter((_, i) => i !== index))}>Quitar</button>
            </div>
          ))}
          <div><button type="button" className="button small" onClick={() => setActions((current) => [...current, { ...emptyAction }])}>+ Añadir acción propuesta</button></div>
        </div>
      </section>

      <section className="form-section">
        <h2>4. Seguimiento de la acción</h2>
        <p className="section-help">Estas filas forman parte del contenido del expediente; no crean un nuevo Seguimiento funcional 00/01/02.</p>
        {issues.actionFollowupsJson?.length ? <div className="field-error-block"><FieldIssue messages={issues.actionFollowupsJson} /></div> : null}
        <div className="dynamic-list">
          {actionFollowups.map((item, index) => (
            <div className="dynamic-row capa capa-full" key={index}>
              <strong>Seguimiento de acción {String(index + 1).padStart(2, "0")}</strong>
              <label className="field"><span>Fecha</span><input type="date" value={item.followupDate} onChange={(e) => updateActionFollowup(index, { followupDate: e.target.value })} /></label>
              <label className="field span-2"><span>Descripción</span><textarea value={item.description} onChange={(e) => updateActionFollowup(index, { description: e.target.value })} /></label>
              <button type="button" className="button danger small" onClick={() => setActionFollowups((current) => current.filter((_, i) => i !== index))}>Quitar</button>
            </div>
          ))}
          <div><button type="button" className="button small" onClick={() => setActionFollowups((current) => [...current, { ...emptyActionFollowup }])}>+ Añadir seguimiento</button></div>
        </div>
        <div className="form-grid" style={{ marginTop: 14 }}>
          <TextArea label="Observaciones" name="actionFollowupObservations" defaultValue={formDefaults.actionFollowupObservations} />
        </div>
      </section>

      <section className="form-section">
        <h2>5. Estado y cierre operativo</h2>
        <div className="form-grid">
          <label className="field">
            <span>Estado</span>
            <select name="status" value={recordStatus} onChange={(event) => setRecordStatus(event.target.value as typeof recordStatus)}>
              {(mode === "create" || draftExisting) ? <option value="DRAFT">Borrador</option> : null}
              <option value="OPEN">Abierta</option>
              <option value="CLOSED">Cerrada</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
          </label>
          <Field label="Fecha de próximo seguimiento" name="nextFollowupDate" type="date" defaultValue={formDefaults.nextFollowupDate} issues={issues.nextFollowupDate} />
          <Field label="Fecha de cierre y ejecución" name="operationalClosedAt" type="date" defaultValue={formDefaults.operationalClosedAt} required={recordStatus === "CLOSED"} issues={issues.operationalClosedAt} />
          {recordStatus === "CANCELLED" ? <TextArea label="Motivo de cancelación" name="cancellationReason" defaultValue={formDefaults.cancellationReason} issues={issues.cancellationReason} /> : null}
          <TextArea label="Conclusión / cierre" name="conclusion" defaultValue={formDefaults.conclusion} issues={issues.conclusion} />
        </div>
      </section>

      <section className="form-section">
        <h2>6. Verificación de la eficacia</h2>
        <p className="section-help">El cierre operativo y la verificación de eficacia son conceptos distintos.</p>
        <div className="form-grid">
          <label className="field">
            <span>Estado de eficacia</span>
            <select name="effectivenessStatus" value={effectivenessStatus} onChange={(event) => setEffectivenessStatus(event.target.value as typeof effectivenessStatus)}>
              <option value="PENDING">Pendiente</option>
              <option value="CONFORMING">Conforme</option>
              <option value="NONCONFORMING">No conforme</option>
              <option value="NA" disabled={mode === "create" || defaults.effectivenessStatus !== "NA"}>N/A (solo histórico)</option>
            </select>
          </label>
          <Field
            label="Fecha de verificación final"
            name="effectiveClosedAt"
            type="date"
            defaultValue={formDefaults.effectiveClosedAt}
            required={effectivenessStatus !== "PENDING" && effectivenessStatus !== "NA"}
            issues={issues.effectiveClosedAt}
          />
          <TextArea label="Evaluación de la eficacia" name="effectivenessAssessment" defaultValue={formDefaults.effectivenessAssessment} issues={issues.effectivenessAssessment} />
        </div>
      </section>

      <section className="form-section">
        <h2>Control interno</h2>
        <div className="form-grid">
          <TextArea label="Observaciones internas" name="internalObservations" defaultValue={formDefaults.internalObservations} />
          <label className="field">
            <span>Documento firmado disponible</span>
            <select name="signedDocumentAvailable" defaultValue={formDefaults.signedDocumentAvailable ?? ""}>
              <option value="">No informado</option><option value="true">Sí</option><option value="false">No</option>
            </select>
          </label>
          <label className="field">
            <span>Control del dato</span>
            <select name="dataQualityStatus" defaultValue={formDefaults.dataQualityStatus ?? "REVIEW_REQUIRED"}>
              <option value="COMPLETE">Completo</option><option value="INCOMPLETE">Incompleto</option><option value="REVIEW_REQUIRED">Pendiente de revisar</option>
            </select>
          </label>
          {mode === "edit" ? <TextArea label="Motivo del nuevo seguimiento" name="changeReason" help="Obligatorio solo al guardar como nuevo seguimiento." issues={issues.changeReason} /> : null}
        </div>
      </section>

      <div className="form-footer">
        <Link className="button" href={capaId ? `/capa/${capaId}` : "/capa"}>Cancelar</Link>
        {(mode === "create" || draftExisting) ? (
          <button type="submit" name="saveIntent" value="SAVE_DRAFT" className="button" formNoValidate disabled={pending}>{pending ? "Guardando…" : "Guardar borrador"}</button>
        ) : null}
        <button type="submit" name="saveIntent" value="UPDATE_CURRENT" className="button primary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar CAPA"}
        </button>
        {mode === "edit" && !draftExisting ? (
          <button type="submit" name="saveIntent" value="CREATE_FOLLOWUP_VERSION" className="button" disabled={pending}>
            {pending ? "Guardando…" : "Guardar como nuevo seguimiento"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
