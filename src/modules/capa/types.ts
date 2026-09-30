export type CapaFormState = {
  error: string | null;
  fieldErrors?: string[];
  fieldIssues?: Record<string, string[]>;

  submittedValues?: Record<string, string | string[]>;
  formRevision?: number;
};

export type CapaPlannedActionInput = {
  description: string;
  responsible: string;
  plannedExecutionDate: string;
  impact: string;
};

export type CapaFormDefaults = {
  businessCode?: string;
  actionType?: "CORRECTIVE" | "PREVENTIVE";
  departmentId?: string;
  openedAt?: string;
  createdByText?: string;
  originType?: string;
  originCode?: string;
  applicableTo?: string;
  defectDescription?: string;
  rootCause?: string;
  impactAssessment?: string;
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
};


export type CapaFollowupDefaults = {
  status: "DRAFT" | "OPEN" | "CLOSED" | "CANCELLED";
  operationalClosedAt?: string;
  cancellationReason?: string;
  conclusion?: string;
  effectivenessStatus: "CONFORMING" | "NONCONFORMING" | "PENDING" | "NA";
  effectivenessCriteria?: string;
  effectivenessAssessment?: string;
  effectivenessEvidence?: string;
  effectiveClosedAt?: string;
};
