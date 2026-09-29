type FollowupRef = {
  id: string;
  sequenceNumber: number;
};

type VersionRef = {
  kind: string;
  sourceEntityId: string | null;
  sequenceNumber: number;
};

export function nextCapaFollowupSequence(
  followups: Array<{ sequenceNumber: number }>,
) {
  return Math.max(0, ...followups.map((item) => item.sequenceNumber)) + 1;
}

export function resolveCapaFollowupVersion<T extends VersionRef>(
  versions: T[],
  followup: FollowupRef,
): T | null {
  return (
    versions.find(
      (version) =>
        version.kind === "FOLLOWUP" && version.sourceEntityId === followup.id,
    ) ??
    versions.find(
      (version) =>
        version.kind === "FOLLOWUP" &&
        version.sequenceNumber === followup.sequenceNumber,
    ) ??
    null
  );
}
