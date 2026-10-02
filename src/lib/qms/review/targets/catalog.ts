import type {
  ReviewSnapshotValue,
  ReviewTargetDefinition,
  ReviewTargetInstance,
} from "@/lib/qms/review/targets/types";

export function defineReviewTargets<
  const T extends Record<string, ReviewTargetDefinition>,
>(targets: T) {
  assertUniqueReviewTargetAnchors(Object.values(targets));
  return targets;
}

export function assertUniqueReviewTargetAnchors(
  targets: ReviewTargetDefinition[],
) {
  const anchors = new Set<string>();
  for (const target of targets) {
    if (!target.anchorId || anchors.has(target.anchorId)) {
      throw new Error(`Anchor de revisión duplicado o vacío: ${target.anchorId}`);
    }
    anchors.add(target.anchorId);
  }
}

export function reviewTargetWithValue(
  target: ReviewTargetDefinition,
  valueSnapshot: ReviewSnapshotValue,
): ReviewTargetInstance {
  return {
    ...target,
    targetEntityType: null,
    targetEntityId: null,
    valueSnapshot,
  };
}

export function stableReviewAnchorPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}
