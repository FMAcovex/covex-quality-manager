"use client";

import { useActionState } from "react";
import type { SignedVersionDocumentState } from "@/modules/deviations/signed-document-actions";

const initialState: SignedVersionDocumentState = { error: null, success: null };

export function SignedVersionDocumentForm({
  action,
  defaultActor,
  replace = false,
}: {
  action: (
    state: SignedVersionDocumentState,
    formData: FormData,
  ) => Promise<SignedVersionDocumentState>;
  defaultActor: string;
  replace?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="inline-form">
      {state.error ? <div className="form-errors full"><strong>{state.error}</strong></div> : null}
      {state.success ? <div className="form-success full"><strong>{state.success}</strong></div> : null}
      <label className="field">
        <span>{replace ? "Sustituir PDF firmado" : "PDF firmado"}</span>
        <input type="file" name="file" accept="application/pdf,.pdf" required />
      </label>
      <label className="field">
        <span>Cargado por</span>
        <input name="actor" defaultValue={defaultActor} required />
      </label>
      {replace ? (
        <label className="field full">
          <span>Motivo de sustitución</span>
          <textarea
            name="replacementReason"
            required
            placeholder="Indica por qué se sustituye el PDF firmado ya cargado."
          />
        </label>
      ) : null}
      <div className="full">
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Cargando…" : replace ? "Sustituir PDF firmado" : "Cargar PDF firmado"}
        </button>
      </div>
    </form>
  );
}
