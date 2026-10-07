import { createValidatedReviewThread } from "@/lib/qms/review/mutation-service";
import type { CreateReviewThreadInput } from "@/lib/qms/review/types";

export type CreateCurrentVersionReviewThreadInput = Omit<
  CreateReviewThreadInput,
  "recordVersionId"
>;

export async function createCurrentVersionReviewThread(
  input: CreateCurrentVersionReviewThreadInput,
) {
  return createValidatedReviewThread(input);
}
