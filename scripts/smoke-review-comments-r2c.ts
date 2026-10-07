import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createCurrentVersionReviewThread } from "@/lib/qms/review/current-version-service";
import { createValidatedReviewThread, replyToValidatedReviewThread, acceptValidatedReviewThread, resolveValidatedReviewThread } from "@/lib/qms/review/mutation-service";
import { reviewTargetWithValue } from "@/lib/qms/review/targets/catalog";
import { deviationReviewTargets, deviationImmediateActionReviewTarget, deviationCapaPlanReviewTarget } from "@/lib/qms/review/targets/deviations";
import { capaReviewTargets, capaPlannedActionReviewTarget, capaActionFollowupReviewTarget } from "@/lib/qms/review/targets/capa";
import { complaintReviewTargets, complaintCapaPlanReviewTarget } from "@/lib/qms/review/targets/complaints";
import { returnReviewTargets, returnProductReviewTarget, returnFollowupReviewTarget } from "@/lib/qms/review/targets/returns";
import { changeControlReviewTargets, changeControlTaskReviewTarget, changeControlFollowupReviewTarget } from "@/lib/qms/review/targets/change-control";
import type { ReviewTargetInstance } from "@/lib/qms/review/targets/types";
import { getDeviationList } from "@/modules/deviations/queries";
import { getCapaList } from "@/modules/capa/queries";
import { getComplaintList } from "@/modules/complaints/queries";
import { getReturnList } from "@/modules/returns/queries";
import { getChangeControlList } from "@/modules/change-control/queries";
import { startNextVersion } from "@/lib/qms/versioning";

// Exercise the same validated mutation service used by the Server Actions.
// Cache invalidation belongs to the Next adapter and is covered in browser checks.
function smokeAction<T, R extends { id: string; status?: string }>(mutation: (input: T) => Promise<R>) {
  return async (value: T) => {
    try { const result = await mutation(value); return { error: null, status: result.status ?? null }; }
    catch (error) { return { error: String(error), status: null }; }
  };
}
const createReviewThreadAction = smokeAction(createValidatedReviewThread);
const replyToReviewThreadAction = smokeAction(replyToValidatedReviewThread);
const acceptReviewThreadAction = smokeAction(acceptValidatedReviewThread);
const resolveReviewThreadAction = smokeAction(resolveValidatedReviewThread);
const recordIds: string[] = [];
const prefix = `R2C-${randomUUID()}`;
const input = (qmsRecordId: string, target: ReviewTargetInstance) => ({
  qmsRecordId, targetKind: target.targetKind, tabKey: target.tabKey,
  sectionKey: target.sectionKey, fieldPath: target.fieldPath,
  targetEntityType: target.targetEntityType, targetEntityId: target.targetEntityId,
  fieldLabelSnapshot: target.label, valueSnapshot: target.valueSnapshot,
  initialMessage: "Observación R2C", createdByText: "Smoke R2C",
});

async function main() {
  const configurations = [
    { type: QmsRecordType.DEVIATION, target: deviationReviewTargets.rootCause, list: getDeviationList },
    { type: QmsRecordType.CAPA, target: capaReviewTargets.rootCause, list: getCapaList },
    { type: QmsRecordType.COMPLAINT, target: complaintReviewTargets.rootCause, list: getComplaintList },
    { type: QmsRecordType.RETURN, target: returnReviewTargets.reasonObservations, list: getReturnList },
    { type: QmsRecordType.CHANGE_CONTROL, target: changeControlReviewTargets.justification, list: getChangeControlList },
  ];
  try {
    for (const configuration of configurations) {
      const record = await prisma.qmsRecord.create({ data: {
        recordType: configuration.type, businessCode: `${prefix}-${configuration.type}`, year: 2099,
      } });
      recordIds.push(record.id);
      switch (configuration.type) {
        case "DEVIATION": await prisma.deviation.create({ data: { qmsRecordId: record.id } }); break;
        case "CAPA": await prisma.capa.create({ data: { qmsRecordId: record.id, actionType: "CORRECTIVE" } }); break;
        case "COMPLAINT": await prisma.complaint.create({ data: { qmsRecordId: record.id, complaintType: "CUSTOMER" } }); break;
        case "RETURN": await prisma.returnRecord.create({ data: { qmsRecordId: record.id, returnType: "COMMERCIAL" } }); break;
        case "CHANGE_CONTROL": await prisma.changeControl.create({ data: { qmsRecordId: record.id } }); break;
      }
      const version = await prisma.qmsRecordVersion.create({ data: {
        qmsRecordId: record.id, sequenceNumber: 0, kind: "INITIAL", snapshot: { value: "Apertura" },
      } });
      const target = reviewTargetWithValue(configuration.target, "Valor original 00");
      const untouched = await configuration.list({ q: record.businessCode!, review: "NONE" });
      assert.deepEqual(untouched.rows[0]?.reviewCounts, { pending: 0, accepted: 0 });
      const pending = await createCurrentVersionReviewThread(input(record.id, target));
      assert.equal(pending.recordVersionId, configuration.type === "RETURN" ? null : version.id);
      const accepted = await createCurrentVersionReviewThread(input(record.id, target));
      assert.equal((await acceptReviewThreadAction({ qmsRecordId: record.id, reviewThreadId: accepted.id })).status, "ACCEPTED");
      const resolved = await createCurrentVersionReviewThread(input(record.id, target));
      assert.equal((await resolveReviewThreadAction({ qmsRecordId: record.id, reviewThreadId: resolved.id, resolutionNote: "Corregido" })).status, "RESOLVED");
      assert.equal((await replyToReviewThreadAction({ qmsRecordId: record.id, reviewThreadId: pending.id, message: "Respuesta" })).error, null);
      assert.ok((await replyToReviewThreadAction({ qmsRecordId: record.id, reviewThreadId: resolved.id, message: "Reapertura ilícita" })).error);
      assert.ok((await acceptReviewThreadAction({ qmsRecordId: record.id, reviewThreadId: resolved.id })).error);
      assert.ok((await replyToReviewThreadAction({ qmsRecordId: record.id, reviewThreadId: randomUUID(), message: "Inexistente" })).error);
      for (const action of [acceptReviewThreadAction, resolveReviewThreadAction]) {
        assert.ok((await action({ qmsRecordId: record.id, reviewThreadId: randomUUID() })).error);
      }
      assert.ok((await createReviewThreadAction({ ...input(record.id, target), tabKey: "inventada" })).error);
      assert.ok((await createReviewThreadAction({ ...input(record.id, target), fieldPath: "inventado" })).error);
      if (recordIds.length > 1) {
        const foreign = recordIds[0];
        for (const action of [acceptReviewThreadAction, resolveReviewThreadAction]) {
          assert.ok((await action({ qmsRecordId: foreign, reviewThreadId: pending.id })).error);
        }
        assert.ok((await replyToReviewThreadAction({ qmsRecordId: foreign, reviewThreadId: pending.id, message: "Intruso" })).error);
        const foreignVersion = await prisma.qmsRecordVersion.findFirstOrThrow({ where: { qmsRecordId: foreign } });
        assert.ok((await createReviewThreadAction({ ...input(record.id, target), recordVersionId: foreignVersion.id })).error);
      }
      for (const review of ["", "PENDING", "ACCEPTED", "ACTIVE", "NONE"]) {
        const result = await configuration.list({ q: record.businessCode!, review });
        assert.equal(result.rows.length, review === "NONE" ? 0 : 1);
        if (result.rows.length) assert.deepEqual(result.rows[0].reviewCounts, { pending: 1, accepted: 1 });
      }
      await resolveReviewThreadAction({ qmsRecordId: record.id, reviewThreadId: pending.id });
      await resolveReviewThreadAction({ qmsRecordId: record.id, reviewThreadId: accepted.id });
      const neutral = await configuration.list({ q: record.businessCode!, review: "NONE" });
      assert.deepEqual(neutral.rows[0]?.reviewCounts, { pending: 0, accepted: 0 });

      const dynamicTargets: ReviewTargetInstance[] = [];
      if (configuration.type === "DEVIATION") {
        const parent = await prisma.deviation.findUniqueOrThrow({ where: { qmsRecordId: record.id } });
        const action = await prisma.deviationImmediateAction.create({ data: { deviationId: parent.id, description: "Acción" } });
        const plan = await prisma.deviationCapaPlan.create({ data: { deviationId: parent.id, description: "Propuesta", actionType: "CORRECTIVE" } });
        dynamicTargets.push(deviationImmediateActionReviewTarget(action.id, action.description), deviationCapaPlanReviewTarget(plan.id, plan.description));
      } else if (configuration.type === "CAPA") {
        const parent = await prisma.capa.findUniqueOrThrow({ where: { qmsRecordId: record.id } });
        const action = await prisma.capaPlannedAction.create({ data: { capaId: parent.id, description: "Acción" } });
        const followup = await prisma.capaActionFollowup.create({ data: { capaId: parent.id, description: "Seguimiento" } });
        dynamicTargets.push(capaPlannedActionReviewTarget(action.id, action.description), capaActionFollowupReviewTarget(followup.id, followup.description));
      } else if (configuration.type === "COMPLAINT") {
        const parent = await prisma.complaint.findUniqueOrThrow({ where: { qmsRecordId: record.id } });
        const plan = await prisma.complaintCapaPlan.create({ data: { complaintId: parent.id, description: "Propuesta", actionType: "CORRECTIVE" } });
        dynamicTargets.push(complaintCapaPlanReviewTarget(plan.id, plan.description));
      } else if (configuration.type === "RETURN") {
        const parent = await prisma.returnRecord.findUniqueOrThrow({ where: { qmsRecordId: record.id } });
        const product = await prisma.returnProduct.create({ data: { returnRecordId: parent.id, productType: "MEDICINE", productNameCode: "Producto" } });
        const followup = await prisma.returnFollowup.create({ data: { returnRecordId: parent.id, followupDate: new Date(), completedByText: "QA", comment: "Seguimiento" } });
        dynamicTargets.push(returnProductReviewTarget(product.id, product.productNameCode), returnFollowupReviewTarget(followup.id, followup.comment));
      }
      if (dynamicTargets.length) {
        const foreign = await prisma.qmsRecord.create({ data: { recordType: configuration.type, year: 2099 } });
        recordIds.push(foreign.id);
        for (const dynamic of dynamicTargets) {
          const owned = await createCurrentVersionReviewThread(input(record.id, dynamic));
          assert.equal(owned.targetEntityId, dynamic.targetEntityId);
          assert.ok((await createReviewThreadAction(input(foreign.id, dynamic))).error);
          assert.ok((await createReviewThreadAction({ ...input(record.id, dynamic), targetEntityId: randomUUID() })).error);
          await resolveReviewThreadAction({ qmsRecordId: record.id, reviewThreadId: owned.id });
        }
      }

      if (configuration.type === "CHANGE_CONTROL") {
        const change = await prisma.changeControl.findUniqueOrThrow({ where: { qmsRecordId: record.id } });
        const task = await prisma.changeControlTask.create({ data: { changeControlId: change.id, description: "Acción inicial", origin: "DICTAMEN" } });
        const opening = await prisma.changeControlFollowup.create({ data: {
          changeControlId: change.id, sequenceNumber: 0, followupDate: new Date("2099-01-01"), responsible: "QA",
          executionStatus: "NOT_EXECUTED", effectivenessStatus: "PENDING",
          taskStates: { create: { taskId: task.id, status: "PENDING", evidenceComment: "Evidencia 00" } },
        } });
        const taskTarget = changeControlTaskReviewTarget(task.id, { description: task.description });
        const openingTarget = changeControlFollowupReviewTarget(opening.id, { observations: "Apertura", evidence: "Evidencia 00" }, 0);
        const taskThread = await createCurrentVersionReviewThread(input(record.id, taskTarget));
        const openingThread = await createCurrentVersionReviewThread(input(record.id, openingTarget));
        const dictamenThread = await createCurrentVersionReviewThread(input(record.id, reviewTargetWithValue(changeControlReviewTargets.evaluation, "Evaluación 00")));
        const requirementThread = await createCurrentVersionReviewThread(input(record.id, reviewTargetWithValue(changeControlReviewTargets.committee, { evaluation: "Sí", detail: "Reunir comité" })));
        assert.equal(dictamenThread.recordVersionId, version.id);
        assert.equal(requirementThread.recordVersionId, version.id);
        assert.equal(openingThread.targetEntityId, opening.id);
        assert.equal(openingThread.recordVersionId, version.id);
        assert.ok((await createReviewThreadAction(input(recordIds[0], taskTarget))).error);
        assert.ok((await createReviewThreadAction(input(record.id, changeControlTaskReviewTarget(randomUUID(), null)))).error);
        assert.ok((await createReviewThreadAction(input(record.id, changeControlFollowupReviewTarget(randomUUID(), null)))).error);
        const other = await prisma.qmsRecord.create({ data: { recordType: "CHANGE_CONTROL", year: 2099 } });
        recordIds.push(other.id);
        assert.ok((await createReviewThreadAction(input(other.id, taskTarget))).error);
        assert.ok((await createReviewThreadAction(input(other.id, openingTarget))).error);
        const followup01 = await prisma.changeControlFollowup.create({ data: {
          changeControlId: change.id, sequenceNumber: 1, followupDate: new Date("2099-01-02"), responsible: "QA",
          executionStatus: "EXECUTED", effectivenessStatus: "ACCEPTABLE",
        } });
        const next = await prisma.$transaction((tx) => startNextVersion(tx, record.id, "FOLLOWUP", { value: "Seguimiento 01" }, "QA", "Smoke 00→01", followup01.id));
        const newer = await createCurrentVersionReviewThread(input(record.id, target));
        assert.equal(newer.recordVersionId, next.id);
        assert.ok((await createReviewThreadAction({ ...input(record.id, target), recordVersionId: version.id })).error);
        const historical = await prisma.reviewThread.findUniqueOrThrow({ where: { id: taskThread.id } });
        assert.equal(historical.recordVersionId, version.id);
        assert.deepEqual(historical.valueSnapshot, { description: "Acción inicial" });
        assert.equal((await prisma.qmsRecordVersion.findUniqueOrThrow({ where: { id: version.id } })).frozenAt !== null, true);
        await prisma.changeControlTask.update({ where: { id: task.id }, data: { description: "Texto cambiado", sortOrder: 99 } });
        assert.equal((await prisma.reviewThread.findUniqueOrThrow({ where: { id: taskThread.id } })).targetEntityId, task.id);
      }
      console.log(`R2C ${configuration.type}: filters, counts, replies, state security and version association passed.`);
    }
    console.log("R2C PostgreSQL smoke passed: five real list queries; CC UUID ownership and 00→01 historical immutability.");
  } finally {
    const where = { qmsRecordId: { in: recordIds } };
    await prisma.reviewMessage.deleteMany({ where: { reviewThread: where } });
    await prisma.reviewThread.deleteMany({ where });
    await prisma.changeHistory.deleteMany({ where });
    await prisma.qmsRecordVersion.deleteMany({ where });
    await prisma.changeControlTaskState.deleteMany({ where: { task: { changeControl: where } } });
    await prisma.changeControl.deleteMany({ where });
    await prisma.deviation.deleteMany({ where });
    await prisma.capa.deleteMany({ where });
    await prisma.complaint.deleteMany({ where });
    await prisma.returnRecord.deleteMany({ where });
    await prisma.qmsRecord.deleteMany({ where: { id: { in: recordIds } } });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
