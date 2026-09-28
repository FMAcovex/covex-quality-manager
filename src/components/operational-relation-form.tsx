"use client";

import { useActionState } from "react";
import type {
  RelationActionState,
  RelationTargetOption,
} from "@/lib/qms/relation-form-types";

const initialState: RelationActionState = { error: null, success: null };

export function OperationalRelationForm({
  action,
  title,
  codeLabel,
  codePlaceholder,
  buttonLabel,
  defaultActor,
  targetOptions,
}: {
  action: (
    state: RelationActionState,
    formData: FormData,
  ) => Promise<RelationActionState>;
  title: string;
  codeLabel: string;
  codePlaceholder?: string;
  buttonLabel: string;
  defaultActor: string;
  targetOptions: RelationTargetOption[];
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const showType = targetOptions.length > 1;

  return (
    <div className="relation-editor">
      <h3>{title}</h3>
      {state.error ? <div className="form-errors"><strong>{state.error}</strong></div> : null}
      {state.success ? <div className="form-success"><strong>{state.success}</strong></div> : null}
      <form action={formAction} className="inline-form relation-form">
        {showType ? (
          <label className="field">
            <span>Tipo de expediente</span>
            <select name="recordType" required defaultValue={targetOptions[0]?.value ?? ""}>
              {targetOptions.map((option) => (
                <option value={option.value} key={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="recordType" value={targetOptions[0]?.value ?? ""} />
        )}
        <label className="field">
          <span>{codeLabel}</span>
          <input name="businessCode" placeholder={codePlaceholder} required />
        </label>
        <label className="field">
          <span>Registrado por</span>
          <input name="actor" defaultValue={defaultActor} required />
        </label>
        <div className="full">
          <button className="button primary" type="submit" disabled={pending}>
            {pending ? "Guardando…" : buttonLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
