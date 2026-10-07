"use client";

import type { ReviewThreadStatus } from "@prisma/client";
import { ReviewThreadCard } from "@/components/review/review-thread-card";
import { useReviewWorkspace } from "@/components/review/review-context";

const groups: Array<{ status: ReviewThreadStatus; label: string }> = [
  { status: "PENDING", label: "Pendientes" },
  { status: "ACCEPTED", label: "Aceptados" },
  { status: "RESOLVED", label: "Resueltos" },
];

export function ReviewThreadList({recordVersionId}: {recordVersionId?: string} = {}) {
  const { threads } = useReviewWorkspace();
  return <div className="review-thread-groups">{groups.map((group) => {
    const items = threads.filter((thread) => thread.status === group.status && (!recordVersionId || thread.recordVersionId === recordVersionId));
    return <section className="review-thread-group" key={group.status}><h3>{group.label} <span>{items.length}</span></h3>{items.length ? items.map((thread) => <ReviewThreadCard key={thread.id} thread={thread} showGoToField />) : <div className="empty-panel">Sin hilos {group.label.toLowerCase()}.</div>}</section>;
  })}</div>;
}
