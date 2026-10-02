import assert from "node:assert/strict";
import { PrismaClient, QmsRecordType } from "@prisma/client";
import { createCurrentVersionReviewThread } from "@/lib/qms/review/current-version-service";
import {
  deviationCapaPlanReviewTarget,
  deviationImmediateActionReviewTarget,
  deviationReviewTargets,
} from "@/lib/qms/review/targets/deviations";
import { reviewTargetWithValue } from "@/lib/qms/review/targets/catalog";
import { reviewTargetHref } from "@/lib/qms/review/ui-model";
import { getReviewThreadsForDisplay } from "@/lib/qms/review/ui-queries";

const prisma = new PrismaClient();

async function main() {
  const record = await prisma.qmsRecord.create({
    data: { recordType: QmsRecordType.DEVIATION, year: 2099 },
  });

  try {
    const versionZero = await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: record.id,
        sequenceNumber: 0,
        kind: "INITIAL",
        snapshot: { rootCause: "Causa inicial V00" },
      },
    });

    const rootCauseTarget = reviewTargetWithValue(
      deviationReviewTargets.rootCause,
      "Causa inicial V00",
    );
    const created = await createCurrentVersionReviewThread({
      qmsRecordId: record.id,
      targetKind: rootCauseTarget.targetKind,
      tabKey: rootCauseTarget.tabKey,
      sectionKey: rootCauseTarget.sectionKey,
      fieldPath: rootCauseTarget.fieldPath,
      targetEntityType: rootCauseTarget.targetEntityType,
      targetEntityId: rootCauseTarget.targetEntityId,
      fieldLabelSnapshot: rootCauseTarget.label,
      valueSnapshot: rootCauseTarget.valueSnapshot,
      initialMessage: "Revisar la causa raíz.",
      createdByText: "Revisor R2B1",
    });

    assert.equal(created.recordVersionId, versionZero.id);
    assert.equal(created.tabKey, "investigation");
    assert.equal(created.sectionKey, "root-cause");
    assert.equal(created.fieldPath, "rootCause");

    await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: record.id,
        sequenceNumber: 1,
        kind: "FOLLOWUP",
        snapshot: { rootCause: "Causa posterior V01" },
      },
    });

    const [displayed] = await getReviewThreadsForDisplay(record.id);
    assert.equal(displayed?.recordVersionSequence, 0);
    assert.equal(displayed?.valueSnapshot, "Causa inicial V00");
    assert.equal(
      reviewTargetHref("/deviations/" + record.id, rootCauseTarget, created.id),
      "/deviations/" + record.id + "?tab=investigation&review=1&thread=" + created.id + "#review-deviation-root-cause",
    );

    const immediateActionTarget = deviationImmediateActionReviewTarget(
      "00000000-0000-4000-8000-000000000101",
      "Bloquear material",
    );
    assert.equal(immediateActionTarget.targetKind, "ITEM");
    assert.equal(
      immediateActionTarget.targetEntityType,
      "DeviationImmediateAction",
    );
    assert.equal(
      immediateActionTarget.targetEntityId,
      "00000000-0000-4000-8000-000000000101",
    );

    const capaPlanTarget = deviationCapaPlanReviewTarget(
      "00000000-0000-4000-8000-000000000102",
      "Actualizar PNT",
    );
    assert.equal(capaPlanTarget.targetKind, "ITEM");
    assert.equal(capaPlanTarget.targetEntityType, "DeviationCapaPlan");
    assert.equal(
      capaPlanTarget.targetEntityId,
      "00000000-0000-4000-8000-000000000102",
    );

    const unversionedRecord = await prisma.qmsRecord.create({
      data: { recordType: QmsRecordType.DEVIATION, year: 2098 },
    });
    const unversionedThread = await createCurrentVersionReviewThread({
      qmsRecordId: unversionedRecord.id,
      targetKind: rootCauseTarget.targetKind,
      tabKey: rootCauseTarget.tabKey,
      sectionKey: rootCauseTarget.sectionKey,
      fieldPath: rootCauseTarget.fieldPath,
      targetEntityType: rootCauseTarget.targetEntityType,
      targetEntityId: rootCauseTarget.targetEntityId,
      fieldLabelSnapshot: rootCauseTarget.label,
      valueSnapshot: "Histórico sin versión",
      initialMessage: "Revisión de histórico sin versión funcional.",
      createdByText: "Revisor R2B1",
    });
    assert.equal(unversionedThread.recordVersionId, null);

    await prisma.reviewMessage.deleteMany({
      where: { reviewThread: { qmsRecordId: unversionedRecord.id } },
    });
    await prisma.reviewThread.deleteMany({
      where: { qmsRecordId: unversionedRecord.id },
    });
    await prisma.changeHistory.deleteMany({
      where: { qmsRecordId: unversionedRecord.id },
    });
    await prisma.qmsRecord.delete({ where: { id: unversionedRecord.id } });

    console.log(
      "R2B1 review smoke passed: deviation targets, dynamic UUIDs, navigation, version association and unversioned historical support.",
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
