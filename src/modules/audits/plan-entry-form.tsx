"use client";
import { CsrfField } from "@/components/csrf";

import { useActionState, type ReactNode } from "react";
import { addPlanEntryFormAction, updatePlanEntryFormAction } from "./plan-actions";

/**
 * Keep the native, uncontrolled fields mounted when server-side validation fails:
 * the user can correct an invalid date/period combination without losing inputs.
 */
export function PlanEntryForm({ planId, entryId, children }: {
  planId: string;
  entryId?: string;
  children: ReactNode;
}) {
  const serverAction = entryId
    ? updatePlanEntryFormAction.bind(null, planId, entryId)
    : addPlanEntryFormAction.bind(null, planId);
  const [state, action, pending] = useActionState(serverAction, {});
  return <form action={action} className="audit-child-form"><CsrfField />
    {children}
    <div className="full">
      {state.error ? <p role="alert">{state.error}</p> : null}
      <button className={entryId ? "button" : "button primary"} disabled={pending}>
        {entryId ? "Guardar cambios" : "Añadir al plan"}
      </button>
    </div>
  </form>;
}
