"use server";

import { authorizedAction } from "@/lib/auth/action-guard";
import {
  createCurrentVersionReviewThread,
  type CreateCurrentVersionReviewThreadInput,
} from "@/lib/qms/review/current-version-service";
import { getReviewThreadsForDisplay } from "@/lib/qms/review/ui-queries";
import { invalidateReviewRecord } from "@/lib/qms/review/invalidation";
import { ReviewThreadError } from "@/lib/qms/review/service";
import type { ReviewActionState } from "@/lib/qms/review/types";

async function createCurrentVersionReviewThreadActionAuthenticatedContent(
  input: CreateCurrentVersionReviewThreadInput,
): Promise<ReviewActionState> {
  try {
    const thread = await createCurrentVersionReviewThread(input);
    await invalidateReviewRecord(input.qmsRecordId);
    return {
      threads: await getReviewThreadsForDisplay(input.qmsRecordId),
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

export async function createCurrentVersionReviewThreadAction(...args: Parameters<typeof createCurrentVersionReviewThreadActionAuthenticatedContent>) {
  return authorizedAction("createCurrentVersionReviewThreadAction", args, authenticated => createCurrentVersionReviewThreadActionAuthenticatedContent(...authenticated as Parameters<typeof createCurrentVersionReviewThreadActionAuthenticatedContent>));
}
