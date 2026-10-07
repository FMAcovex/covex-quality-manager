export type CapaFormState = {
  error: string | null;
  fieldErrors?: string[];
  fieldIssues?: Record<string, string[]>;
  submittedValues?: Record<string, string | string[]>;
  formRevision?: number;
};

export type CapaSaveIntent = "SAVE_DRAFT" | "UPDATE_CURRENT" | "CREATE_FOLLOWUP_VERSION";

export type CapaPlannedActionInput = {
  description: string;
  responsible: string;
  plannedExecutionDate: string;
  impact: string;
};

export type CapaActionFollowupInput = {
  followupDate: string;
  description: string;
};

export type CapaOriginInput = {
  id: string;
  recordType: "DEVIATION" | "COMPLAINT" | "AUDIT";
  businessCode: string;
  displayLabel?: string;
  year?: number | null;
};

export type CapaFormDefaults = {
  businessCode?: string;
  actionType?: "CORRECTIVE" | "PREVENTIVE";
  departmentId?: string;
  openedAt?: string;
  versionFollowupDate?: string;
  createdByText?: string;
  originType?: string;
  originCode?: string;
  origins?: CapaOriginInput[];
  applicableTo?: string;
  defectDescription?: string;
  rootCause?: string;
  impactAssessment?: string;
  nextFollowupDate?: string;
  actionFollowupObservations?: string;
  operationalStatusDescription?: string;
  status?: "DRAFT" | "OPEN" | "CLOSED" | "CANCELLED";
  cancellationReason?: string;
  operationalClosedAt?: string;
  effectivenessStatus?: "CONFORMING" | "NONCONFORMING" | "PENDING" | "NA";
  effectivenessCriteria?: string;
  effectivenessAssessment?: string;
  effectivenessEvidence?: string;
  effectiveClosedAt?: string;
  conclusion?: string;
  internalObservations?: string;
  signedDocumentAvailable?: "" | "true" | "false";
  dataQualityStatus?: "COMPLETE" | "INCOMPLETE" | "REVIEW_REQUIRED";
  plannedActions?: CapaPlannedActionInput[];
  actionFollowups?: CapaActionFollowupInput[];
};

export type CapaFollowupDefaults = {
  status: "OPEN" | "CLOSED" | "CANCELLED";
  operationalClosedAt?: string;
  cancellationReason?: string;
  conclusion?: string;
  effectivenessStatus: "CONFORMING" | "NONCONFORMING" | "PENDING" | "NA";
  effectivenessCriteria?: string;
  effectivenessAssessment?: string;
  effectivenessEvidence?: string;
  effectiveClosedAt?: string;
};
