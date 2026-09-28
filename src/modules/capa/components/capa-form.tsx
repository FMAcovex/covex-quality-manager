"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type {
  CapaFormDefaults,
  CapaFormState,
  CapaPlannedActionInput,
} from "@/modules/capa/types";

type Department = { id: string; code: string; name: string };

const initialState: CapaFormState = { error: null };
const emptyAction: CapaPlannedActionInput = {
  description: "",
  responsible: "",
  plannedExecutionDate: "",
  impact: "",
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

export function CapaForm({
  mode,
  action,
  departments,
  defaults = {},
  capaId,
  fromDeviationPlanId,
  fromComplaintPlanId,
  fromComplaintId,
}: {
  mode: "create" | "edit";
  action: (state: CapaFormState, formData: FormData) => Promise<CapaFormState>;
  departments: Department[];
  defaults?: CapaFormDefaults;
  capaId?: string;
  fromDeviationPlanId?: string;
  fromComplaintPlanId?: string;
  fromComplaintId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [actions, setActions] = useState<CapaPlannedActionInput[]>(
    defaults.plannedActions?.length ? defaults.plannedActions : [{ ...emptyAction }],
  );

  const updateAction = (index: number, patch: Partial<CapaPlannedActionInput>) => {
    setActions((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  return (
    <form action={formAction} className="record-form">
      <input type="hidden" name="plannedActionsJson" value={JSON.stringify(actions)} />
      {fromDeviationPlanId ? (
        <input type="hidden" name="fromDeviationPlanId" value={fromDeviationPlanId} />
      ) : null}
      {fromComplaintPlanId ? (
        <input type="hidden" name="fromComplaintPlanId" value={fromComplaintPlanId} />
      ) : null}
      {fromComplaintId ? (
        <input type="hidden" name="fromComplaintId" value={fromComplaintId} />
      ) : null}

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
        <p className="section-help">
          La CAPA debe mantener trazabilidad con el documento que la origina.
        </p>
        <div className="form-grid">
          <Field label="Codificación AC/AP" name="businessCode" defaultValue={defaults.businessCode} required />
          <label className="field">
            <span>Tipo *</span>
            <select name="actionType" defaultValue={defaults.actionType ?? "CORRECTIVE"}>
              <option value="CORRECTIVE">Correctiva</option>
              <option value="PREVENTIVE">Preventiva</option>
            </select>
          </label>
          <label className="field">
            <span>Departamento responsable *</span>
            <select name="departmentId" defaultValue={defaults.departmentId ?? ""} required>
              <option value="">Seleccionar…</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.code} — {department.name}
                </option>
              ))}
            </select>
          </label>
          <Field label="Fecha apertura" name="openedAt" type="date" defaultValue={defaults.openedAt} required />
          <Field label="Cumplimentado por" name="createdByText" defaultValue={defaults.createdByText} required />
          {mode === "edit" ? (
            <Field label="Modificado por" name="modifiedByText" defaultValue={defaults.createdByText} />
          ) : null}
          <label className="field">
            <span>Origen *</span>
            <select name="originType" defaultValue={defaults.originType ?? ""} required>
              <option value="">Seleccionar…</option>
              <option value="Desviación">Desviación</option>
              <option value="Auditoría interna">Auditoría interna</option>
              <option value="Auditoría externa">Auditoría externa</option>
              <option value="Inspección">Inspección</option>
              <option value="Reclamación">Reclamación</option>
              <option value="Devolución">Devolución</option>
              <option value="Fuera de especificación">Fuera de especificación</option>
              <option value="PQR">PQR</option>
              <option value="Otros">Otros</option>
            </select>
          </label>
          <Field label="Codificación de origen" name="originCode" defaultValue={defaults.originCode} span="span-2" />
          <Field label="Materia/material/producto/sistema/equipo" name="applicableTo" defaultValue={defaults.applicableTo} span="span-3" />
        </div>
      </section>

      <section className="form-section">
        <h2>2. Defecto y causa raíz</h2>
        <p className="section-help">
          La descripción y la causa deben coincidir con el documento de origen cuando exista.
        </p>
        <div className="form-grid">
          <TextArea label="Descripción breve del defecto" name="defectDescription" defaultValue={defaults.defectDescription} required />
          <TextArea label="Causa raíz" name="rootCause" defaultValue={defaults.rootCause} required={mode === "create"} />
        </div>
      </section>

      <section className="form-section">
        <h2>3. Acción propuesta</h2>
        <p className="section-help">
          Cada acción debe derivar de la causa raíz, ser verificable y tener responsable y fecha cuando aplique.
        </p>
        <div className="dynamic-list">
          {actions.map((item, index) => (
            <div className="dynamic-row capa capa-full" key={index}>
              <label className="field">
                <span>Descripción de la acción *</span>
                <textarea required value={item.description} onChange={(e) => updateAction(index, { description: e.target.value })} />
              </label>
              <label className="field">
                <span>Responsable</span>
                <input value={item.responsible} onChange={(e) => updateAction(index, { responsible: e.target.value })} />
              </label>
              <label className="field">
                <span>Fecha prevista</span>
                <input type="date" value={item.plannedExecutionDate} onChange={(e) => updateAction(index, { plannedExecutionDate: e.target.value })} />
              </label>
              <label className="field">
                <span>Impacto sobre otras áreas / registro</span>
                <textarea value={item.impact} onChange={(e) => updateAction(index, { impact: e.target.value })} />
              </label>
              <button
                type="button"
                className="button danger small"
                onClick={() => setActions((current) => current.filter((_, i) => i !== index))}
              >
                Quitar
              </button>
            </div>
          ))}
          <div>
            <button type="button" className="button small" onClick={() => setActions((current) => [...current, { ...emptyAction }])}>
              + Añadir acción propuesta
            </button>
          </div>
        </div>
        <div className="form-grid" style={{ marginTop: 14 }}>
          <TextArea label="Evaluación general de impacto" name="impactAssessment" defaultValue={defaults.impactAssessment} />
        </div>
      </section>

      <section className="form-section">
        <h2>4. Estado y cierre operativo</h2>
        <div className="form-grid">
          <label className="field">
            <span>Estado</span>
            <select name="status" defaultValue={defaults.status ?? "OPEN"}>
              <option value="OPEN">Abierta</option>
              <option value="CLOSED">Cerrada</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
          </label>
          <Field label="Fecha cierre operativo" name="operationalClosedAt" type="date" defaultValue={defaults.operationalClosedAt} />
          <TextArea label="Motivo de cancelación" name="cancellationReason" defaultValue={defaults.cancellationReason} />
        </div>
      </section>

      <section className="form-section">
        <h2>5. Verificación de eficacia</h2>
        <p className="section-help">
          La implantación y la eficacia son conceptos distintos. El cierre efectivo solo procede con eficacia conforme.
        </p>
        <div className="form-grid">
          <label className="field">
            <span>Verificación de eficacia</span>
            <select name="effectivenessStatus" defaultValue={defaults.effectivenessStatus ?? "PENDING"}>
              <option value="PENDING">Pendiente</option>
              <option value="CONFORMING">Conforme</option>
              <option value="NONCONFORMING">No conforme</option>
              <option value="NA" disabled={mode === "create" || defaults.effectivenessStatus !== "NA"}>N/A (solo histórico)</option>
            </select>
          </label>
          <Field label="Fecha cierre efectivo / verificación final" name="effectiveClosedAt" type="date" defaultValue={defaults.effectiveClosedAt} />
          <TextArea label="Criterio de eficacia" name="effectivenessCriteria" defaultValue={defaults.effectivenessCriteria} />
          <TextArea label="Valoración de la eficacia" name="effectivenessAssessment" defaultValue={defaults.effectivenessAssessment} />
          <TextArea label="Evidencia revisada" name="effectivenessEvidence" defaultValue={defaults.effectivenessEvidence} />
        </div>
      </section>

      <section className="form-section">
        <h2>6. Conclusión y control documental</h2>
        <div className="form-grid">
          <TextArea label="Conclusión / cierre" name="conclusion" defaultValue={defaults.conclusion} />
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
              <option value="REVIEW_REQUIRED">Pendiente de revisar</option>
            </select>
          </label>
          {mode === "edit" ? (
            <TextArea label="Motivo del cambio (opcional V1)" name="changeReason" />
          ) : null}
        </div>
      </section>

      <div className="form-footer">
        <Link className="button" href={capaId ? `/capa/${capaId}` : "/capa"}>Cancelar</Link>
        <button type="submit" className="button primary" disabled={pending}>
          {pending ? "Guardando…" : mode === "create" ? "Guardar CAPA" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
