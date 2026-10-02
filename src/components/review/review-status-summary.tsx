"use client";

import { useReviewWorkspace } from "@/components/review/review-context";

export function ReviewStatusSummary() {
  const { threads } = useReviewWorkspace();
  const count = (status: string) => threads.filter((thread) => thread.status === status).length;
  return <div className="review-status-summary"><div><strong>{count("PENDING")}</strong><span>Pendientes</span></div><div><strong>{count("ACCEPTED")}</strong><span>Aceptados</span></div><div><strong>{count("RESOLVED")}</strong><span>Resueltos</span></div></div>;
}
