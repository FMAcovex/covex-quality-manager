import assert from "node:assert/strict";
import { PrismaClient, QmsRecordType } from "@prisma/client";
import { createReviewThread } from "@/lib/qms/review/service";
import {
  returnFollowupReviewTarget,
  returnProductReviewTarget,
  returnReviewTargets,
} from "@/lib/qms/review/targets/returns";
import { reviewTargetWithValue } from "@/lib/qms/review/targets/catalog";
import {
  reviewTargetHref,
  reviewThreadContextLabel,
} from "@/lib/qms/review/ui-model";
import { getReviewThreadsForDisplay } from "@/lib/qms/review/ui-queries";

const prisma = new PrismaClient();

async function main() {
  const record = await prisma.qmsRecord.create({
    data: { recordType: QmsRecordType.RETURN, year: 2099 },
  });

  try {
    const technicalVersion = await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: record.id,
        sequenceNumber: 0,
        kind: "INITIAL",
        snapshot: { technicalOnly: true },
      },
    });

    const destinationTarget = reviewTargetWithValue(
      returnReviewTargets.finalDestination,
      "Destrucción controlada",
    );
    const created = await createReviewThread({
      qmsRecordId: record.id,
      recordVersionId: null,
      targetKind: destinationTarget.targetKind,
      tabKey: destinationTarget.tabKey,
      sectionKey: destinationTarget.sectionKey,
      fieldPath: destinationTarget.fieldPath,
      targetEntityType: destinationTarget.targetEntityType,
      targetEntityId: destinationTarget.targetEntityId,
      fieldLabelSnapshot: destinationTarget.label,
      valueSnapshot: destinationTarget.valueSnapshot,
      initialMessage: "Revisar el destino final.",
      createdByText: "Revisor R2B3",
    });

    assert.equal(created.recordVersionId, null);
    assert.notEqual(created.recordVersionId, technicalVersion.id);
    assert.equal(created.tabKey, "summary");
    assert.equal(created.sectionKey, "decision");
    assert.equal(created.fieldPath, "finalDestination");

    const [displayed] = await getReviewThreadsForDisplay(record.id);
    assert.equal(displayed?.recordVersionId, null);
    assert.equal(displayed?.recordVersionSequence, null);
    assert.equal(displayed?.valueSnapshot, "Destrucción controlada");
    assert.equal(
      reviewThreadContextLabel({
        tabKey: displayed?.tabKey ?? null,
        sectionKey: displayed?.sectionKey ?? null,
        sequence: displayed?.recordVersionSequence ?? null,
        showVersionContext: false,
      }),
      "summary · decision",
    );
    assert.equal(
      reviewTargetHref("/returns/" + record.id, destinationTarget, created.id),
      "/returns/" +
        record.id +
        "?tab=summary&review=1&thread=" +
        created.id +
        "#review-return-final-destination",
    );

    const productTarget = returnProductReviewTarget(
      "00000000-0000-4000-8000-000000000301",
      { productNameCode: "API-001", lot: "L-01" },
    );
    assert.equal(productTarget.targetKind, "ITEM");
    assert.equal(productTarget.targetEntityType, "ReturnProduct");
    assert.equal(
      productTarget.targetEntityId,
      "00000000-0000-4000-8000-000000000301",
    );

    const followupTarget = returnFollowupReviewTarget(
      "00000000-0000-4000-8000-000000000302",
      { comment: "Seguimiento realizado" },
    );
    assert.equal(followupTarget.targetKind, "ITEM");
    assert.equal(followupTarget.targetEntityType, "ReturnFollowup");
    assert.equal(
      followupTarget.targetEntityId,
      "00000000-0000-4000-8000-000000000302",
    );

    console.log(
      "R2B3 review smoke passed: return targets, dynamic UUIDs, navigation, hidden version context and explicit null functional-version association.",
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
