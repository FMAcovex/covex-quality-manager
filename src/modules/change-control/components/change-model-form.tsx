"use client";
import { useActionState } from "react";
import { ActorField } from "@/components/permissions";
import { CsrfField } from "@/components/csrf";
import { scopeLabels } from "../domain";
import { MODEL_LIMITS } from "../model-limits";
import type { ChangeModelFormState } from "../model-actions";

type Department = { id: string; code: string; name: string };
export type ChangeModelValues = {
  id?: string; updatedAt?: string; name: string; purpose: string; isActive: boolean; departmentId: string; scope: string[];
  otherScope: string; changeDescription: string; justification: string; providedDocuments: string; tasks: string[];
};

/** D-122: alta y edición de un modelo de Control de cambios (Configuración). */
export function ChangeModelForm({ action, values, departments, submitLabel }: {
  action: (state: ChangeModelFormState, fd: FormData) => Promise<ChangeModelFormState>;
  values: ChangeModelValues; departments: Department[]; submitLabel: string;
}) {
  const [state, submit, pending] = useActionState(action, {});
  return <form key={state.formRevision ?? 0} action={submit} className="form-stack change-model-form"><CsrfField />
    {values.updatedAt && <input type="hidden" name="updatedAt" value={values.updatedAt} />}
    {state.error && <div className="form-errors" role="alert">{state.error}</div>}
    {state.saved && <p className="form-success" role="status">Modelo guardado.</p>}
    <div className="form-grid">
      <label className="field span-2"><span>Nombre del modelo *</span><input name="name" required maxLength={MODEL_LIMITS.name} defaultValue={values.name} placeholder="Cambio de proveedor de material" /></label>
      <label className="field"><span>Estado</span><select name="isActive" defaultValue={values.isActive ? "true" : "false"}><option value="true">Activo</option><option value="false">Inactivo</option></select></label>
      <label className="field"><span>Departamento / Área</span><select name="departmentId" defaultValue={values.departmentId}><option value="">Sin preseleccionar</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}</select></label>
      <label className="field full"><span>Cuándo usarlo</span><textarea name="purpose" rows={2} maxLength={MODEL_LIMITS.purpose} defaultValue={values.purpose} /></label>
      <div className="field full"><span>Alcance del cambio</span><div className="checkbox-group">
        {Object.entries(scopeLabels).map(([key, label]) => <label key={key}><input type="checkbox" name="scope" value={key} defaultChecked={values.scope.includes(key)} />{label}</label>)}
      </div></div>
      <label className="field span-2"><span>Especificar Otros</span><input name="otherScope" maxLength={MODEL_LIMITS.otherScope} defaultValue={values.otherScope} /></label>
      <label className="field full"><span>Descripción del cambio (texto guía)</span><textarea name="changeDescription" rows={3} maxLength={MODEL_LIMITS.text} defaultValue={values.changeDescription} /></label>
      <label className="field full"><span>Justificación del cambio (texto guía)</span><textarea name="justification" rows={3} maxLength={MODEL_LIMITS.text} defaultValue={values.justification} /></label>
      <label className="field full"><span>Relación de documentos que se aportan</span><textarea name="providedDocuments" rows={2} maxLength={MODEL_LIMITS.text} defaultValue={values.providedDocuments} /></label>
      <label className="field full"><span>Acciones habituales del plan de ejecución</span><textarea name="tasks" rows={4} defaultValue={values.tasks.join("\n")} aria-describedby="change-model-tasks-help" /><small id="change-model-tasks-help" className="section-help">Una acción por línea (máximo {MODEL_LIMITS.tasks}). En el alta se añaden sin responsable ni fecha.</small></label>
      <label className="field span-2"><span>Motivo del cambio de configuración</span><input name="reason" maxLength={500} /></label>
      <label className="field span-2"><span>Responsable del registro *</span><ActorField name="actor" required /></label>
    </div>
    <div className="form-actions"><button className="button primary" type="submit" disabled={pending}>{pending ? "Guardando…" : submitLabel}</button></div>
  </form>;
}
