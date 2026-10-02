"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  acceptReviewThreadAction,
  replyToReviewThreadAction,
  resolveReviewThreadAction,
} from "@/lib/qms/review/actions";
import { createCurrentVersionReviewThreadAction } from "@/lib/qms/review/ui-actions";
import type { ReviewTargetInstance } from "@/lib/qms/review/targets/types";
import { useReviewWorkspace } from "@/components/review/review-context";

function ActionFeedback({ error }: { error: string | null }) {
  return error ? <p className="review-action-error" role="alert">{error}</p> : null;
}

export function ReviewCreateForm({ target }: { target: ReviewTargetInstance }) {
  const { qmsRecordId, defaultActor, refresh } = useReviewWorkspace();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createCurrentVersionReviewThreadAction({
        qmsRecordId,
        targetKind: target.targetKind,
        tabKey: target.tabKey,
        sectionKey: target.sectionKey,
        fieldPath: target.fieldPath,
        targetEntityType: target.targetEntityType,
        targetEntityId: target.targetEntityId,
        fieldLabelSnapshot: target.label,
        valueSnapshot: target.valueSnapshot,
        initialMessage: message,
        createdByText: defaultActor,
      });
      setError(result.error);
      if (!result.error) {
        setMessage("");
        refresh(result.reviewThreadId);
      }
    });
  }
  return (
    <form className="review-form" onSubmit={submit}>
      <label>
        <span>Crear observación</span>
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} required />
      </label>
      <ActionFeedback error={error} />
      <button className="button primary small" type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Crear observación"}
      </button>
    </form>
  );
}

export function ReviewReplyForm({ reviewThreadId }: { reviewThreadId: string }) {
  const { defaultActor, refresh } = useReviewWorkspace();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await replyToReviewThreadAction({
        reviewThreadId,
        message,
        createdByText: defaultActor,
      });
      setError(result.error);
      if (!result.error) {
        setMessage("");
        refresh(reviewThreadId);
      }
    });
  }
  return (
    <form className="review-form compact" onSubmit={submit}>
      <label>
        <span>Responder</span>
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} required />
      </label>
      <ActionFeedback error={error} />
      <button className="button small" type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Responder"}
      </button>
    </form>
  );
}

export function ReviewAcceptButton({ reviewThreadId }: { reviewThreadId: string }) {
  const { defaultActor, refresh } = useReviewWorkspace();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return <div><button className="button small" type="button" disabled={pending} onClick={() => startTransition(async () => {
    const result = await acceptReviewThreadAction({ reviewThreadId, acceptedByText: defaultActor });
    setError(result.error);
    if (!result.error) refresh(reviewThreadId);
  })}>{pending ? "Aceptando…" : "Aceptar observación"}</button><ActionFeedback error={error} /></div>;
}

export function ReviewResolveForm({ reviewThreadId }: { reviewThreadId: string }) {
  const { defaultActor, refresh } = useReviewWorkspace();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await resolveReviewThreadAction({
        reviewThreadId,
        resolvedByText: defaultActor,
        resolutionNote: note,
      });
      setError(result.error);
      if (!result.error) refresh(reviewThreadId);
    });
  }
  return <form className="review-resolve-form" onSubmit={submit}><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota de resolución (opcional)"/><button className="button primary small" type="submit" disabled={pending}>{pending ? "Resolviendo…" : "Resolver"}</button><ActionFeedback error={error}/></form>;
}
