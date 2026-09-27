export type RelationKind =
  | "GENERATES"
  | "RELATED_TO"
  | "IMPLEMENTED_BY"
  | "ASSOCIATED_WITH";

const symmetricRelations = new Set<RelationKind>([
  "RELATED_TO",
  "ASSOCIATED_WITH",
]);

export function canonicalizeRelation(
  sourceRecordId: string,
  targetRecordId: string,
  relationType: RelationKind,
) {
  if (!sourceRecordId || !targetRecordId) {
    throw new Error("Both QMS record IDs are required.");
  }
  if (sourceRecordId === targetRecordId) {
    throw new Error("A QMS record cannot be related to itself.");
  }

  if (
    symmetricRelations.has(relationType) &&
    sourceRecordId.localeCompare(targetRecordId) > 0
  ) {
    return {
      sourceRecordId: targetRecordId,
      targetRecordId: sourceRecordId,
      relationType,
    };
  }

  return { sourceRecordId, targetRecordId, relationType };
}

export function inverseRelationLabel(relationType: RelationKind): string {
  switch (relationType) {
    case "GENERATES":
      return "ORIGINATES_FROM";
    case "IMPLEMENTED_BY":
      return "IMPLEMENTS";
    case "RELATED_TO":
      return "RELATED_TO";
    case "ASSOCIATED_WITH":
      return "ASSOCIATED_WITH";
  }
}
