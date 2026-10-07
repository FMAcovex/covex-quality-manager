import type {
  Prisma,
  ReviewTargetKind,
  ReviewThreadStatus,
} from "@prisma/client";
import type { ReviewThreadView } from "@/lib/qms/review/ui-model";

export type CreateReviewThreadInput = {
  qmsRecordId: string;
  recordVersionId?: string | null;
  targetKind: ReviewTargetKind;
  tabKey?: string | null;
  sectionKey?: string | null;
  fieldPath?: string | null;
  targetEntityType?: string | null;
  targetEntityId?: string | null;
  fieldLabelSnapshot?: string | null;
  valueSnapshot?: Prisma.InputJsonValue | null;
  initialMessage: string;
  createdByText?: string | null;
};

export type ReplyToReviewThreadInput = {
  reviewThreadId: string;
  message: string;
  createdByText?: string | null;
};

export type AcceptReviewThreadInput = {
  reviewThreadId: string;
  acceptedByText?: string | null;
};

export type ResolveReviewThreadInput = {
  reviewThreadId: string;
  resolvedByText?: string | null;
  resolutionNote?: string | null;
};

export type ReviewThreadFilters = {
  statuses?: ReviewThreadStatus[];
  recordVersionId?: string;
};

export type ReviewThreadCounts = Record<ReviewThreadStatus, number>;

export type ReviewActionState = {
  threads?: ReviewThreadView[];
  error: string | null;
  success: string | null;
  reviewThreadId: string | null;
  status: ReviewThreadStatus | null;
};
