"use client";
import { CsrfField } from "@/components/csrf";

import { csrfToken } from "@/lib/auth/client";

import { useState, type FormEvent } from "react";
import {
  acceptReviewThreadAction,
  createReviewThreadAction,
  replyToReviewThreadAction,
  resolveReviewThreadAction,
} from "@/lib/qms/review/actions";
import { createCurrentVersionReviewThreadAction } from "@/lib/qms/review/ui-actions";
import type { ReviewTargetInstance } from "@/lib/qms/review/targets/types";
import { useReviewWorkspace } from "@/components/review/review-context";

function useReviewMutation(setError: (message: string | null) => void) {
  const [pending, setPending] = useState(false);
  async function runMutation(operation: () => Promise<void>) {
    setPending(true);
    try { await operation(); }
    catch { setError("No se ha podido completar la revisión. Vuelve a intentarlo."); }
    finally { setPending(false); }
  }
  return [pending, runMutation] as const;
}

function ActionFeedback({ error }: { error: string | null }) {
  return error ? <p className="review-action-error" role="alert">{error}</p> : null;
}

export function ReviewCreateForm({ target }: { target: ReviewTargetInstance }) {
  const {
    qmsRecordId,
    defaultActor,
    refresh,
    recordVersionAssociation,
  } = useReviewWorkspace();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, runMutation] = useReviewMutation(setError);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runMutation(async () => {
      const input = {
        _covexCsrf: csrfToken(),
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
      };
      const result =
        recordVersionAssociation === "NONE"
          ? await createReviewThreadAction({ ...input, recordVersionId: null })
          : await createCurrentVersionReviewThreadAction(input);
      setError(result.error);
      if (!result.error) {
        setMessage("");
        refresh(result.reviewThreadId, result.threads);
      }
    });
  }
  return (
    <form className="review-form" onSubmit={submit}><CsrfField />
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
  const { qmsRecordId, defaultActor, refresh } = useReviewWorkspace();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, runMutation] = useReviewMutation(setError);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runMutation(async () => {
      const result = await replyToReviewThreadAction({
        _covexCsrf: csrfToken(),
        qmsRecordId,
        reviewThreadId,
        message,
        createdByText: defaultActor,
      });
      setError(result.error);
      if (!result.error) {
        setMessage("");
        refresh(reviewThreadId, result.threads);
      }
    });
  }
  return (
    <form className="review-form compact" onSubmit={submit}><CsrfField />
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
  const { qmsRecordId, defaultActor, refresh } = useReviewWorkspace();
  const [error, setError] = useState<string | null>(null);
  const [pending, runMutation] = useReviewMutation(setError);
  return <div><button className="button small" type="button" disabled={pending} onClick={() => void runMutation(async () => {
    const result = await acceptReviewThreadAction({ _covexCsrf: csrfToken(), qmsRecordId, reviewThreadId, acceptedByText: defaultActor });
    setError(result.error);
    if (!result.error) refresh(reviewThreadId, result.threads);
  })}>{pending ? "Aceptando…" : "Aceptar observación"}</button><ActionFeedback error={error} /></div>;
}

export function ReviewResolveForm({ reviewThreadId }: { reviewThreadId: string }) {
  const { qmsRecordId, defaultActor, refresh } = useReviewWorkspace();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, runMutation] = useReviewMutation(setError);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runMutation(async () => {
      const result = await resolveReviewThreadAction({
        _covexCsrf: csrfToken(),
        qmsRecordId,
        reviewThreadId,
        resolvedByText: defaultActor,
        resolutionNote: note,
      });
      setError(result.error);
      if (!result.error) refresh(reviewThreadId, result.threads);
    });
  }
  return <form className="review-resolve-form" onSubmit={submit}><CsrfField /><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota de resolución (opcional)"/><button className="button primary small" type="submit" disabled={pending}>{pending ? "Resolviendo…" : "Resolver"}</button><ActionFeedback error={error}/></form>;
}
