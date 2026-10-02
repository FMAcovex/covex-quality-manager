"use server";

import {
  createCurrentVersionReviewThread,
  type CreateCurrentVersionReviewThreadInput,
} from "@/lib/qms/review/current-version-service";
import { ReviewThreadError } from "@/lib/qms/review/service";
import type { ReviewActionState } from "@/lib/qms/review/types";

export async function createCurrentVersionReviewThreadAction(
  input: CreateCurrentVersionReviewThreadInput,
): Promise<ReviewActionState> {
  try {
    const thread = await createCurrentVersionReviewThread(input);
    return {
      error: null,
      success: "Observación creada.",
      reviewThreadId: thread.id,
      status: thread.status,
    };
  } catch (error) {
    if (error instanceof ReviewThreadError) {
      return {
        error: error.message,
        success: null,
        reviewThreadId: null,
        status: null,
      };
    }
    console.error("Unexpected review UI action error", error);
    return {
      error: "No se ha podido crear la observación.",
      success: null,
      reviewThreadId: null,
      status: null,
    };
  }
}
