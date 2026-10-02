"use server";

import type { ReviewActionState } from "@/lib/qms/review/types";
import {
  acceptReviewThread,
  createReviewThread,
  replyToReviewThread,
  resolveReviewThread,
  ReviewThreadError,
} from "@/lib/qms/review/service";
import type {
  AcceptReviewThreadInput,
  CreateReviewThreadInput,
  ReplyToReviewThreadInput,
  ResolveReviewThreadInput,
} from "@/lib/qms/review/types";

function controlledError(error: unknown): ReviewActionState {
  if (error instanceof ReviewThreadError) {
    return {
      error: error.message,
      success: null,
      reviewThreadId: null,
      status: null,
    };
  }
  console.error("Unexpected review action error", error);
  return {
    error: "No se ha podido completar la operación de revisión.",
    success: null,
    reviewThreadId: null,
    status: null,
  };
}

export async function createReviewThreadAction(
  input: CreateReviewThreadInput,
): Promise<ReviewActionState> {
  try {
    const thread = await createReviewThread(input);
    return {
      error: null,
      success: "Observación creada.",
      reviewThreadId: thread.id,
      status: thread.status,
    };
  } catch (error) {
    return controlledError(error);
  }
}

export async function replyToReviewThreadAction(
  input: ReplyToReviewThreadInput,
): Promise<ReviewActionState> {
  try {
    const message = await replyToReviewThread(input);
    return {
      error: null,
      success: "Respuesta añadida.",
      reviewThreadId: message.reviewThreadId,
      status: null,
    };
  } catch (error) {
    return controlledError(error);
  }
}

export async function acceptReviewThreadAction(
  input: AcceptReviewThreadInput,
): Promise<ReviewActionState> {
  try {
    const thread = await acceptReviewThread(input);
    return {
      error: null,
      success: "Observación aceptada.",
      reviewThreadId: thread.id,
      status: thread.status,
    };
  } catch (error) {
    return controlledError(error);
  }
}

export async function resolveReviewThreadAction(
  input: ResolveReviewThreadInput,
): Promise<ReviewActionState> {
  try {
    const thread = await resolveReviewThread(input);
    return {
      error: null,
      success: "Observación resuelta.",
      reviewThreadId: thread.id,
      status: thread.status,
    };
  } catch (error) {
    return controlledError(error);
  }
}
