import type { QmsRecordType, ReviewTargetKind } from "@prisma/client";

export type ReviewSnapshotValue =
  | null
  | string
  | number
  | boolean
  | ReviewSnapshotValue[]
  | { [key: string]: ReviewSnapshotValue };

export type ReviewTargetDefinition = {
  key: string;
  module: QmsRecordType;
  targetKind: ReviewTargetKind;
  tabKey: string;
  sectionKey: string;
  fieldPath: string | null;
  label: string;
  anchorId: string;
};

export type ReviewTargetInstance = ReviewTargetDefinition & {
  targetEntityType: string | null;
  targetEntityId: string | null;
  valueSnapshot: ReviewSnapshotValue;
};
