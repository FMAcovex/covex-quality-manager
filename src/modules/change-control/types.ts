export type ChangeControlFormState = {
  error: string | null;
  fieldErrors?: string[];

  submittedValues?: Record<string, string | string[]>;
  formRevision?: number;
};

export type ChangeTaskInput = {
  id?: string;
  departmentId: string;
  description: string;
  responsible: string;
  plannedDate: string;
};

export type ChangeControlFormDefaults = {
  businessCode?: string;
  departmentId?: string;
  requestDate?: string;
  requesterName?: string;
  requesterPosition?: string;
  scope?: string[];
  otherScope?: string;
  description?: string;
  justification?: string;
  providedDocuments?: string;
  requestDecision?: "PENDING" | "ACCEPTED" | "DENIED";
  requestDecisionResponsible?: string;
  requestDecisionRole?: string;
  requestDecisionDate?: string;
  evaluation?: string;
  classification?: "MAJOR" | "MINOR";
  plannedImplementationDate?: string;
  committeeRequired?: "" | "true" | "false";
  committeeDetails?: string;
  clientNotificationRequired?: "" | "true" | "false";
  clientNotificationDetails?: string;
  authorityRequired?: "" | "true" | "false";
  authorityDetails?: string;
  pqrRequired?: "YES" | "NO" | "NA";
  pqrProducts?: string;
  pqrPeriod?: string;
  stabilityRequired?: "YES" | "NO" | "NA";
  stabilityAccelerated?: boolean;
  stabilityOngoing?: boolean;
  additionalAnalysisRequired?: "YES" | "NO" | "NA";
  additionalAnalysisDetails?: string;
  additionalValidationRequired?: "YES" | "NO" | "NA";
  additionalValidationDetails?: string;
  otherImplicationRequired?: "" | "true" | "false";
  otherImplicationDetails?: string;
  dictamenResult?: "PENDING" | "APPROVED" | "REJECTED";
  dictamenDate?: string;
  followupResponsible?: string;
  dictamenObservations?: string;
  approvalNames?: string;
  internalObservations?: string;
  signedDocumentAvailable?: "" | "true" | "false";
  dataQualityStatus?: "COMPLETE" | "INCOMPLETE" | "REVIEW_REQUIRED";
  finalStatus?: "DRAFT" | "OPEN" | "CLOSED";
  tasks?: ChangeTaskInput[];
};

export type ChangeFollowupTaskInput = {
  taskId?: string;
  departmentId: string;
  description: string;
  responsible: string;
  plannedDate: string;
  status: "PENDING" | "COMPLETED" | "NOT_APPLICABLE";
  actualDate: string;
  evidenceComment: string;
  isNew: boolean;
};
