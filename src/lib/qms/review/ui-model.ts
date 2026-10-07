import type { ReviewTargetKind, ReviewThreadStatus } from "@prisma/client";
import type {
  ReviewSnapshotValue,
  ReviewTargetInstance,
} from "@/lib/qms/review/targets/types";

export type ReviewMessageView = {
  id: string;
  message: string;
  createdByText: string;
  createdAt: string;
};

export type ReviewThreadView = {
  id: string;
  recordVersionId: string | null;
  recordVersionSequence: number | null;
  targetKind: ReviewTargetKind;
  tabKey: string | null;
  sectionKey: string | null;
  fieldPath: string | null;
  targetEntityType: string | null;
  targetEntityId: string | null;
  fieldLabelSnapshot: string | null;
  valueSnapshot: ReviewSnapshotValue;
  status: ReviewThreadStatus;
  createdByText: string;
  createdAt: string;
  acceptedByText: string | null;
  acceptedAt: string | null;
  resolvedByText: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  messages: ReviewMessageView[];
};

export function activeReviewCount(
  counts: Partial<Record<ReviewThreadStatus, number>>,
) {
  return (counts.PENDING ?? 0) + (counts.ACCEPTED ?? 0);
}

export function reviewThreadCapabilities(status: ReviewThreadStatus) {
  return {
    canReply: status !== "RESOLVED",
    canAccept: status === "PENDING",
    canResolve: status !== "RESOLVED",
    readOnly: status === "RESOLVED",
  };
}

export function reviewThreadMatchesTarget(
  thread: ReviewThreadView,
  target: ReviewTargetInstance,
) {
  return (
    thread.targetKind === target.targetKind &&
    thread.tabKey === target.tabKey &&
    thread.sectionKey === target.sectionKey &&
    thread.fieldPath === target.fieldPath &&
    thread.targetEntityType === target.targetEntityType &&
    thread.targetEntityId === target.targetEntityId
  );
}

export function reviewTargetHref(
  basePath: string,
  target: Pick<ReviewTargetInstance, "tabKey" | "anchorId">,
  reviewThreadId?: string,
) {
  const params = new URLSearchParams();
  params.set("tab", target.tabKey);
  params.set("review", "1");
  if (reviewThreadId) params.set("thread", reviewThreadId);
  return `${basePath}?${params.toString()}#${target.anchorId}`;
}

export function reviewTabHref(
  basePath: string,
  tabKey: string,
  reviewMode: boolean,
) {
  const params = new URLSearchParams({ tab: tabKey });
  if (reviewMode) params.set("review", "1");
  return `${basePath}?${params.toString()}`;
}

export function reviewModeHref(
  basePath: string,
  tabKey: string,
  active: boolean,
) {
  const params = new URLSearchParams({ tab: tabKey });
  if (!active) params.set("review", "1");
  return `${basePath}?${params.toString()}`;
}

export type ReviewVersionLabelMode = "VERSION" | "FOLLOWUP";

export function reviewVersionLabel(
  sequence: number | null,
  mode: ReviewVersionLabelMode = "VERSION",
) {
  if (sequence === null) return "Sin versión";
  const number = String(sequence).padStart(2, "0");
  return mode === "FOLLOWUP" ? `Seguimiento ${number}${sequence === 0 ? " · Apertura" : ""}` : `V${number}`;
}

export function reviewThreadContextLabel({
  tabKey,
  sectionKey,
  sequence,
  versionLabelMode = "VERSION",
  showVersionContext = true,
}: {
  tabKey: string | null;
  sectionKey: string | null;
  sequence: number | null;
  versionLabelMode?: ReviewVersionLabelMode;
  showVersionContext?: boolean;
}) {
  const base = `${tabKey ?? "Expediente"} · ${sectionKey ?? "General"}`;
  return showVersionContext
    ? `${base} · ${reviewVersionLabel(sequence, versionLabelMode)}`
    : base;
}

export function reviewStatusLabel(status: ReviewThreadStatus) {
  if (status === "PENDING") return "Pendiente";
  if (status === "ACCEPTED") return "Aceptada";
  return "Resuelta";
}

export function formatReviewSnapshot(value: ReviewSnapshotValue): string {
  if (value === null || value === "") return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(formatReviewSnapshot).join(" · ");
  return JSON.stringify(value, null, 2);
}

export function formatReviewDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  // SSR and the browser must render the same text regardless of their local TZ.
  return `${new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
  }).format(date)} UTC`;
}
