import type { AdditionalLot } from "@/lib/qms/additional-lots";

export type FormState = {
  error: string | null;
  fieldErrors?: string[];
  fieldIssues?: Record<string, string[]>;
  submittedValues?: Record<string, string | string[]>;
  formRevision?: number;
};

export type DepartmentOption = {
  id: string;
  code: string;
  name: string;
};

export type ImmediateActionInput = {
  description: string;
  executedBy: string;
  executedAt: string;
};

export type CapaPlanInput = {
  actionType: "CORRECTIVE" | "PREVENTIVE";
  description: string;
  plannedExecutionDate: string;
  responsible: string;
};

export type DeviationFormDefaults = {
  businessCode?: string;
  departmentId?: string;
  issueDate?: string;
  eventDateTime?: string;
  detectedBy?: string;
  createdByText?: string;
  modifiedByText?: string;
  changeReason?: string;
  materialProcessAffected?: string;
  provenance?: string;
  affectedDocumentation?: string;
  processEquipmentSystem?: string;
  finishedProductSystem?: string;
  productLot?: string;
  lotSize?: string;
  affectedQuantity?: string;
  client?: string;
  rawOrPackagingMaterial?: string;
  materialLot?: string;
  materialLotSize?: string;
  materialAffectedQuantity?: string;
  supplier?: string;
  supplierLot?: string;
  additionalLots?: AdditionalLot[];
  affectedEquipmentLine?: string;
  otherOrigin?: string;
  whatHappened?: string;
  whoInvolved?: string;
  whenHappened?: string;
  whereHappened?: string;
  howHappened?: string;
  investigation?: string;
  investigationConclusive?: "YES" | "NO" | "NA" | "";
  investigationMethods?: string[];
  rootCause?: string;
  rootCauseCategories?: string[];
  recurrentRootCause?: "YES" | "NO" | "NA" | "";
  recurrenceDetails?: string;
  classification?: "CRITICAL" | "MAJOR" | "MINOR" | "";
  validationImpact?: "YES" | "NO" | "NA" | "";
  registrationImpact?: "YES" | "NO" | "NA" | "";
  stabilityImpact?: "YES" | "NO" | "NA" | "";
  otherProcessesImpact?: "YES" | "NO" | "NA" | "";
  otherProcessesImpactDetails?: string;
  affectsFinishedProduct?: "YES" | "NO" | "NA" | "";
  capaRequired?: "" | "true" | "false";
  conclusion?: string;
  disposition?: string;
  dispositionQuantity?: string;
  dispositionComments?: string;
  clientNotification?: "YES" | "NO" | "NA" | "";
  closedAt?: string;
  status?: "DRAFT" | "OPEN" | "CLOSED";
  internalObservations?: string;
  signedDocumentAvailable?: "" | "true" | "false";
  dataQualityStatus?: "COMPLETE" | "INCOMPLETE" | "REVIEW_REQUIRED";
  immediateActions?: ImmediateActionInput[];
  capaPlans?: CapaPlanInput[];
};
