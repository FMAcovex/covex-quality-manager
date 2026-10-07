import type { QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ReviewThreadError } from "@/lib/qms/review/service";
import type { CreateReviewThreadInput } from "@/lib/qms/review/types";
import { deviationReviewTargets, deviationImmediateActionReviewTarget, deviationCapaPlanReviewTarget } from "@/lib/qms/review/targets/deviations";
import { capaReviewTargets, capaPlannedActionReviewTarget, capaActionFollowupReviewTarget } from "@/lib/qms/review/targets/capa";
import { complaintReviewTargets, complaintCapaPlanReviewTarget } from "@/lib/qms/review/targets/complaints";
import { returnReviewTargets, returnProductReviewTarget, returnFollowupReviewTarget } from "@/lib/qms/review/targets/returns";
import { changeControlReviewTargets, changeControlTaskReviewTarget, changeControlFollowupReviewTarget } from "@/lib/qms/review/targets/change-control";

const catalogs = {
  DEVIATION: Object.values(deviationReviewTargets),
  CAPA: Object.values(capaReviewTargets),
  COMPLAINT: Object.values(complaintReviewTargets),
  RETURN: Object.values(returnReviewTargets),
  CHANGE_CONTROL: Object.values(changeControlReviewTargets),
};

const dynamicTargets = [
  deviationImmediateActionReviewTarget, deviationCapaPlanReviewTarget,
  capaPlannedActionReviewTarget, capaActionFollowupReviewTarget,
  complaintCapaPlanReviewTarget, returnProductReviewTarget, returnFollowupReviewTarget,
  changeControlTaskReviewTarget, changeControlFollowupReviewTarget,
];

export function isAllowedReviewTarget(module: QmsRecordType, input: CreateReviewThreadInput) {
  const targets = input.targetKind === "ITEM"
    ? dynamicTargets.map((factory) => factory(input.targetEntityId ?? "", null))
    : (catalogs[module as keyof typeof catalogs] ?? []);
  return targets.some((target) =>
    target.module === module &&
    target.targetKind === input.targetKind &&
    target.tabKey === (input.tabKey ?? null) &&
    target.sectionKey === (input.sectionKey ?? null) &&
    target.fieldPath === (input.fieldPath ?? null) &&
    (input.targetKind === "ITEM"
      ? "targetEntityType" in target && target.targetEntityType === input.targetEntityType && Boolean(input.targetEntityId)
      : !input.targetEntityId && !input.targetEntityType),
  );
}

export async function validateCatalogReviewTarget(input: CreateReviewThreadInput) {
  const record = await prisma.qmsRecord.findUnique({
    where: { id: input.qmsRecordId }, select: { recordType: true },
  });
  if (!record) throw new ReviewThreadError("QMS_RECORD_NOT_FOUND", "El expediente QMS no existe.");
  if (!isAllowedReviewTarget(record.recordType, input)) {
    throw new ReviewThreadError("INVALID_INPUT", "El objetivo de revisión no está permitido para este módulo.");
  }
  if (input.targetKind !== "ITEM") return record.recordType;
  const id = input.targetEntityId!;
  const qmsRecordId = input.qmsRecordId;
  let belongs = false;
  switch (input.targetEntityType) {
    case "DeviationImmediateAction":
      belongs = Boolean(await prisma.deviationImmediateAction.findFirst({ where: { id, deviation: { qmsRecordId } }, select: { id: true } })); break;
    case "DeviationCapaPlan":
      belongs = Boolean(await prisma.deviationCapaPlan.findFirst({ where: { id, deviation: { qmsRecordId } }, select: { id: true } })); break;
    case "CapaPlannedAction":
      belongs = Boolean(await prisma.capaPlannedAction.findFirst({ where: { id, capa: { qmsRecordId } }, select: { id: true } })); break;
    case "CapaActionFollowup":
      belongs = Boolean(await prisma.capaActionFollowup.findFirst({ where: { id, capa: { qmsRecordId } }, select: { id: true } })); break;
    case "ComplaintCapaPlan":
      belongs = Boolean(await prisma.complaintCapaPlan.findFirst({ where: { id, complaint: { qmsRecordId } }, select: { id: true } })); break;
    case "ReturnProduct":
      belongs = Boolean(await prisma.returnProduct.findFirst({ where: { id, returnRecord: { qmsRecordId } }, select: { id: true } })); break;
    case "ReturnFollowup":
      belongs = Boolean(await prisma.returnFollowup.findFirst({ where: { id, returnRecord: { qmsRecordId } }, select: { id: true } })); break;
    case "ChangeControlTask":
      belongs = Boolean(await prisma.changeControlTask.findFirst({ where: { id, changeControl: { qmsRecordId } }, select: { id: true } })); break;
    case "ChangeControlFollowup":
      belongs = Boolean(await prisma.changeControlFollowup.findFirst({ where: { id, changeControl: { qmsRecordId } }, select: { id: true } })); break;
  }
  if (!belongs) throw new ReviewThreadError("INVALID_INPUT", "El elemento revisado no pertenece a este expediente.");
  return record.recordType;
}

export async function assertReviewThreadOwnership(qmsRecordId: string, reviewThreadId: string) {
  if (!qmsRecordId?.trim()) throw new ReviewThreadError("INVALID_INPUT", "El expediente QMS es obligatorio.");
  const thread = await prisma.reviewThread.findFirst({
    where: { id: reviewThreadId, qmsRecordId }, select: { id: true },
  });
  if (!thread) throw new ReviewThreadError("REVIEW_THREAD_NOT_FOUND", "El hilo no existe en este expediente.");
}
