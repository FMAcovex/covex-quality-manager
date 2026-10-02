import { prisma } from "@/lib/db";
import type { ReviewSnapshotValue } from "@/lib/qms/review/targets/types";
import type { ReviewThreadView } from "@/lib/qms/review/ui-model";

export async function getReviewThreadsForDisplay(
  qmsRecordId: string,
): Promise<ReviewThreadView[]> {
  const threads = await prisma.reviewThread.findMany({
    where: { qmsRecordId },
    include: {
      recordVersion: { select: { sequenceNumber: true } },
      messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }, { id: "desc" }],
  });

  return threads.map((thread) => ({
    id: thread.id,
    recordVersionId: thread.recordVersionId,
    recordVersionSequence: thread.recordVersion?.sequenceNumber ?? null,
    targetKind: thread.targetKind,
    tabKey: thread.tabKey,
    sectionKey: thread.sectionKey,
    fieldPath: thread.fieldPath,
    targetEntityType: thread.targetEntityType,
    targetEntityId: thread.targetEntityId,
    fieldLabelSnapshot: thread.fieldLabelSnapshot,
    valueSnapshot: (thread.valueSnapshot ?? null) as ReviewSnapshotValue,
    status: thread.status,
    createdByText: thread.createdByText,
    createdAt: thread.createdAt.toISOString(),
    acceptedByText: thread.acceptedByText,
    acceptedAt: thread.acceptedAt?.toISOString() ?? null,
    resolvedByText: thread.resolvedByText,
    resolvedAt: thread.resolvedAt?.toISOString() ?? null,
    resolutionNote: thread.resolutionNote,
    messages: thread.messages.map((message) => ({
      id: message.id,
      message: message.message,
      createdByText: message.createdByText,
      createdAt: message.createdAt.toISOString(),
    })),
  }));
}
