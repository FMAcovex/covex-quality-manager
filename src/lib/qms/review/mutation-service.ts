import { prisma } from "@/lib/db";
import { createReviewThread, replyToReviewThread, acceptReviewThread, resolveReviewThread, ReviewThreadError } from "./service";
import { assertReviewThreadOwnership, validateCatalogReviewTarget } from "./target-validation";
import type { CreateReviewThreadInput, ReplyToReviewThreadInput, AcceptReviewThreadInput, ResolveReviewThreadInput } from "./types";

export async function createValidatedReviewThread(input: CreateReviewThreadInput) {
  const recordType = await validateCatalogReviewTarget(input);
  if (recordType === "RETURN" && input.recordVersionId) {
    throw new ReviewThreadError("RECORD_VERSION_MISMATCH", "Devoluciones no utiliza versiones funcionales de revisión.");
  }
  const currentVersion = recordType === "RETURN" ? null : await prisma.qmsRecordVersion.findFirst({
    where: { qmsRecordId: input.qmsRecordId },
    orderBy: [{ sequenceNumber: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  if (input.recordVersionId && input.recordVersionId !== currentVersion?.id) {
    throw new ReviewThreadError("RECORD_VERSION_MISMATCH", "La versión indicada no es la vigente de este expediente.");
  }
  return createReviewThread({ ...input, recordVersionId: currentVersion?.id ?? null });
}

export async function replyToValidatedReviewThread(input: ReplyToReviewThreadInput & { qmsRecordId: string }) {
  await assertReviewThreadOwnership(input.qmsRecordId, input.reviewThreadId);
  return replyToReviewThread(input);
}

export async function acceptValidatedReviewThread(input: AcceptReviewThreadInput & { qmsRecordId: string }) {
  await assertReviewThreadOwnership(input.qmsRecordId, input.reviewThreadId);
  return acceptReviewThread(input);
}

export async function resolveValidatedReviewThread(input: ResolveReviewThreadInput & { qmsRecordId: string }) {
  await assertReviewThreadOwnership(input.qmsRecordId, input.reviewThreadId);
  return resolveReviewThread(input);
}
