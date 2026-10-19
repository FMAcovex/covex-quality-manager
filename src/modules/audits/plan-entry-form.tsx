"use client";
import { ActorField } from "@/components/permissions";
import { CsrfField } from "@/components/csrf";
import { useActionState } from "react";
import { submittedDefaults } from "@/lib/forms/preserved-state";
import { ProgrammeEntryFields } from "./annual-programme/entry-fields";
import { addPlanEntryFormAction, updatePlanEntryFormAction, type PlanFormState } from "./plan-actions";

export type PlanDepartmentOption = { id: string; code: string; name: string; isActive: boolean };

/**
 * Alta y edición de una auditoría prevista. Ante un error de validación se conserva lo escrito
 * (R5A): los valores enviados vuelven en el estado y el formulario se vuelve a montar con ellos.
 */
export function PlanEntryForm({ planId, entryId, internal, departments, defaults }: {
  planId: string;
  entryId?: string;
  internal: boolean;
  departments: PlanDepartmentOption[];
  defaults: Record<string, string>;
}) {
  const serverAction = entryId
    ? updatePlanEntryFormAction.bind(null, planId, entryId)
    : addPlanEntryFormAction.bind(null, planId);
  const [state, action, pending] = useActionState<PlanFormState, FormData>(serverAction, {});
  const values = submittedDefaults<Record<string, string | string[]>>(defaults, state.submittedValues);
  const value = (key: string) => String(values[key] ?? "");
  const selectable = departments.filter((d) => d.isActive || d.id === defaults.departmentId);
  return <form key={state.formRevision ?? 0} action={action} className="form-stack"><CsrfField />
    <section className="form-section"><h2>Identificación</h2><div className="form-grid">
      <label className="field span-2"><span>Objeto de la auditoría</span><input name="subject" defaultValue={value("subject")} required/></label>
      <label className="field"><span>{internal ? "Área / referencia" : "Empresa / organismo"}</span><input name="targetName" defaultValue={value("targetName")}/></label>
      {internal ? <label className="field"><span>Departamento principal</span><select name="departmentId" defaultValue={value("departmentId")}><option value="">Sin especificar</option>{selectable.map((d) => <option value={d.id} key={d.id}>{d.code} · {d.name}</option>)}</select></label> : <input type="hidden" name="departmentId" value=""/>}
    </div></section>
    <section className="form-section"><h2>Planificación</h2><p className="section-help">Indica una fecha exacta o un período previsto, no ambos.</p><div className="form-grid">
      <label className="field"><span>Fecha prevista</span><input type="date" name="plannedDate" defaultValue={value("plannedDate")}/></label>
      <ProgrammeEntryFields internal={internal} values={values}/>
    </div></section>
    <section className="form-section"><h2>Registro</h2><div className="form-grid">
      <label className="field full"><span>Observaciones</span><textarea name="notes" defaultValue={value("notes")}/></label>
      <label className="field"><span>{entryId ? "Responsable del cambio" : "Realizado por"}</span><ActorField name="actor" required/></label>
      {entryId ? <label className="field span-3"><span>Motivo de actualización</span><input name="reason" defaultValue={value("reason")} required/></label> : null}
    </div></section>
    <div>
      {state.error ? <p role="alert" className="field-error-block">{state.error}</p> : null}
      <button className={entryId ? "button" : "button primary"} disabled={pending}>
        {entryId ? "Guardar cambios" : "Añadir al plan"}
      </button>
    </div>
  </form>;
}
