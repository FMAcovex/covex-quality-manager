import assert from "node:assert/strict";
import { PrismaClient, QmsRecordType } from "@prisma/client";
import { createCurrentVersionReviewThread } from "@/lib/qms/review/current-version-service";
import {
  capaActionFollowupReviewTarget,
  capaPlannedActionReviewTarget,
  capaReviewTargets,
} from "@/lib/qms/review/targets/capa";
import { reviewTargetWithValue } from "@/lib/qms/review/targets/catalog";
import {
  reviewTargetHref,
  reviewVersionLabel,
} from "@/lib/qms/review/ui-model";
import { getReviewThreadsForDisplay } from "@/lib/qms/review/ui-queries";

const prisma = new PrismaClient();

async function main() {
  const record = await prisma.qmsRecord.create({
    data: { recordType: QmsRecordType.CAPA, year: 2099 },
  });

  try {
    const versionZero = await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: record.id,
        sequenceNumber: 0,
        kind: "INITIAL",
        snapshot: { rootCause: "Causa inicial Seguimiento 00" },
      },
    });

    const rootCauseTarget = reviewTargetWithValue(
      capaReviewTargets.rootCause,
      "Causa inicial Seguimiento 00",
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
      initialMessage: "Revisar la causa raíz de la CAPA.",
      createdByText: "Revisor R2B2",
    });

    assert.equal(created.recordVersionId, versionZero.id);
    assert.equal(created.tabKey, "summary");
    assert.equal(created.sectionKey, "root-cause");
    assert.equal(created.fieldPath, "rootCause");
    assert.equal(reviewVersionLabel(0, "FOLLOWUP"), "Seguimiento 00 · Apertura");

    await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: record.id,
        sequenceNumber: 1,
        kind: "FOLLOWUP",
        snapshot: { rootCause: "Causa posterior Seguimiento 01" },
      },
    });

    const [displayed] = await getReviewThreadsForDisplay(record.id);
    assert.equal(displayed?.recordVersionSequence, 0);
    assert.equal(displayed?.valueSnapshot, "Causa inicial Seguimiento 00");
    assert.equal(
      reviewTargetHref("/capa/" + record.id, rootCauseTarget, created.id),
      "/capa/" +
        record.id +
        "?tab=summary&review=1&thread=" +
        created.id +
        "#review-capa-root-cause",
    );

    const plannedActionTarget = capaPlannedActionReviewTarget(
      "00000000-0000-4000-8000-000000000201",
      {
        description: "Actualizar el procedimiento",
        responsible: "GC",
        plannedExecutionDate: "15/10/2026",
        impact: "Documental",
      },
    );
    assert.equal(plannedActionTarget.targetKind, "ITEM");
    assert.equal(plannedActionTarget.targetEntityType, "CapaPlannedAction");
    assert.equal(
      plannedActionTarget.targetEntityId,
      "00000000-0000-4000-8000-000000000201",
    );

    const actionFollowupTarget = capaActionFollowupReviewTarget(
      "00000000-0000-4000-8000-000000000202",
      {
        followupDate: "02/10/2026",
        description: "Acción ejecutada",
      },
    );
    assert.equal(actionFollowupTarget.targetKind, "ITEM");
    assert.equal(
      actionFollowupTarget.targetEntityType,
      "CapaActionFollowup",
    );
    assert.equal(
      actionFollowupTarget.targetEntityId,
      "00000000-0000-4000-8000-000000000202",
    );

    const unversionedRecord = await prisma.qmsRecord.create({
      data: { recordType: QmsRecordType.CAPA, year: 2098 },
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
      valueSnapshot: "Histórico CAPA sin versión",
      initialMessage: "Revisión de histórico CAPA sin seguimiento funcional.",
      createdByText: "Revisor R2B2",
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
      "R2B2 review smoke passed: CAPA targets, follow-up labels, dynamic UUIDs, navigation, version association and unversioned support.",
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
