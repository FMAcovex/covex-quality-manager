"use client";

import type { ReviewTargetInstance } from "@/lib/qms/review/targets/types";
import { activeReviewCount } from "@/lib/qms/review/ui-model";
import { useReviewWorkspace } from "@/components/review/review-context";
import { useCanAct } from "@/components/permissions";

export function ReviewMarker({ target }: { target: ReviewTargetInstance }) {
  const { reviewMode, openTarget, threadsForTarget } = useReviewWorkspace();
  const canReview = useCanAct("REVIEW");
  if (!reviewMode) return null;
  const threads = threadsForTarget(target);
  if (!canReview && !threads.length) return null;
  const active = activeReviewCount(
    Object.fromEntries(
      ["PENDING", "ACCEPTED", "RESOLVED"].map((status) => [
        status,
        threads.filter((thread) => thread.status === status).length,
      ]),
    ),
  );
  return (
    <button
      type="button"
      className={`review-marker${active ? " has-active" : ""}`}
      onClick={() => openTarget(target)}
      aria-label={`${active ? `${active} observaciones activas` : canReview ? "Añadir comentario" : "Consultar comentarios"}: ${target.label}`}
    >
      {active ? <><span aria-hidden="true">●</span>{active}</> : canReview ? "+ comentario" : "Ver comentarios"}
    </button>
  );
}
