"use client";

import { useActionState } from "react";

export type FollowupActionState = { error?: string; success?: string };
type Action = (state: FollowupActionState, formData: FormData) => Promise<FollowupActionState>;

export function BasicFollowupForm({
  action,
  defaultActor = "",
  includeType = false,
}: {
  action: Action;
  defaultActor?: string;
  includeType?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="inline-form followup-form">
      {state.error ? <div className="form-feedback error">{state.error}</div> : null}
      {state.success ? <div className="form-feedback success">{state.success}</div> : null}
      <label className="field"><span>Fecha *</span><input type="date" name="followupDate" required /></label>
      <label className="field"><span>Responsable *</span><input name="completedByText" defaultValue={defaultActor} required /></label>
      {includeType ? <label className="field"><span>Tipo de seguimiento</span><input name="followupType" placeholder="Seguimiento, revisión, evidencia…" /></label> : null}
      <label className="field full"><span>Comentario / actuación *</span><textarea name="comment" required /></label>
      <label className="field"><span>Próximo seguimiento</span><input type="date" name="nextFollowupDate" /></label>
      <label className="field"><span>Evidencia / referencia</span><input name="evidenceReference" /></label>
      <div className="field form-submit"><button className="button primary" type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar seguimiento"}</button></div>
    </form>
  );
}
