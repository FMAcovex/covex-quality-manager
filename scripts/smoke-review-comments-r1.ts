import assert from "node:assert/strict";
import {
  PrismaClient,
  QmsRecordType,
  ReviewTargetKind,
  ReviewThreadStatus,
} from "@prisma/client";
import {
  REVIEW_HISTORY_FIELD_PATHS,
  ReviewThreadError,
  acceptReviewThread,
  createReviewThread,
  replyToReviewThread,
  resolveReviewThread,
} from "@/lib/qms/review/service";
import {
  countReviewThreads,
  getReviewThread,
  getReviewThreads,
  getReviewThreadsForVersion,
} from "@/lib/qms/review/queries";

const prisma = new PrismaClient();

async function main() {
  const primaryRecord = await prisma.qmsRecord.create({
    data: { recordType: QmsRecordType.CAPA, year: 2099 },
  });
  const otherRecord = await prisma.qmsRecord.create({
    data: { recordType: QmsRecordType.DEVIATION, year: 2099 },
  });
  const recordIds = [primaryRecord.id, otherRecord.id];

  try {
    const primaryVersion = await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: primaryRecord.id,
        sequenceNumber: 0,
        kind: "INITIAL",
        snapshot: { smoke: "review-r1-primary" },
      },
    });
    const otherVersion = await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: otherRecord.id,
        sequenceNumber: 0,
        kind: "INITIAL",
        snapshot: { smoke: "review-r1-other" },
      },
    });

    const thread = await createReviewThread({
      qmsRecordId: primaryRecord.id,
      recordVersionId: primaryVersion.id,
      targetKind: ReviewTargetKind.ITEM,
      tabKey: "actions",
      sectionKey: "planned-actions",
      fieldPath: "description",
      targetEntityType: "CapaPlannedAction",
      targetEntityId: "00000000-0000-4000-8000-000000000001",
      fieldLabelSnapshot: "Descripción de la acción",
      valueSnapshot: { text: "Valor visto por el revisor" },
      initialMessage: "Aclarar el alcance de esta acción.",
      createdByText: "Revisor R1",
    });
    assert.equal(thread.status, ReviewThreadStatus.PENDING);
    assert.equal(thread.recordVersionId, primaryVersion.id);
    assert.equal(thread.targetEntityId, "00000000-0000-4000-8000-000000000001");
    assert.equal(thread.messages.length, 1);
    assert.equal(thread.messages[0]?.message, "Aclarar el alcance de esta acción.");

    await replyToReviewThread({
      reviewThreadId: thread.id,
      message: "Se concreta el alcance solicitado.",
      createdByText: "Autor R1",
    });
    const pending = await getReviewThread(thread.id);
    assert.equal(pending?.status, ReviewThreadStatus.PENDING);
    assert.equal(pending?.messages.length, 2);

    const accepted = await acceptReviewThread({
      reviewThreadId: thread.id,
      acceptedByText: "Revisor R1",
    });
    assert.equal(accepted.status, ReviewThreadStatus.ACCEPTED);
    assert.equal(accepted.acceptedByText, "Revisor R1");
    assert.ok(accepted.acceptedAt instanceof Date);
    const acceptedAgain = await acceptReviewThread({
      reviewThreadId: thread.id,
      acceptedByText: "Otro usuario",
    });
    assert.equal(acceptedAgain.acceptedByText, "Revisor R1");

    await replyToReviewThread({
      reviewThreadId: thread.id,
      message: "Respuesta posterior a la aceptación.",
      createdByText: "Autor R1",
    });

    const resolved = await resolveReviewThread({
      reviewThreadId: thread.id,
      resolvedByText: "Responsable R1",
      resolutionNote: "Revisión completada.",
    });
    assert.equal(resolved.status, ReviewThreadStatus.RESOLVED);
    assert.equal(resolved.resolvedByText, "Responsable R1");
    assert.ok(resolved.resolvedAt instanceof Date);
    const resolvedAgain = await resolveReviewThread({
      reviewThreadId: thread.id,
      resolvedByText: "Otro usuario",
    });
    assert.equal(resolvedAgain.resolvedByText, "Responsable R1");

    const completeThread = await getReviewThread(thread.id);
    assert.deepEqual(
      completeThread?.messages.map((item) => item.message),
      [
        "Aclarar el alcance de esta acción.",
        "Se concreta el alcance solicitado.",
        "Respuesta posterior a la aceptación.",
      ],
    );

    await assert.rejects(
      replyToReviewThread({
        reviewThreadId: thread.id,
        message: "No debe admitirse tras resolver.",
        createdByText: "Autor R1",
      }),
      /resuelto está cerrado/i,
    );

    const history = await prisma.changeHistory.findMany({
      where: {
        qmsRecordId: primaryRecord.id,
        fieldPath: { in: Object.values(REVIEW_HISTORY_FIELD_PATHS) },
      },
      orderBy: { changedAt: "asc" },
    });
    assert.equal(history.length, 3);
    assert.deepEqual(
      history.map((item) => item.fieldPath),
      [
        REVIEW_HISTORY_FIELD_PATHS.created,
        REVIEW_HISTORY_FIELD_PATHS.accepted,
        REVIEW_HISTORY_FIELD_PATHS.resolved,
      ],
    );

    const versionThreads = await getReviewThreadsForVersion(
      primaryRecord.id,
      primaryVersion.id,
    );
    assert.deepEqual(versionThreads.map((item) => item.id), [thread.id]);

    await assert.rejects(
      createReviewThread({
        qmsRecordId: primaryRecord.id,
        recordVersionId: otherVersion.id,
        targetKind: ReviewTargetKind.RECORD,
        initialMessage: "Esta versión pertenece a otro expediente.",
        createdByText: "Revisor R1",
      }),
      (error: unknown) =>
        error instanceof ReviewThreadError &&
        error.code === "RECORD_VERSION_MISMATCH",
    );
    await assert.rejects(
      replyToReviewThread({
        reviewThreadId: thread.id,
        message: "   ",
        createdByText: "Revisor R1",
      }),
      /respuesta no puede estar vacía/i,
    );
    await assert.rejects(
      acceptReviewThread({
        reviewThreadId: thread.id,
        acceptedByText: "Revisor R1",
      }),
      /resuelto no puede volver a aceptado/i,
    );

    const directResolution = await createReviewThread({
      qmsRecordId: primaryRecord.id,
      targetKind: ReviewTargetKind.FIELD,
      fieldPath: "rootCause",
      initialMessage: "Observación resuelta directamente.",
      createdByText: "Revisor R1",
    });
    const directlyResolved = await resolveReviewThread({
      reviewThreadId: directResolution.id,
      resolvedByText: "Responsable R1",
    });
    assert.equal(directlyResolved.status, ReviewThreadStatus.RESOLVED);

    const acceptedOnly = await createReviewThread({
      qmsRecordId: primaryRecord.id,
      targetKind: ReviewTargetKind.SECTION,
      sectionKey: "effectiveness",
      initialMessage: "Observación aceptada y aún no resuelta.",
      createdByText: "Revisor R1",
    });
    await acceptReviewThread({
      reviewThreadId: acceptedOnly.id,
      acceptedByText: "Responsable R1",
    });

    await createReviewThread({
      qmsRecordId: primaryRecord.id,
      targetKind: ReviewTargetKind.RECORD,
      initialMessage: "Observación pendiente del expediente.",
      createdByText: "Revisor R1",
    });

    const counts = await countReviewThreads(primaryRecord.id);
    assert.deepEqual(counts, {
      [ReviewThreadStatus.PENDING]: 1,
      [ReviewThreadStatus.ACCEPTED]: 1,
      [ReviewThreadStatus.RESOLVED]: 2,
    });

    const ordered = await getReviewThreads(primaryRecord.id);
    assert.deepEqual(
      ordered.map((item) => item.status),
      [
        ReviewThreadStatus.PENDING,
        ReviewThreadStatus.ACCEPTED,
        ReviewThreadStatus.RESOLVED,
        ReviewThreadStatus.RESOLVED,
      ],
    );
    assert.equal(
      (await getReviewThreads(primaryRecord.id, {
        statuses: [ReviewThreadStatus.PENDING],
      })).length,
      1,
    );

    console.log(
      "R1 review comments smoke passed: thread lifecycle, messages, versions, targets, history, queries and counts.",
    );
  } finally {
    await prisma.reviewMessage.deleteMany({
      where: { reviewThread: { qmsRecordId: { in: recordIds } } },
    });
    await prisma.reviewThread.deleteMany({
      where: { qmsRecordId: { in: recordIds } },
    });
    await prisma.changeHistory.deleteMany({
      where: { qmsRecordId: { in: recordIds } },
    });
    await prisma.qmsRecordVersion.deleteMany({
      where: { qmsRecordId: { in: recordIds } },
    });
    await prisma.qmsRecord.deleteMany({ where: { id: { in: recordIds } } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
