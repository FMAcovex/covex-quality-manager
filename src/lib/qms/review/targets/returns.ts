import { QmsRecordType, ReviewTargetKind } from "@prisma/client";
import {
  defineReviewTargets,
  stableReviewAnchorPart,
} from "@/lib/qms/review/targets/catalog";
import type {
  ReviewSnapshotValue,
  ReviewTargetInstance,
} from "@/lib/qms/review/targets/types";

export const returnReviewTargets = defineReviewTargets({
  generalData: {
    key: "return.summary.general-data",
    module: QmsRecordType.RETURN,
    targetKind: ReviewTargetKind.SECTION,
    tabKey: "summary",
    sectionKey: "general-data",
    fieldPath: null,
    label: "Datos generales",
    anchorId: "review-return-general-data",
  },
  reasonObservations: {
    key: "return.summary.reason-observations",
    module: QmsRecordType.RETURN,
    targetKind: ReviewTargetKind.FIELD,
    tabKey: "summary",
    sectionKey: "general-data",
    fieldPath: "reasonObservations",
    label: "Motivo / incidencias",
    anchorId: "review-return-reason-observations",
  },
  attachedDocumentation: {
    key: "return.summary.attached-documentation",
    module: QmsRecordType.RETURN,
    targetKind: ReviewTargetKind.FIELD,
    tabKey: "summary",
    sectionKey: "general-data",
    fieldPath: "attachedDocumentation",
    label: "Documentación anexada",
    anchorId: "review-return-attached-documentation",
  },
  decision: {
    key: "return.summary.decision",
    module: QmsRecordType.RETURN,
    targetKind: ReviewTargetKind.FIELD,
    tabKey: "summary",
    sectionKey: "decision",
    fieldPath: "decision",
    label: "Decisión",
    anchorId: "review-return-decision",
  },
  finalDestination: {
    key: "return.summary.final-destination",
    module: QmsRecordType.RETURN,
    targetKind: ReviewTargetKind.FIELD,
    tabKey: "summary",
    sectionKey: "decision",
    fieldPath: "finalDestination",
    label: "Destino final",
    anchorId: "review-return-final-destination",
  },
  traceabilityUpdated: {
    key: "return.summary.traceability-updated",
    module: QmsRecordType.RETURN,
    targetKind: ReviewTargetKind.FIELD,
    tabKey: "summary",
    sectionKey: "decision",
    fieldPath: "traceabilityUpdated",
    label: "Trazabilidad actualizada",
    anchorId: "review-return-traceability-updated",
  },
  products: {
    key: "return.summary.products",
    module: QmsRecordType.RETURN,
    targetKind: ReviewTargetKind.SECTION,
    tabKey: "summary",
    sectionKey: "products",
    fieldPath: null,
    label: "Productos devueltos",
    anchorId: "review-return-products",
  },
  checksGeneral: {
    key: "return.checks.general",
    module: QmsRecordType.RETURN,
    targetKind: ReviewTargetKind.SECTION,
    tabKey: "checks",
    sectionKey: "reintegration-checks",
    fieldPath: null,
    label: "Comprobaciones para posible reintegración",
    anchorId: "review-return-checks-general",
  },
  checksTemperature: {
    key: "return.checks.temperature",
    module: QmsRecordType.RETURN,
    targetKind: ReviewTargetKind.SECTION,
    tabKey: "checks",
    sectionKey: "temperature-checks",
    fieldPath: null,
    label: "Termolábiles / temperatura controlada",
    anchorId: "review-return-checks-temperature",
  },
  followups: {
    key: "return.followups.section",
    module: QmsRecordType.RETURN,
    targetKind: ReviewTargetKind.SECTION,
    tabKey: "followups",
    sectionKey: "followups",
    fieldPath: null,
    label: "Seguimientos",
    anchorId: "review-return-followups",
  },
  complaintOrigin: {
    key: "return.relations.complaint-origin",
    module: QmsRecordType.RETURN,
    targetKind: ReviewTargetKind.SECTION,
    tabKey: "relations",
    sectionKey: "complaint-origin",
    fieldPath: null,
    label: "Reclamación de origen",
    anchorId: "review-return-complaint-origin",
  },
});

export function returnProductReviewTarget(
  targetEntityId: string,
  valueSnapshot: ReviewSnapshotValue,
): ReviewTargetInstance {
  const stableId = stableReviewAnchorPart(targetEntityId);
  return {
    key: `return.summary.product.${targetEntityId}`,
    module: QmsRecordType.RETURN,
    targetKind: ReviewTargetKind.ITEM,
    tabKey: "summary",
    sectionKey: "products",
    fieldPath: "productNameCode",
    label: "Producto devuelto",
    anchorId: `review-return-product-${stableId}`,
    targetEntityType: "ReturnProduct",
    targetEntityId,
    valueSnapshot,
  };
}

export function returnFollowupReviewTarget(
  targetEntityId: string,
  valueSnapshot: ReviewSnapshotValue,
): ReviewTargetInstance {
  const stableId = stableReviewAnchorPart(targetEntityId);
  return {
    key: `return.followups.item.${targetEntityId}`,
    module: QmsRecordType.RETURN,
    targetKind: ReviewTargetKind.ITEM,
    tabKey: "followups",
    sectionKey: "followups",
    fieldPath: "comment",
    label: "Seguimiento",
    anchorId: `review-return-followup-${stableId}`,
    targetEntityType: "ReturnFollowup",
    targetEntityId,
    valueSnapshot,
  };
}
