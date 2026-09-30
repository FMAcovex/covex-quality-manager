"use client";

import { useActionState } from "react";
import type { FollowupActionState } from "@/components/basic-followup-form";

type Action = (state: FollowupActionState, formData: FormData) => Promise<FollowupActionState>;

export function CapaExecutionEvidenceForm({
  action,
  defaultActor = "",
}: {
  action: Action;
  defaultActor?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="inline-form followup-form">
      {state.error ? <div className="form-feedback error">{state.error}</div> : null}
      {state.success ? <div className="form-feedback success">{state.success}</div> : null}

      <label className="field">
        <span>Fecha *</span>
        <input type="date" name="followupDate" required />
      </label>

      <label className="field">
        <span>Registrado por *</span>
        <input name="completedByText" defaultValue={defaultActor} required />
      </label>

      <label className="field full">
        <span>Evidencia / referencia de ejecución *</span>
        <input name="evidenceReference" required />
      </label>

      <label className="field full">
        <span>Observaciones</span>
        <textarea name="observations" />
      </label>

      <div className="field form-submit">
        <button className="button primary" type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Registrar evidencia"}
        </button>
      </div>
    </form>
  );
}
