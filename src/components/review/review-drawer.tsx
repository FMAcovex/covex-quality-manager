"use client";

import { ReviewCreateForm } from "@/components/review/review-forms";
import { ReviewThreadCard } from "@/components/review/review-thread-card";
import { useReviewWorkspace } from "@/components/review/review-context";
import { activeReviewCount, formatReviewSnapshot } from "@/lib/qms/review/ui-model";

export function ReviewDrawer() {
  const {
    drawerOpen,
    selectedTarget,
    selectedThread,
    closeDrawer,
    threadsForTarget,
    currentVersionLabel,
  } = useReviewWorkspace();
  if (!drawerOpen) return null;
  const target = selectedTarget;
  const threads = target ? threadsForTarget(target) : selectedThread ? [selectedThread] : [];
  const active = activeReviewCount({
    PENDING: threads.filter((thread) => thread.status === "PENDING").length,
    ACCEPTED: threads.filter((thread) => thread.status === "ACCEPTED").length,
  });
  return <div className="review-drawer-layer"><button className="review-drawer-backdrop" type="button" onClick={closeDrawer} aria-label="Cerrar panel de revisión"/><aside className="review-drawer" aria-label="Panel de revisión"><header><div><p className="eyebrow">Revisión</p><h2>{target?.label ?? selectedThread?.fieldLabelSnapshot ?? "Observación"}</h2><p>{target?.tabKey ?? selectedThread?.tabKey ?? "Expediente"} · {target?.sectionKey ?? selectedThread?.sectionKey ?? "General"}</p></div><button className="review-drawer-close" type="button" onClick={closeDrawer} aria-label="Cerrar">×</button></header>{target ? <><div className="review-drawer-version"><span>Versión funcional vigente</span><strong>{currentVersionLabel}</strong></div><div className="review-snapshot"><span>Valor visible</span><pre>{formatReviewSnapshot(target.valueSnapshot)}</pre></div></> : null}<div className="review-drawer-threads">{threads.length ? threads.map((thread) => <ReviewThreadCard key={thread.id} thread={thread}/>) : <div className="empty-panel">Todavía no hay observaciones para este objetivo.</div>}</div>{target && active === 0 ? <ReviewCreateForm target={target}/> : null}</aside></div>;
}
