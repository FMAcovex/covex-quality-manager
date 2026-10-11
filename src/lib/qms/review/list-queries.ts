import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { aggregateActiveReviewCounts } from "@/lib/qms/review/list-domain";

export async function withActiveReviewCounts<T extends { qmsRecordId: string }>(
  rows: T[],
  db: Pick<Prisma.TransactionClient, "reviewThread"> = prisma,
) {
  if (!rows.length) return rows.map((row) => ({ ...row, reviewCounts: { pending: 0, accepted: 0 } }));
  const groups = await db.reviewThread.groupBy({
    by: ["qmsRecordId", "status"],
    where: {
      qmsRecordId: { in: rows.map((row) => row.qmsRecordId) },
      status: { in: ["PENDING", "ACCEPTED"] },
    },
    _count: { _all: true },
  });
  const counts = aggregateActiveReviewCounts(groups);
  return rows.map((row) => ({
    ...row, reviewCounts: counts.get(row.qmsRecordId) ?? { pending: 0, accepted: 0 },
  }));
}
