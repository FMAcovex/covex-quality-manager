"use client";

import { useActionState, useEffect, useRef } from "react";
import { ActorField } from "@/components/permissions";
import { CsrfField } from "@/components/csrf";
import { EVIDENCE_ACCEPT } from "@/lib/qms/evidence-constants";
import type { RecordEvidenceState } from "@/lib/qms/record-evidence-actions";

const initialState: RecordEvidenceState = { error: null, success: null };

export function RecordEvidenceForm({
  action,
}: {
  action: (state: RecordEvidenceState, formData: FormData) => Promise<RecordEvidenceState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.success) form.current?.reset(); }, [state]);

  return (
    <form ref={form} action={formAction} className="form-grid evidence-form"><CsrfField />
      {state.error ? <div className="form-errors full"><strong>{state.error}</strong></div> : null}
      {state.success ? <div className="form-success full"><strong>{state.success}</strong></div> : null}
      <label className="field full">
        <span>Descripción de la evidencia *</span>
        <input name="description" required maxLength={500} placeholder="Ej.: fotografía del etiquetado del lote, registro de limpieza, certificado del proveedor…" />
      </label>
      <label className="field">
        <span>Referencia (seguimiento, acción, documento…)</span>
        <input name="reference" maxLength={200} />
      </label>
      <label className="field">
        <span>Adjuntado por</span>
        <ActorField name="actor" required />
      </label>
      <label className="field full">
        <span>Archivo (PDF, DOCX, XLSX, PNG o JPG; máx. 15 MB) *</span>
        <input type="file" name="file" accept={EVIDENCE_ACCEPT} required />
      </label>
      <div className="full">
        <button type="submit" className="button primary" disabled={pending}>
          {pending ? "Adjuntando…" : "Adjuntar evidencia"}
        </button>
      </div>
    </form>
  );
}
