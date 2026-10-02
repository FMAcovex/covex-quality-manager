import assert from "node:assert/strict";
import { PrismaClient, QmsRecordType } from "@prisma/client";
import { createCurrentVersionReviewThread } from "@/lib/qms/review/current-version-service";
import { getReviewThreadsForDisplay } from "@/lib/qms/review/ui-queries";
import {
  complaintCapaPlanReviewTarget,
  complaintReviewTargets,
} from "@/lib/qms/review/targets/complaints";
import { reviewTargetWithValue } from "@/lib/qms/review/targets/catalog";
import { reviewTargetHref } from "@/lib/qms/review/ui-model";
import {
  replyToReviewThread,
  resolveReviewThread,
} from "@/lib/qms/review/service";

const prisma = new PrismaClient();

async function main() {
  const record = await prisma.qmsRecord.create({
    data: { recordType: QmsRecordType.COMPLAINT, year: 2099 },
  });

  try {
    const versionOne = await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: record.id,
        sequenceNumber: 1,
        kind: "INITIAL",
        snapshot: { rootCause: "Causa original V01" },
      },
    });
    const target = reviewTargetWithValue(
      complaintReviewTargets.rootCause,
      "Causa original V01",
    );
    const created = await createCurrentVersionReviewThread({
      qmsRecordId: record.id,
      targetKind: target.targetKind,
      tabKey: target.tabKey,
      sectionKey: target.sectionKey,
      fieldPath: target.fieldPath,
      targetEntityType: target.targetEntityType,
      targetEntityId: target.targetEntityId,
      fieldLabelSnapshot: target.label,
      valueSnapshot: target.valueSnapshot,
      initialMessage: "Revisar el análisis de causa raíz.",
      createdByText: "Revisor R2A",
    });
    assert.equal(created.recordVersionId, versionOne.id);
    assert.equal(created.tabKey, "part-i");
    assert.equal(created.sectionKey, "root-cause");
    assert.equal(created.fieldPath, "rootCause");
    assert.deepEqual(created.valueSnapshot, "Causa original V01");

    await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: record.id,
        sequenceNumber: 2,
        kind: "FOLLOWUP",
        snapshot: { rootCause: "Causa modificada V02" },
      },
    });
    const [displayed] = await getReviewThreadsForDisplay(record.id);
    assert.equal(displayed?.recordVersionSequence, 1);
    assert.equal(displayed?.valueSnapshot, "Causa original V01");
    assert.equal(
      reviewTargetHref(`/complaints/${record.id}`, target, created.id),
      `/complaints/${record.id}?tab=part-i&review=1&thread=${created.id}#review-complaint-root-cause`,
    );

    const item = complaintCapaPlanReviewTarget(
      "00000000-0000-4000-8000-000000000002",
      "Propuesta CAPA visible",
    );
    assert.equal(item.targetEntityType, "ComplaintCapaPlan");
    assert.equal(item.targetKind, "ITEM");

    await resolveReviewThread({
      reviewThreadId: created.id,
      resolvedByText: "Responsable R2A",
      resolutionNote: "Comprobación finalizada.",
    });
    await assert.rejects(
      replyToReviewThread({
        reviewThreadId: created.id,
        message: "No se debe guardar.",
        createdByText: "Revisor R2A",
      }),
      /resuelto está cerrado/i,
    );

    console.log(
      "R2A review UI smoke passed: complaint targets, navigation, current-version association and immutable V01 snapshot.",
    );
  } finally {
    await prisma.reviewMessage.deleteMany({
      where: { reviewThread: { qmsRecordId: record.id } },
    });
    await prisma.reviewThread.deleteMany({ where: { qmsRecordId: record.id } });
    await prisma.changeHistory.deleteMany({ where: { qmsRecordId: record.id } });
    await prisma.qmsRecordVersion.deleteMany({
      where: { qmsRecordId: record.id },
    });
    await prisma.qmsRecord.delete({ where: { id: record.id } });
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
