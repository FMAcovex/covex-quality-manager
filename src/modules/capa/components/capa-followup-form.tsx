"use client";

import { useActionState } from "react";
import type { FollowupActionState } from "@/components/basic-followup-form";

type Action = (state: FollowupActionState, formData: FormData) => Promise<FollowupActionState>;

export function CapaFollowupForm({ action, defaultActor = "" }: { action: Action; defaultActor?: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="inline-form followup-form">
      {state.error ? <div className="form-feedback error">{state.error}</div> : null}
      {state.success ? <div className="form-feedback success">{state.success}</div> : null}
      <label className="field"><span>Fecha *</span><input type="date" name="followupDate" required /></label>
      <label className="field"><span>Cumplimentado por *</span><input name="completedByText" defaultValue={defaultActor} required /></label>
      <label className="field"><span>Motivo</span><input name="reason" /></label>
      <label className="field full"><span>Actuación realizada / resultado *</span><textarea name="description" required /></label>
      <label className="field"><span>Próxima fecha</span><input type="date" name="nextFollowupDate" /></label>
      <label className="field"><span>Evidencia / referencia</span><input name="evidenceReference" /></label>
      <label className="field full"><span>Observaciones</span><textarea name="observations" /></label>
      <div className="field form-submit"><button className="button primary" type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar seguimiento"}</button></div>
    </form>
  );
}
