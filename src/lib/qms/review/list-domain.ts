import type { Prisma } from "@prisma/client";

export const reviewFilterOptions = [
  { value: "", label: "Todas" },
  { value: "PENDING", label: "Con revisiones pendientes" },
  { value: "ACCEPTED", label: "Con aceptados pendientes de resolver" },
  { value: "ACTIVE", label: "Pendientes o aceptadas" },
  { value: "NONE", label: "Sin revisiones activas" },
] as const;

export type ActiveReviewCounts = { pending: number; accepted: number };

export function reviewListWhere(value: string | undefined): Prisma.QmsRecordWhereInput | null {
  if (value === "PENDING" || value === "ACCEPTED") {
    return { reviewThreads: { some: { status: value } } };
  }
  if (value === "ACTIVE") {
    return { reviewThreads: { some: { status: { in: ["PENDING", "ACCEPTED"] } } } };
  }
  if (value === "NONE") {
    return { reviewThreads: { none: { status: { in: ["PENDING", "ACCEPTED"] } } } };
  }
  return null;
}

export function aggregateActiveReviewCounts(groups: Array<{
  qmsRecordId: string; status: string; _count: { _all: number };
}>) {
  const counts = new Map<string, ActiveReviewCounts>();
  for (const group of groups) {
    if (group.status !== "PENDING" && group.status !== "ACCEPTED") continue;
    const current = counts.get(group.qmsRecordId) ?? { pending: 0, accepted: 0 };
    current[group.status === "PENDING" ? "pending" : "accepted"] += group._count._all;
    counts.set(group.qmsRecordId, current);
  }
  return counts;
}
