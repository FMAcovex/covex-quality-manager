import { Prisma, ReviewThreadStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  ReviewThreadCounts,
  ReviewThreadFilters,
} from "@/lib/qms/review/types";

const messagesChronologically = {
  messages: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.ReviewThreadInclude;

export function getReviewThread(reviewThreadId: string) {
  return prisma.reviewThread.findUnique({
    where: { id: reviewThreadId },
    include: messagesChronologically,
  });
}

export function getReviewThreads(
  qmsRecordId: string,
  filters: ReviewThreadFilters = {},
) {
  return prisma.reviewThread.findMany({
    where: {
      qmsRecordId,
      ...(filters.statuses?.length
        ? { status: { in: filters.statuses } }
        : {}),
      ...(filters.recordVersionId
        ? { recordVersionId: filters.recordVersionId }
        : {}),
    },
    include: messagesChronologically,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }, { id: "desc" }],
  });
}

export function getReviewThreadsForVersion(
  qmsRecordId: string,
  recordVersionId: string,
  statuses?: ReviewThreadStatus[],
) {
  return getReviewThreads(qmsRecordId, { recordVersionId, statuses });
}

export async function countReviewThreads(
  qmsRecordId: string,
  recordVersionId?: string,
): Promise<ReviewThreadCounts> {
  const grouped = await prisma.reviewThread.groupBy({
    by: ["status"],
    where: {
      qmsRecordId,
      ...(recordVersionId ? { recordVersionId } : {}),
    },
    _count: { _all: true },
  });

  const counts: ReviewThreadCounts = {
    [ReviewThreadStatus.PENDING]: 0,
    [ReviewThreadStatus.ACCEPTED]: 0,
    [ReviewThreadStatus.RESOLVED]: 0,
  };
  for (const item of grouped) counts[item.status] = item._count._all;
  return counts;
}
