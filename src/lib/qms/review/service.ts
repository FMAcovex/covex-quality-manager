import {
  Prisma,
  ReviewTargetKind,
  ReviewThreadStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  AcceptReviewThreadInput,
  CreateReviewThreadInput,
  ReplyToReviewThreadInput,
  ResolveReviewThreadInput,
} from "@/lib/qms/review/types";

export const REVIEW_HISTORY_FIELD_PATHS = {
  created: "__review_thread_created__",
  accepted: "__review_thread_accepted__",
  resolved: "__review_thread_resolved__",
} as const;

export type ReviewThreadErrorCode =
  | "INVALID_INPUT"
  | "QMS_RECORD_NOT_FOUND"
  | "RECORD_VERSION_MISMATCH"
  | "REVIEW_THREAD_NOT_FOUND"
  | "INVALID_STATUS_TRANSITION";

export class ReviewThreadError extends Error {
  constructor(
    readonly code: ReviewThreadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ReviewThreadError";
  }
}

function requiredText(value: string | null | undefined, message: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new ReviewThreadError("INVALID_INPUT", message);
  }
  return normalized;
}

function optionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

function reviewActor(value: string | null | undefined) {
  return (
    value?.trim() ||
    process.env.DEFAULT_ACTOR_NAME?.trim() ||
    "Usuario no informado"
  );
}

function validateReviewTarget(input: CreateReviewThreadInput) {
  if (!Object.values(ReviewTargetKind).includes(input.targetKind)) {
    throw new ReviewThreadError(
      "INVALID_INPUT",
      "El tipo de objetivo de revisión no es válido.",
    );
  }
  if (
    input.targetKind === ReviewTargetKind.SECTION &&
    !optionalText(input.sectionKey)
  ) {
    throw new ReviewThreadError(
      "INVALID_INPUT",
      "La sección es obligatoria para una observación de sección.",
    );
  }
  if (
    input.targetKind === ReviewTargetKind.FIELD &&
    !optionalText(input.fieldPath)
  ) {
    throw new ReviewThreadError(
      "INVALID_INPUT",
      "La ruta del campo es obligatoria para una observación de campo.",
    );
  }
  if (
    input.targetKind === ReviewTargetKind.ITEM &&
    (!optionalText(input.targetEntityType) || !optionalText(input.targetEntityId))
  ) {
    throw new ReviewThreadError(
      "INVALID_INPUT",
      "El tipo y el identificador real del elemento son obligatorios.",
    );
  }
}

function targetHistoryValue(input: CreateReviewThreadInput) {
  return {
    targetKind: input.targetKind,
    tabKey: optionalText(input.tabKey),
    sectionKey: optionalText(input.sectionKey),
    fieldPath: optionalText(input.fieldPath),
    targetEntityType: optionalText(input.targetEntityType),
    targetEntityId: optionalText(input.targetEntityId),
    recordVersionId: optionalText(input.recordVersionId),
    status: ReviewThreadStatus.PENDING,
  } satisfies Prisma.InputJsonObject;
}

const reviewThreadWithMessages = {
  messages: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.ReviewThreadInclude;

export async function createReviewThread(input: CreateReviewThreadInput) {
  const qmsRecordId = requiredText(
    input.qmsRecordId,
    "El expediente QMS es obligatorio.",
  );
  const initialMessage = requiredText(
    input.initialMessage,
    "El comentario inicial es obligatorio.",
  );
  validateReviewTarget(input);

  return prisma.$transaction(async (tx) => {
    const record = await tx.qmsRecord.findUnique({
      where: { id: qmsRecordId },
      select: { id: true },
    });
    if (!record) {
      throw new ReviewThreadError(
        "QMS_RECORD_NOT_FOUND",
        "El expediente QMS no existe.",
      );
    }

    const recordVersionId = optionalText(input.recordVersionId);
    if (recordVersionId) {
      const version = await tx.qmsRecordVersion.findUnique({
        where: { id: recordVersionId },
        select: { qmsRecordId: true },
      });
      if (!version || version.qmsRecordId !== qmsRecordId) {
        throw new ReviewThreadError(
          "RECORD_VERSION_MISMATCH",
          "La versión indicada no pertenece al expediente QMS.",
        );
      }
    }

    const thread = await tx.reviewThread.create({
      data: {
        qmsRecordId,
        recordVersionId,
        targetKind: input.targetKind,
        tabKey: optionalText(input.tabKey),
        sectionKey: optionalText(input.sectionKey),
        fieldPath: optionalText(input.fieldPath),
        targetEntityType: optionalText(input.targetEntityType),
        targetEntityId: optionalText(input.targetEntityId),
        fieldLabelSnapshot: optionalText(input.fieldLabelSnapshot),
        ...(input.valueSnapshot === undefined || input.valueSnapshot === null
          ? {}
          : { valueSnapshot: input.valueSnapshot }),
        createdByText: reviewActor(input.createdByText),
        messages: {
          create: {
            message: initialMessage,
            createdByText: reviewActor(input.createdByText),
          },
        },
      },
      include: reviewThreadWithMessages,
    });

    await tx.changeHistory.create({
      data: {
        qmsRecordId,
        changedByText: thread.createdByText,
        fieldPath: REVIEW_HISTORY_FIELD_PATHS.created,
        newValue: {
          reviewThreadId: thread.id,
          ...targetHistoryValue(input),
        },
        reason: "Creación de hilo de revisión",
        source: "UI",
      },
    });

    return thread;
  });
}

export async function replyToReviewThread(input: ReplyToReviewThreadInput) {
  const reviewThreadId = requiredText(
    input.reviewThreadId,
    "El hilo de revisión es obligatorio.",
  );
  const message = requiredText(input.message, "La respuesta no puede estar vacía.");

  const thread = await prisma.reviewThread.findUnique({
    where: { id: reviewThreadId },
    select: { id: true, status: true },
  });
  if (!thread) {
    throw new ReviewThreadError(
      "REVIEW_THREAD_NOT_FOUND",
      "El hilo de revisión no existe.",
    );
  }
  if (thread.status === ReviewThreadStatus.RESOLVED) {
    throw new ReviewThreadError(
      "INVALID_STATUS_TRANSITION",
      "Un hilo resuelto está cerrado y no admite nuevas respuestas.",
    );
  }

  return prisma.reviewMessage.create({
    data: {
      reviewThreadId,
      message,
      createdByText: reviewActor(input.createdByText),
    },
  });
}

export async function acceptReviewThread(input: AcceptReviewThreadInput) {
  const reviewThreadId = requiredText(
    input.reviewThreadId,
    "El hilo de revisión es obligatorio.",
  );
  const acceptedByText = reviewActor(input.acceptedByText);

  return prisma.$transaction(async (tx) => {
    const current = await tx.reviewThread.findUnique({
      where: { id: reviewThreadId },
      include: reviewThreadWithMessages,
    });
    if (!current) {
      throw new ReviewThreadError(
        "REVIEW_THREAD_NOT_FOUND",
        "El hilo de revisión no existe.",
      );
    }
    if (current.status === ReviewThreadStatus.ACCEPTED) return current;
    if (current.status === ReviewThreadStatus.RESOLVED) {
      throw new ReviewThreadError(
        "INVALID_STATUS_TRANSITION",
        "Un hilo resuelto no puede volver a aceptado.",
      );
    }

    const acceptedAt = new Date();
    const changed = await tx.reviewThread.updateMany({
      where: { id: reviewThreadId, status: ReviewThreadStatus.PENDING },
      data: {
        status: ReviewThreadStatus.ACCEPTED,
        acceptedByText,
        acceptedAt,
      },
    });
    if (changed.count === 0) {
      const concurrent = await tx.reviewThread.findUniqueOrThrow({
        where: { id: reviewThreadId },
        include: reviewThreadWithMessages,
      });
      if (concurrent.status === ReviewThreadStatus.ACCEPTED) return concurrent;
      throw new ReviewThreadError(
        "INVALID_STATUS_TRANSITION",
        "Un hilo resuelto no puede volver a aceptado.",
      );
    }

    await tx.changeHistory.create({
      data: {
        qmsRecordId: current.qmsRecordId,
        changedByText: acceptedByText,
        fieldPath: REVIEW_HISTORY_FIELD_PATHS.accepted,
        oldValue: { reviewThreadId, status: ReviewThreadStatus.PENDING },
        newValue: { reviewThreadId, status: ReviewThreadStatus.ACCEPTED },
        reason: "Aceptación de observación de revisión",
        source: "UI",
      },
    });

    return tx.reviewThread.findUniqueOrThrow({
      where: { id: reviewThreadId },
      include: reviewThreadWithMessages,
    });
  });
}

export async function resolveReviewThread(input: ResolveReviewThreadInput) {
  const reviewThreadId = requiredText(
    input.reviewThreadId,
    "El hilo de revisión es obligatorio.",
  );
  const resolvedByText = reviewActor(input.resolvedByText);

  return prisma.$transaction(async (tx) => {
    const current = await tx.reviewThread.findUnique({
      where: { id: reviewThreadId },
      include: reviewThreadWithMessages,
    });
    if (!current) {
      throw new ReviewThreadError(
        "REVIEW_THREAD_NOT_FOUND",
        "El hilo de revisión no existe.",
      );
    }
    if (current.status === ReviewThreadStatus.RESOLVED) return current;

    const previousStatus = current.status;
    const resolvedAt = new Date();
    const changed = await tx.reviewThread.updateMany({
      where: { id: reviewThreadId, status: previousStatus },
      data: {
        status: ReviewThreadStatus.RESOLVED,
        resolvedByText,
        resolvedAt,
        resolutionNote: optionalText(input.resolutionNote),
      },
    });
    if (changed.count === 0) {
      const concurrent = await tx.reviewThread.findUniqueOrThrow({
        where: { id: reviewThreadId },
        include: reviewThreadWithMessages,
      });
      if (concurrent.status === ReviewThreadStatus.RESOLVED) return concurrent;
      throw new ReviewThreadError(
        "INVALID_STATUS_TRANSITION",
        "El estado del hilo cambió mientras se resolvía.",
      );
    }

    await tx.changeHistory.create({
      data: {
        qmsRecordId: current.qmsRecordId,
        changedByText: resolvedByText,
        fieldPath: REVIEW_HISTORY_FIELD_PATHS.resolved,
        oldValue: { reviewThreadId, status: previousStatus },
        newValue: { reviewThreadId, status: ReviewThreadStatus.RESOLVED },
        reason: optionalText(input.resolutionNote) || "Resolución de observación de revisión",
        source: "UI",
      },
    });

    return tx.reviewThread.findUniqueOrThrow({
      where: { id: reviewThreadId },
      include: reviewThreadWithMessages,
    });
  });
}
