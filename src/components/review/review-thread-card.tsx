"use client";

import Link from "next/link";
import {
  formatReviewSnapshot,
  reviewStatusLabel,
  reviewTargetHref,
  reviewThreadCapabilities,
  reviewVersionLabel,
  type ReviewThreadView,
} from "@/lib/qms/review/ui-model";
import {
  ReviewAcceptButton,
  ReviewReplyForm,
  ReviewResolveForm,
} from "@/components/review/review-forms";
import { useReviewWorkspace } from "@/components/review/review-context";

const dateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—";

export function ReviewThreadCard({
  thread,
  showGoToField = false,
}: {
  thread: ReviewThreadView;
  showGoToField?: boolean;
}) {
  const { basePath, targetForThread, openThread, versionLabelMode } = useReviewWorkspace();
  const target = targetForThread(thread);
  const capabilities = reviewThreadCapabilities(thread.status);
  return (
    <article className={`review-thread-card status-${thread.status.toLowerCase()}`}>
      <header>
        <div>
          <strong>{thread.fieldLabelSnapshot ?? target?.label ?? thread.fieldPath ?? "Expediente"}</strong>
          <small>{thread.tabKey ?? "Expediente"} · {thread.sectionKey ?? "General"} · {reviewVersionLabel(thread.recordVersionSequence, versionLabelMode)}</small>
        </div>
        <span className={`badge review-${thread.status.toLowerCase()}`}>{reviewStatusLabel(thread.status)}</span>
      </header>
      <div className="review-snapshot"><span>Valor revisado</span><pre>{formatReviewSnapshot(thread.valueSnapshot)}</pre></div>
      <div className="review-conversation">
        {thread.messages.map((message) => <div className="review-message" key={message.id}><p>{message.message}</p><small>{message.createdByText} · {dateTime(message.createdAt)}</small></div>)}
      </div>
      {thread.acceptedAt ? <p className="review-state-meta"><strong>Aceptada:</strong> {thread.acceptedByText} · {dateTime(thread.acceptedAt)}</p> : null}
      {thread.resolvedAt ? <p className="review-state-meta"><strong>Resuelta:</strong> {thread.resolvedByText} · {dateTime(thread.resolvedAt)}{thread.resolutionNote ? ` · ${thread.resolutionNote}` : ""}</p> : null}
      {showGoToField && target ? <Link className="button small" href={reviewTargetHref(basePath, target, thread.id)}>Ir al campo</Link> : null}
      {!showGoToField ? <button className="review-thread-focus" type="button" onClick={() => openThread(thread.id)}>Ver hilo</button> : null}
      {!capabilities.readOnly ? <div className="review-thread-actions">
        {capabilities.canReply ? <ReviewReplyForm reviewThreadId={thread.id} /> : null}
        <div className="review-state-actions">
          {capabilities.canAccept ? <ReviewAcceptButton reviewThreadId={thread.id} /> : null}
          {capabilities.canResolve ? <ReviewResolveForm reviewThreadId={thread.id} /> : null}
        </div>
      </div> : <p className="review-read-only">Hilo resuelto · solo lectura</p>}
    </article>
  );
}
