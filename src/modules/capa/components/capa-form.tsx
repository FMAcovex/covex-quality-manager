"use client";
import { RootCauseCategoryField } from "@/components/root-cause-category-field";
import { usePresentationAccess, PermissionGate } from "@/components/permissions";
import { CsrfField } from "@/components/csrf";

import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { InvalidFieldsSummary } from "@/components/invalid-fields-summary";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { BulletTextField } from "@/components/bullet-textarea";
import { TextTablesFields } from "@/components/text-tables-editor";

import { submittedDefaults } from "@/lib/forms/preserved-state";
import { ResponsibleUserPicker } from "@/components/responsible-user-select";
import type { AppUserOption } from "@/lib/qms/responsible-user";
import { ControlledBusinessCodeField } from "@/components/controlled-business-code-field";
import { CapaOriginSelector } from "@/modules/capa/components/capa-origin-selector";
import type {
  CapaActionFollowupInput,
  CapaFormDefaults,
  CapaFormState,
  CapaOriginInput,
  CapaPlannedActionInput,
} from "@/modules/capa/types";
import { initialFieldTables, type TextTable } from "@/lib/forms/text-tables";
import { CAPA_TABLE_FIELDS } from "../text-tables";

type Department = { id: string; code: string; name: string };

const initialState: CapaFormState = { error: null };
const emptyAction: CapaPlannedActionInput = {
  description: "",
  responsible: "",
  plannedExecutionDate: "",
  impact: "",
};
const emptyActionFollowup: CapaActionFollowupInput = {
  followupDate: "",
  description: "",
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
  help,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  span?: string;
  issues?: string[];
  help?: string;
}) {
  return (
    <label className={`field ${span} ${issues?.length ? "has-error" : ""}`}>
      <span>{label}{required ? " *" : ""}</span>
      {help ? <small className="muted-note">{help}</small> : null}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        aria-invalid={issues?.length ? true : undefined}
      />
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
  span = "span-3",
  tables,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  help?: string;
  required?: boolean;
  issues?: string[];
  span?: string;
  tables?: TextTable[];
}) {
  return (
    <BulletTextField
      tables={tables}
      className={`field ${span} ${issues?.length ? "has-error" : ""}`}
      label={label}
      help={help ? <small className="muted-note">{help}</small> : null}
      name={name}
      defaultValue={defaultValue ?? ""}
      required={required}
      aria-invalid={issues?.length ? true : undefined}
    >
      {issues?.length ? <FieldIssue messages={issues} /> : null}
    </BulletTextField>
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
  users = [],
  defaults = {},
  capaId,
  cancelHref,
  returnTo,
  detailTab,
  qmsRecordId,
  fromDeviationPlanId,
  fromComplaintPlanId,
  fromComplaintId,
  fromAuditFindingId,
}: {
  mode: "create" | "edit";
  action: (state: CapaFormState, formData: FormData) => Promise<CapaFormState>;
  departments: Department[];
  users?: AppUserOption[];
  defaults?: CapaFormDefaults;
  capaId?: string;
  cancelHref?: string;
  returnTo?: string;
  detailTab?: string;
  qmsRecordId?: string;
  fromDeviationPlanId?: string;
  fromComplaintPlanId?: string;
  fromComplaintId?: string;
  /** R5B2: alta desde un hallazgo de auditoría; al guardar queda atribuida. */
  fromAuditFindingId?: string;
}) {
  const access = usePresentationAccess();
  const [state, formAction, pending] = useActionState(action, initialState);
  const formDefaults = submittedDefaults(defaults, state.submittedValues);
  // D-127: tablas de cada texto; tras un error de guardado, las que se enviaron.
  const tablesFor = (field: (typeof CAPA_TABLE_FIELDS)[number]) => initialFieldTables(field, state.submittedValues, defaults?.textTables);

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
  const [effectivenessStatus, setEffectivenessStatus] = useState<
    "CONFORMING" | "NONCONFORMING" | "PENDING" | "NA"
  >(formDefaults.effectivenessStatus ?? "PENDING");
  const [nextFollowupDate, setNextFollowupDate] = useState(formDefaults.nextFollowupDate ?? "");

  const draft = recordStatus === "DRAFT";
  const draftExisting = mode === "edit" && defaults.status === "DRAFT";
  const nextFollowupRequired =
    !draft &&
    !(
      recordStatus === "CLOSED" &&
      (effectivenessStatus === "CONFORMING" || effectivenessStatus === "NONCONFORMING")
    );
  const issues = state.fieldIssues ?? {};

  useEffect(() => {
    if (!state.submittedValues) return;
    setActions(parseSubmittedArray(state.submittedValues.plannedActionsJson, actions));
    setActionFollowups(parseSubmittedArray(state.submittedValues.actionFollowupsJson, actionFollowups));
    setOrigins(parseSubmittedArray(state.submittedValues.originsJson, origins));
    if (typeof state.submittedValues.actionType === "string") {
      setActionType(state.submittedValues.actionType as "CORRECTIVE" | "PREVENTIVE");
    }
    if (typeof state.submittedValues.departmentId === "string") {
      setDepartmentId(state.submittedValues.departmentId);
    }
    if (typeof state.submittedValues.openedAt === "string") {
      setOpenedAt(state.submittedValues.openedAt);
    }
    if (typeof state.submittedValues.status === "string") {
      setRecordStatus(state.submittedValues.status as typeof recordStatus);
    }
    if (typeof state.submittedValues.effectivenessStatus === "string") {
      setEffectivenessStatus(state.submittedValues.effectivenessStatus as typeof effectivenessStatus);
    }
    if (typeof state.submittedValues.nextFollowupDate === "string") {
      setNextFollowupDate(state.submittedValues.nextFollowupDate);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.formRevision]);

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

  const updateAction = (index: number, patch: Partial<CapaPlannedActionInput>) => {
    setActions((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));
  };

  const updateActionFollowup = (index: number, patch: Partial<CapaActionFollowupInput>) => {
    setActionFollowups((current) =>
      current.map((item, i) => i === index ? { ...item, ...patch } : item),
    );
  };

  return (
    <form key={state.formRevision ?? 0} action={formAction} className="record-form"><CsrfField />
    <UnsavedChangesGuard pending={pending} saveError={Boolean(state.error)} />
    <InvalidFieldsSummary />
      <input type="hidden" name="returnTo" value={returnTo ?? ""}/>
    <input type="hidden" name="detailTab" value={detailTab ?? ""}/>
      <input type="hidden" name="plannedActionsJson" value={JSON.stringify(actions)} />
      <input type="hidden" name="actionFollowupsJson" value={JSON.stringify(actionFollowups)} />
      <input type="hidden" name="originsJson" value={JSON.stringify(origins)} />
      <input type="hidden" name="cancellationReason" value={formDefaults.cancellationReason ?? ""} />
      {fromDeviationPlanId ? <input type="hidden" name="fromDeviationPlanId" value={fromDeviationPlanId} /> : null}
      {fromComplaintPlanId ? <input type="hidden" name="fromComplaintPlanId" value={fromComplaintPlanId} /> : null}
      {fromComplaintId ? <input type="hidden" name="fromComplaintId" value={fromComplaintId} /> : null}
      {fromAuditFindingId ? <input type="hidden" name="fromAuditFindingId" value={fromAuditFindingId} /> : null}

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
        <p className="section-help">La CAPA debe mantener trazabilidad con todos los expedientes que la originan.</p>
        <div className="form-grid">
          <label className="field">
            <span>Tipo CAPA *</span>
            <select
              name="actionType"
              value={actionType}
              onChange={(event) => setActionType(event.target.value as "CORRECTIVE" | "PREVENTIVE")}
            >
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
            <select
              name="departmentId"
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
              required={!draft}
              aria-invalid={issues.departmentId?.length ? true : undefined}
            >
              <option value="">Seleccionar…</option>
              {departments.filter(d => access?.departments[d.id]).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.code} — {department.name}
                </option>
              ))}
            </select>
            <FieldIssue messages={issues.departmentId} />
          </label>

          <label className={`field ${issues.openedAt?.length ? "has-error" : ""}`}>
            <span>Fecha apertura{draft ? "" : " *"}</span>
            <input
              name="openedAt"
              type="date"
              value={openedAt}
              onChange={(event) => setOpenedAt(event.target.value)}
              required={!draft}
              aria-invalid={issues.openedAt?.length ? true : undefined}
            />
            <FieldIssue messages={issues.openedAt} />
          </label>

          {mode === "edit" && !draftExisting ? (
            <Field
              label="Fecha del seguimiento"
              name="versionFollowupDate"
              type="date"
              defaultValue={formDefaults.versionFollowupDate}
              help="Solo se utiliza al pulsar Guardar como nuevo seguimiento. El Seguimiento 00 utiliza la fecha de apertura."
              issues={issues.versionFollowupDate}
            />
          ) : null}

          <Field
            label="Cumplimentado por"
            name="createdByText"
            defaultValue={formDefaults.createdByText}
            required={!draft}
            issues={issues.createdByText}
          />
          {mode === "edit" ? (
            <Field
              label="Modificado por"
              name="modifiedByText"
              defaultValue={access?.actor ?? ""}
            />
          ) : null}

          <CapaOriginSelector
            value={origins}
            onChange={setOrigins}
            currentRecordId={qmsRecordId}
          />
          {issues.originsJson?.length ? (
            <div className="field-error-block span-3" data-error-anchor="true">
              <FieldIssue messages={issues.originsJson} />
            </div>
          ) : null}
        </div>
      </section>

      <section className="form-section">
        <h2>2. Defecto y causa raíz</h2>
        <div className="form-grid">
          <Field
            label="Materia / material / producto / sistema / equipo"
            name="applicableTo"
            defaultValue={formDefaults.applicableTo}
            span="span-3"
            required={!draft}
            issues={issues.applicableTo}
          />
          <TextArea tables={tablesFor("defectDescription")}
            label="Descripción breve del defecto"
            name="defectDescription"
            defaultValue={formDefaults.defectDescription}
            required={!draft}
            issues={issues.defectDescription}
          />
          <TextArea tables={tablesFor("rootCause")}
            label="Causa raíz"
            name="rootCause"
            defaultValue={formDefaults.rootCause}
            required={!draft}
            issues={issues.rootCause}
          />
          <RootCauseCategoryField defaultValue={formDefaults.rootCauseCategories} />
        </div>
      </section>

      <section className="form-section">
        <h2>3. Acción propuesta</h2>
        <p className="section-help">Define las acciones propuestas con responsable y fecha prevista cuando corresponda.</p>
        {issues.plannedActionsJson?.length ? (
          <div className="field-error-block" data-error-anchor="true">
            <FieldIssue messages={issues.plannedActionsJson} />
          </div>
        ) : null}

        <div className="dynamic-list capa-action-list">
          {actions.map((item, index) => (
            <div className="capa-action-card" key={index}>
              <div className="capa-action-card-header">
                <strong>Acción {String(index + 1).padStart(2, "0")}</strong>
                <button
                  type="button"
                  className="button danger small"
                  onClick={() => setActions((current) => current.filter((_, i) => i !== index))}
                >
                  Quitar
                </button>
              </div>
              <div className="capa-action-grid">
                <label className="field capa-action-description">
                  <span>Descripción{draft ? "" : " *"}</span>
                  <textarea
                    required={!draft}
                    value={item.description}
                    onChange={(event) => updateAction(index, { description: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Responsable</span>
                  <input
                    value={item.responsible}
                    onChange={(event) => updateAction(index, { responsible: event.target.value })}
                  />
                </label>
                <ResponsibleUserPicker users={users} value={item.responsibleUserId} text={item.responsible} onChange={({ userId, text }) => updateAction(index, { responsibleUserId: userId || null, responsible: text })} />
                <label className="field">
                  <span>Fecha prevista</span>
                  <input
                    type="date"
                    value={item.plannedExecutionDate}
                    onChange={(event) => updateAction(index, { plannedExecutionDate: event.target.value })}
                  />
                </label>
                <label className="field capa-action-impact">
                  <span>Impacto sobre otras áreas / registro</span>
                  <textarea
                    value={item.impact}
                    onChange={(event) => updateAction(index, { impact: event.target.value })}
                  />
                </label>
              </div>
            </div>
          ))}
          <div>
            <button
              type="button"
              className="button small"
              onClick={() => setActions((current) => [...current, { ...emptyAction }])}
            >
              + Añadir acción propuesta
            </button>
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2>4. Seguimiento de la acción</h2>
        <p className="section-help">
          Estas actuaciones forman parte del contenido del expediente y de su snapshot; no son los Seguimientos 00/01/02.
        </p>
        {issues.actionFollowupsJson?.length ? (
          <div className="field-error-block" data-error-anchor="true">
            <FieldIssue messages={issues.actionFollowupsJson} />
          </div>
        ) : null}

        <div className="dynamic-list capa-action-list">
          {actionFollowups.map((item, index) => (
            <div className="capa-action-card compact" key={index}>
              <div className="capa-action-card-header">
                <strong>Seguimiento de acción {String(index + 1).padStart(2, "0")}</strong>
                <button
                  type="button"
                  className="button danger small"
                  onClick={() =>
                    setActionFollowups((current) => current.filter((_, i) => i !== index))
                  }
                >
                  Quitar
                </button>
              </div>
              <div className="capa-followup-grid">
                <label className="field">
                  <span>Fecha</span>
                  <input
                    type="date"
                    value={item.followupDate}
                    onChange={(event) =>
                      updateActionFollowup(index, { followupDate: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Descripción</span>
                  <textarea
                    value={item.description}
                    onChange={(event) =>
                      updateActionFollowup(index, { description: event.target.value })
                    }
                  />
                </label>
              </div>
              <TextTablesFields
                fieldLabel={`Seguimiento de acción ${String(index + 1).padStart(2, "0")}`}
                tables={item.tables ?? []}
                setTables={(change) =>
                  setActionFollowups((current) => current.map((row, i) => (i === index ? { ...row, tables: change(row.tables ?? []) } : row)))
                }
              />
            </div>
          ))}
          <div>
            <button
              type="button"
              className="button small"
              onClick={() =>
                setActionFollowups((current) => [...current, { ...emptyActionFollowup }])
              }
            >
              + Añadir seguimiento
            </button>
          </div>
        </div>

        <div className="form-grid capa-section-body">
          <TextArea tables={tablesFor("actionFollowupObservations")}
            label="Observaciones"
            name="actionFollowupObservations"
            defaultValue={formDefaults.actionFollowupObservations}
            required={!draft}
            issues={issues.actionFollowupObservations}
          />
        </div>
      </section>

      <section className="form-section">
        <h2>6. Estado operativo</h2>
        <div className="form-grid">
          <label className="field">
            <span>Estado *</span>
            <select
              name="status"
              value={recordStatus}
              onChange={(event) => setRecordStatus(event.target.value as typeof recordStatus)}
            >
              {(mode === "create" || draftExisting) ? <option value="DRAFT">Borrador</option> : null}
              <option value="OPEN">Abierta</option>
              <PermissionGate permission="CLOSE"><option value="CLOSED">Cerrada</option></PermissionGate>
              <PermissionGate permission="ANNUL"><option value="CANCELLED">Cancelada</option></PermissionGate>
            </select>
          </label>

          <Field
            label="Fecha de cierre y ejecución"
            name="operationalClosedAt"
            type="date"
            defaultValue={formDefaults.operationalClosedAt}
            required={!draft && recordStatus === "CLOSED"}
            issues={issues.operationalClosedAt}
          />

          <TextArea tables={tablesFor("operationalStatusDescription")}
            label="Estado"
            name="operationalStatusDescription"
            defaultValue={formDefaults.operationalStatusDescription}
            required={!draft}
            issues={issues.operationalStatusDescription}
            help="Describe la situación operativa de la acción (en curso, completada o cancelada y su justificación cuando proceda)."
          />
        </div>
      </section>

      <section className="form-section">
        <h2>5. Evaluación de la eficacia</h2>
        <div className="form-grid">
          <label className="field">
            <span>Verificación de la eficacia *</span>
            <select
              name="effectivenessStatus"
              value={effectivenessStatus}
              onChange={(event) =>
                setEffectivenessStatus(event.target.value as typeof effectivenessStatus)
              }
            >
              <option value="PENDING">Pendiente</option>
              <option value="CONFORMING">Conforme</option>
              <option value="NONCONFORMING">No conforme</option>
              <option
                value="NA"
                disabled={mode === "create" || defaults.effectivenessStatus !== "NA"}
              >
                N/A (solo histórico)
              </option>
            </select>
          </label>

          <Field
            label="Fecha de verificación final"
            name="effectiveClosedAt"
            type="date"
            defaultValue={formDefaults.effectiveClosedAt}
            required={!draft && effectivenessStatus === "CONFORMING"}
            issues={issues.effectiveClosedAt}
          />

          <TextArea tables={tablesFor("effectivenessAssessment")}
            label="Evaluación de la eficacia"
            name="effectivenessAssessment"
            defaultValue={formDefaults.effectivenessAssessment}
            required={!draft}
            issues={issues.effectivenessAssessment}
          />
        </div>
      </section>

      <section className="form-section">
        <h2>7. Conclusión</h2>
        <div className="form-grid">
          <TextArea tables={tablesFor("conclusion")}
            label="Conclusión / cierre"
            name="conclusion"
            defaultValue={formDefaults.conclusion}
            required={!draft}
            issues={issues.conclusion}
          />

          <label className={`field span-2 ${issues.nextFollowupDate?.length ? "has-error" : ""}`}>
            <span>
              {recordStatus === "CLOSED" && effectivenessStatus === "PENDING"
                ? "Fecha prevista de verificación de eficacia (próximo seguimiento)"
                : "Fecha de próximo seguimiento"}
              {nextFollowupRequired ? " *" : ""}
            </span>
            <small className="muted-note">
              En edición se solicita una nueva fecha para evitar reutilizar automáticamente la del seguimiento anterior.
            </small>
            <input
              name="nextFollowupDate"
              type="date"
              value={nextFollowupDate}
              onChange={(event) => setNextFollowupDate(event.target.value)}
              required={nextFollowupRequired}
              aria-invalid={issues.nextFollowupDate?.length ? true : undefined}
            />
            <FieldIssue messages={issues.nextFollowupDate} />
          </label>
        </div>
      </section>

      <section className="form-section">
        <h2>Control interno</h2>
        <div className="form-grid">
          <TextArea tables={tablesFor("internalObservations")}
            label="Observaciones internas"
            name="internalObservations"
            defaultValue={formDefaults.internalObservations}
            issues={issues.internalObservations}
          />

          <label className="field">
            <span>Control del dato</span>
            <select
              name="dataQualityStatus"
              defaultValue={formDefaults.dataQualityStatus ?? "REVIEW_REQUIRED"}
            >
              <option value="COMPLETE">Completo</option>
              <option value="INCOMPLETE">Incompleto</option>
              <option value="REVIEW_REQUIRED">Pendiente de revisar</option>
            </select>
          </label>

          {(
            <TextArea
              label="Motivo de la actuación / nuevo seguimiento"
              name="changeReason"
              help="Obligatorio para un nuevo seguimiento y cuando se solicite al guardar una corrección o cierre."
              issues={issues.changeReason}
            />
          )}
        </div>
      </section>

      <div className="form-footer">
        <Link className="button" href={cancelHref ?? (capaId ? `/capa/${capaId}` : "/capa")}>
          Cancelar
        </Link>

        <div className="form-footer-actions">
          {(mode === "create" || draftExisting) ? (
            <button
              type="submit"
              name="saveIntent"
              value="SAVE_DRAFT"
              className="button"
              formNoValidate
              disabled={pending}
            >
              {pending ? "Guardando…" : "Guardar borrador"}
            </button>
          ) : null}

          <button
            type="submit"
            name="saveIntent"
            value="UPDATE_CURRENT"
            className="button primary"
            disabled={pending}
          >
            {pending ? "Guardando…" : "Guardar CAPA"}
          </button>

          {mode === "edit" && !draftExisting ? (
            <button
              type="submit"
              name="saveIntent"
              value="CREATE_FOLLOWUP_VERSION"
              className="button"
              disabled={pending}
            >
              {pending ? "Guardando…" : "Guardar como nuevo seguimiento"}
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}
