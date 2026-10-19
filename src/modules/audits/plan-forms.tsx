"use client";
import { ActorField } from "@/components/permissions";
import { CsrfField } from "@/components/csrf";
import { useActionState } from "react";
import { submittedDefaults } from "@/lib/forms/preserved-state";
import { createPlanFormAction, retirePlanEntryFormAction, type PlanFormState } from "./plan-actions";

/** Alta de un plan anual; ante un error (p. ej., plan duplicado) se conserva lo escrito (R5A). */
export function CreatePlanForm({ year }: { year: number }) {
  const [state, action, pending] = useActionState<PlanFormState, FormData>(createPlanFormAction, {});
  const values = submittedDefaults<Record<string, string | string[]>>({ year: String(year), auditType: "INTERNAL", title: "", notes: "" }, state.submittedValues);
  const value = (key: string) => String(values[key] ?? "");
  return <form key={state.formRevision ?? 0} action={action} className="form-grid"><CsrfField />
    <label className="field"><span>Año</span><input name="year" type="number" min="2000" max="2100" defaultValue={value("year")} required/></label>
    <label className="field"><span>Tipo de plan</span><select name="auditType" defaultValue={value("auditType")}><option value="INTERNAL">Interno</option><option value="EXTERNAL">Externo</option></select></label>
    <label className="field span-2"><span>Título</span><input name="title" placeholder="Plan anual de auditorías" defaultValue={value("title")} required maxLength={250}/></label>
    <label className="field full"><span>Observaciones</span><textarea name="notes" defaultValue={value("notes")}/></label>
    <label className="field"><span>Realizado por</span><ActorField name="actor" required/></label>
    <div className="field full">{state.error ? <p role="alert" className="field-error-block">{state.error}</p> : null}<div><button className="button primary" disabled={pending}>Crear plan</button></div></div>
  </form>;
}

/** Retirada de una auditoría prevista sin expediente; el motivo se conserva si hay un error. */
export function RetirePlanEntryForm({ planId, entryId }: { planId: string; entryId: string }) {
  const [state, action, pending] = useActionState<PlanFormState, FormData>(retirePlanEntryFormAction.bind(null, planId, entryId), {});
  const values = submittedDefaults<Record<string, string | string[]>>({ reason: "" }, state.submittedValues);
  return <form key={state.formRevision ?? 0} action={action} className="form-grid"><CsrfField />
    <label className="field"><span>Responsable</span><ActorField name="actor" required/></label>
    <label className="field span-3"><span>Motivo de retirada</span><input name="reason" defaultValue={String(values.reason ?? "")} required/></label>
    <div className="field full">{state.error ? <p role="alert" className="field-error-block">{state.error}</p> : null}<div><button className="button" disabled={pending}>Confirmar retirada</button></div></div>
  </form>;
}
