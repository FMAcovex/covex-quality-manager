import { createReviewThread, ReviewThreadError } from "@/lib/qms/review/service";
import type { CreateReviewThreadInput } from "@/lib/qms/review/types";
import { prisma } from "@/lib/db";

export type CreateCurrentVersionReviewThreadInput = Omit<
  CreateReviewThreadInput,
  "recordVersionId"
>;

export async function createCurrentVersionReviewThread(
  input: CreateCurrentVersionReviewThreadInput,
) {
  const currentVersion = await prisma.qmsRecordVersion.findFirst({
    where: { qmsRecordId: input.qmsRecordId },
    orderBy: [{ sequenceNumber: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  if (!currentVersion) {
    throw new ReviewThreadError(
      "INVALID_INPUT",
      "El expediente no tiene una versión funcional vigente para revisar.",
    );
  }
  return createReviewThread({
    ...input,
    recordVersionId: currentVersion.id,
  });
}
