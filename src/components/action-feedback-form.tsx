"use client";

import { useActionState, type ReactNode } from "react";
import {
  initialActionFeedbackState,
  type ActionFeedbackState,
} from "@/lib/forms/action-feedback";

export function ActionFeedbackForm({
  action,
  className,
  children,
}: {
  action: (state: ActionFeedbackState, formData: FormData) => Promise<ActionFeedbackState>;
  className?: string;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState(action, initialActionFeedbackState);

  return (
    <form action={formAction} className={className}>
      {state.error ? (
        <div className="action-feedback-error" role="alert">
          {state.error}
        </div>
      ) : null}
      {children}
    </form>
  );
}
