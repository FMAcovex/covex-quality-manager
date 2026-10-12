"use client";
import { PermissionGate } from "@/components/permissions";


import { ReviewCreateForm } from "@/components/review/review-forms";
import { ReviewThreadCard } from "@/components/review/review-thread-card";
import { useReviewWorkspace } from "@/components/review/review-context";
import { formatReviewSnapshot, reviewVersionLabel } from "@/lib/qms/review/ui-model";

export function ReviewDrawer() {
  const {
    drawerOpen,
    selectedTarget,
    selectedThread,
    closeDrawer,
    threadsForTarget,
    currentVersionLabel,
    versionLabelMode,
    showVersionContext,
  } = useReviewWorkspace();
  if (!drawerOpen) return null;
  const target = selectedTarget;
  const threads = target ? threadsForTarget(target) : selectedThread ? [selectedThread] : [];
  const reviewedVersionLabel = selectedThread
    ? reviewVersionLabel(selectedThread.recordVersionSequence, versionLabelMode)
    : currentVersionLabel;
  const reviewedSnapshot = selectedThread
    ? selectedThread.valueSnapshot
    : target?.valueSnapshot ?? null;
  return <div className="review-drawer-layer"><button className="review-drawer-backdrop" type="button" onClick={closeDrawer} aria-label="Cerrar panel de revisión"/><aside className="review-drawer" aria-label="Panel de revisión"><header><div><p className="eyebrow">Revisión</p><h2>{target?.label ?? selectedThread?.fieldLabelSnapshot ?? "Observación"}</h2><p>{target?.tabKey ?? selectedThread?.tabKey ?? "Expediente"} · {target?.sectionKey ?? selectedThread?.sectionKey ?? "General"}</p></div><button className="review-drawer-close" type="button" onClick={closeDrawer} aria-label="Cerrar">×</button></header>{target || selectedThread ? <>{showVersionContext ? <div className="review-drawer-version"><span>{selectedThread ? "Versión revisada" : "Versión funcional vigente"}</span><strong>{reviewedVersionLabel}</strong></div> : null}<div className="review-snapshot"><span>{selectedThread ? "Valor revisado" : "Valor visible"}</span><pre>{formatReviewSnapshot(reviewedSnapshot)}</pre></div></> : null}<div className="review-drawer-threads">{threads.length ? threads.map((thread) => <ReviewThreadCard key={thread.id} thread={thread}/>) : <div className="empty-panel">Todavía no hay observaciones para este objetivo.</div>}</div>{target ? <PermissionGate permission="REVIEW"><ReviewCreateForm target={target}/></PermissionGate> : null}</aside></div>;
}
