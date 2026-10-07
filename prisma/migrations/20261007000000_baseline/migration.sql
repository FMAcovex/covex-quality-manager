-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "QmsRecordType" AS ENUM ('DEVIATION', 'CAPA', 'CHANGE_CONTROL', 'COMPLAINT', 'RETURN');

-- CreateEnum
CREATE TYPE "QmsRelationType" AS ENUM ('GENERATES', 'RELATED_TO', 'IMPLEMENTED_BY', 'ASSOCIATED_WITH');

-- CreateEnum
CREATE TYPE "TriState" AS ENUM ('YES', 'NO', 'NA');

-- CreateEnum
CREATE TYPE "DeviationClassification" AS ENUM ('CRITICAL', 'MAJOR', 'MINOR');

-- CreateEnum
CREATE TYPE "DeviationStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "DataQualityStatus" AS ENUM ('COMPLETE', 'INCOMPLETE', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "DeadlineStatus" AS ENUM ('NOT_EVALUATED', 'IN_TIME', 'OUT_OF_TIME', 'NA');

-- CreateEnum
CREATE TYPE "InvestigationMethod" AS ENUM ('BRAINSTORMING', 'FIVE_WHYS', 'FTA', 'ISHIKAWA');

-- CreateEnum
CREATE TYPE "CapaActionType" AS ENUM ('CORRECTIVE', 'PREVENTIVE');

-- CreateEnum
CREATE TYPE "CapaProposalStatus" AS ENUM ('PROPOSED', 'REGISTERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CapaStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CapaEffectivenessStatus" AS ENUM ('CONFORMING', 'NONCONFORMING', 'PENDING', 'NA');

-- CreateEnum
CREATE TYPE "ChangeControlScope" AS ENUM ('INSTALLATIONS', 'EQUIPMENT', 'PROCESS', 'MATERIAL', 'SUPPLIER', 'DOCUMENTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ChangeControlClassification" AS ENUM ('MAJOR', 'MINOR');

-- CreateEnum
CREATE TYPE "ChangeRequestDecision" AS ENUM ('PENDING', 'ACCEPTED', 'DENIED');

-- CreateEnum
CREATE TYPE "ChangeDictamenResult" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ChangeExecutionStatus" AS ENUM ('NOT_EXECUTED', 'EXECUTED');

-- CreateEnum
CREATE TYPE "ChangeEffectivenessStatus" AS ENUM ('PENDING', 'ACCEPTABLE', 'NOT_ACCEPTABLE', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "ChangeFinalStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ChangeTaskOrigin" AS ENUM ('DICTAMEN', 'FOLLOWUP');

-- CreateEnum
CREATE TYPE "ChangeTaskStatus" AS ENUM ('PENDING', 'COMPLETED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "ComplaintType" AS ENUM ('PROVIDER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "ComplaintClassification" AS ENUM ('CRITICAL', 'MAJOR', 'MINOR', 'NO_GMP_IMPACT');

-- CreateEnum
CREATE TYPE "ComplaintInvestigationResult" AS ENUM ('PROCEDENT', 'NOT_PROCEDENT', 'INCONCLUSIVE', 'NOT_ATTRIBUTABLE_TO_COVEX');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ComplaintEffectivenessStatus" AS ENUM ('PENDING', 'ACCEPTABLE', 'NOT_ACCEPTABLE', 'NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "ComplaintResolutionAction" AS ENUM ('RETURN', 'CORRECTIVE_ACTION', 'PREVENTIVE_ACTION', 'IMMEDIATE_ACTION', 'RECALL', 'CREDIT', 'REPLACEMENT', 'REJECT', 'REPROCESS', 'DISPOSE', 'KEEP_AS_IS', 'SUPPLIER_INVESTIGATION', 'SUPPLIER_EVALUATION', 'OPEN_DEVIATION', 'OPEN_CAPA', 'OPEN_CHANGE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReturnType" AS ENUM ('COMMERCIAL', 'COMPLAINT', 'RECALL', 'EXPIRY', 'TRANSPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReturnProductType" AS ENUM ('API', 'INTERMEDIATE', 'MEDICINE', 'SUPPLEMENT', 'IMPORTED_PRODUCT', 'MEDICAL_DEVICE', 'COSMETIC', 'OTHER');

-- CreateEnum
CREATE TYPE "ReturnDecision" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "HistorySource" AS ENUM ('UI', 'IMPORT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PREPARED');

-- CreateEnum
CREATE TYPE "RecordVersionKind" AS ENUM ('INITIAL', 'REOPENING', 'FOLLOWUP', 'HISTORICAL_STATE');

-- CreateEnum
CREATE TYPE "RecordVersionDocumentKind" AS ENUM ('SIGNED_PDF', 'RETURN_ANNEX_III_SIGNED', 'RETURN_ANNEX_V_SIGNED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('DEVIATION_ANNEX_III', 'DEVIATION_ANNEX_V', 'SIMPLE_LIST', 'CAPA_ANNEX_III', 'CAPA_ANNEX_IV', 'CAPA_SIMPLE_LIST', 'CHANGE_ANNEX_III', 'CHANGE_ANNEX_IV', 'CHANGE_ANNEX_V', 'CHANGE_ANNEX_VII', 'CHANGE_SIMPLE_LIST', 'COMPLAINT_ANNEX_III', 'COMPLAINT_ANNEX_IV', 'COMPLAINT_ANNEX_V', 'COMPLAINT_SIMPLE_LIST', 'RETURN_ANNEX_III', 'RETURN_ANNEX_IV', 'RETURN_ANNEX_V', 'RETURN_ANNEX_VI', 'RETURN_SIMPLE_LIST');

-- CreateEnum
CREATE TYPE "HistoricalImportRowResult" AS ENUM ('IMPORTED', 'SKIPPED_DUPLICATE', 'REJECTED', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "FormVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "ConfigFieldKind" AS ENUM ('STRUCTURAL', 'VERSIONED', 'OPERATIONAL', 'DERIVED');

-- CreateEnum
CREATE TYPE "ConfigValueType" AS ENUM ('TEXT', 'LONG_TEXT', 'DATE', 'DATETIME', 'BOOLEAN', 'SELECT', 'MULTISELECT', 'NUMBER', 'REFERENCE');

-- CreateEnum
CREATE TYPE "ParameterValueType" AS ENUM ('TEXT', 'INTEGER', 'BOOLEAN', 'JSON');

-- CreateEnum
CREATE TYPE "AlertRuleKind" AS ENUM ('FOLLOWUP_DUE', 'EFFECTIVENESS_PENDING', 'PLANNED_EXECUTION_DUE');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ReviewThreadStatus" AS ENUM ('PENDING', 'ACCEPTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ReviewTargetKind" AS ENUM ('RECORD', 'SECTION', 'FIELD', 'ITEM');

-- CreateTable
CREATE TABLE "QmsRecord" (
    "id" TEXT NOT NULL,
    "recordType" "QmsRecordType" NOT NULL,
    "businessCode" TEXT,
    "annulledBusinessCode" TEXT,
    "year" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "annulledAt" TIMESTAMP(3),
    "annulledByText" TEXT,
    "annulledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QmsRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QmsRelation" (
    "id" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "targetRecordId" TEXT NOT NULL,
    "relationType" "QmsRelationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByText" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "QmsRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" DATE,
    "validTo" DATE,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormVersion" (
    "id" TEXT NOT NULL,
    "module" "QmsRecordType" NOT NULL,
    "versionCode" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" "FormVersionStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormFieldConfig" (
    "id" TEXT NOT NULL,
    "formVersionId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "sectionLabel" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "kind" "ConfigFieldKind" NOT NULL,
    "valueType" "ConfigValueType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "listAvailable" BOOLEAN NOT NULL DEFAULT false,
    "listVisibleByDefault" BOOLEAN NOT NULL DEFAULT false,
    "filterable" BOOLEAN NOT NULL DEFAULT false,
    "simpleExport" BOOLEAN NOT NULL DEFAULT false,
    "officialAnnexField" BOOLEAN NOT NULL DEFAULT false,
    "editableDefinition" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormFieldConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateVersion" (
    "id" TEXT NOT NULL,
    "module" "QmsRecordType" NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "versionCode" TEXT NOT NULL,
    "filePath" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileData" BYTEA,
    "fileSize" INTEGER,
    "checksum" TEXT,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deviation" (
    "id" TEXT NOT NULL,
    "qmsRecordId" TEXT NOT NULL,
    "departmentId" TEXT,
    "departmentCodeSnapshot" TEXT,
    "departmentNameSnapshot" TEXT,
    "issueDate" DATE,
    "eventDateTime" TIMESTAMP(3),
    "detectedBy" TEXT,
    "createdByText" TEXT,
    "materialProcessAffected" TEXT,
    "provenance" TEXT,
    "deadlineStatus" "DeadlineStatus" NOT NULL DEFAULT 'NOT_EVALUATED',
    "formVersionId" TEXT,
    "anexoIIITemplateVersionId" TEXT,
    "processEquipmentSystem" TEXT,
    "finishedProductSystem" TEXT,
    "productLot" TEXT,
    "lotSize" TEXT,
    "affectedQuantity" TEXT,
    "client" TEXT,
    "rawOrPackagingMaterial" TEXT,
    "materialLot" TEXT,
    "materialLotSize" TEXT,
    "materialAffectedQuantity" TEXT,
    "supplier" TEXT,
    "supplierLot" TEXT,
    "affectedEquipmentLine" TEXT,
    "otherOrigin" TEXT,
    "affectedDocumentation" TEXT,
    "whatHappened" TEXT,
    "whoInvolved" TEXT,
    "whenHappened" TEXT,
    "whereHappened" TEXT,
    "howHappened" TEXT,
    "investigation" TEXT,
    "investigationConclusive" "TriState",
    "investigationMethods" "InvestigationMethod"[] DEFAULT ARRAY[]::"InvestigationMethod"[],
    "rootCause" TEXT,
    "recurrentRootCause" "TriState",
    "recurrenceDetails" TEXT,
    "classification" "DeviationClassification",
    "validationImpact" "TriState",
    "registrationImpact" "TriState",
    "stabilityImpact" "TriState",
    "otherProcessesImpact" "TriState",
    "otherProcessesImpactDetails" TEXT,
    "affectsFinishedProduct" "TriState",
    "capaRequired" BOOLEAN,
    "conclusion" TEXT,
    "disposition" TEXT,
    "dispositionQuantity" TEXT,
    "dispositionComments" TEXT,
    "clientNotification" "TriState",
    "closedAt" DATE,
    "status" "DeviationStatus" NOT NULL DEFAULT 'OPEN',
    "internalObservations" TEXT,
    "signedDocumentAvailable" BOOLEAN,
    "dataQualityStatus" "DataQualityStatus" NOT NULL DEFAULT 'REVIEW_REQUIRED',
    "includeInKpi" BOOLEAN NOT NULL DEFAULT true,
    "kpiExclusionReason" TEXT,
    "extraData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deviation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviationImmediateAction" (
    "id" TEXT NOT NULL,
    "deviationId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "executedBy" TEXT,
    "executedAt" DATE,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviationImmediateAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviationFollowup" (
    "id" TEXT NOT NULL,
    "deviationId" TEXT NOT NULL,
    "followupDate" DATE NOT NULL,
    "completedByText" TEXT NOT NULL,
    "followupType" TEXT,
    "comment" TEXT NOT NULL,
    "nextFollowupDate" DATE,
    "evidenceReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviationFollowup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviationCapaPlan" (
    "id" TEXT NOT NULL,
    "deviationId" TEXT NOT NULL,
    "actionType" "CapaActionType" NOT NULL,
    "description" TEXT NOT NULL,
    "plannedExecutionDate" DATE,
    "responsible" TEXT,
    "businessCapaCode" TEXT,
    "linkedCapaRecordId" TEXT,
    "proposalStatus" "CapaProposalStatus" NOT NULL DEFAULT 'PROPOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviationCapaPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Capa" (
    "id" TEXT NOT NULL,
    "qmsRecordId" TEXT NOT NULL,
    "actionType" "CapaActionType" NOT NULL,
    "departmentId" TEXT,
    "departmentCodeSnapshot" TEXT,
    "departmentNameSnapshot" TEXT,
    "openedAt" DATE,
    "createdByText" TEXT,
    "originType" TEXT,
    "originCode" TEXT,
    "applicableTo" TEXT,
    "defectDescription" TEXT,
    "rootCause" TEXT,
    "impactAssessment" TEXT,
    "nextFollowupDate" DATE,
    "actionFollowupObservations" TEXT,
    "operationalStatusDescription" TEXT,
    "operationalClosedAt" DATE,
    "status" "CapaStatus" NOT NULL DEFAULT 'OPEN',
    "cancellationReason" TEXT,
    "effectivenessStatus" "CapaEffectivenessStatus" NOT NULL DEFAULT 'PENDING',
    "effectivenessCriteria" TEXT,
    "effectivenessAssessment" TEXT,
    "effectivenessEvidence" TEXT,
    "effectiveClosedAt" DATE,
    "conclusion" TEXT,
    "internalObservations" TEXT,
    "signedDocumentAvailable" BOOLEAN,
    "dataQualityStatus" "DataQualityStatus" NOT NULL DEFAULT 'REVIEW_REQUIRED',
    "includeInKpi" BOOLEAN NOT NULL DEFAULT true,
    "kpiExclusionReason" TEXT,
    "formVersionId" TEXT,
    "annexIIITemplateVersionId" TEXT,
    "extraData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Capa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapaPlannedAction" (
    "id" TEXT NOT NULL,
    "capaId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsible" TEXT,
    "plannedExecutionDate" DATE,
    "impact" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapaPlannedAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapaActionFollowup" (
    "id" TEXT NOT NULL,
    "capaId" TEXT NOT NULL,
    "followupDate" DATE,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapaActionFollowup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapaFollowup" (
    "id" TEXT NOT NULL,
    "capaId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "followupDate" DATE NOT NULL,
    "completedByText" TEXT NOT NULL,
    "reason" TEXT,
    "description" TEXT NOT NULL,
    "observations" TEXT,
    "evidenceReference" TEXT,
    "nextFollowupDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapaFollowup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeControl" (
    "id" TEXT NOT NULL,
    "qmsRecordId" TEXT NOT NULL,
    "departmentId" TEXT,
    "departmentCodeSnapshot" TEXT,
    "departmentNameSnapshot" TEXT,
    "requestDate" DATE,
    "requesterName" TEXT,
    "requesterPosition" TEXT,
    "scope" "ChangeControlScope"[] DEFAULT ARRAY[]::"ChangeControlScope"[],
    "otherScope" TEXT,
    "description" TEXT,
    "justification" TEXT,
    "providedDocuments" TEXT,
    "requestDecision" "ChangeRequestDecision" NOT NULL DEFAULT 'PENDING',
    "requestDecisionResponsible" TEXT,
    "requestDecisionRole" TEXT,
    "requestDecisionDate" DATE,
    "evaluation" TEXT,
    "classification" "ChangeControlClassification",
    "plannedImplementationDate" DATE,
    "committeeRequired" BOOLEAN,
    "committeeDetails" TEXT,
    "clientNotificationRequired" BOOLEAN,
    "clientNotificationDetails" TEXT,
    "authorityRequired" BOOLEAN,
    "authorityDetails" TEXT,
    "pqrRequired" "TriState",
    "pqrProducts" TEXT,
    "pqrPeriod" TEXT,
    "stabilityRequired" "TriState",
    "stabilityAccelerated" BOOLEAN NOT NULL DEFAULT false,
    "stabilityOngoing" BOOLEAN NOT NULL DEFAULT false,
    "additionalAnalysisRequired" "TriState",
    "additionalAnalysisDetails" TEXT,
    "additionalValidationRequired" "TriState",
    "additionalValidationDetails" TEXT,
    "otherImplicationRequired" BOOLEAN,
    "otherImplicationDetails" TEXT,
    "dictamenResult" "ChangeDictamenResult" NOT NULL DEFAULT 'PENDING',
    "dictamenDate" DATE,
    "followupResponsible" TEXT,
    "dictamenObservations" TEXT,
    "approvalNames" TEXT,
    "executionStatus" "ChangeExecutionStatus" NOT NULL DEFAULT 'NOT_EXECUTED',
    "executionDate" DATE,
    "operationalClosedAt" DATE,
    "effectivenessStatus" "ChangeEffectivenessStatus" NOT NULL DEFAULT 'PENDING',
    "effectiveClosedAt" DATE,
    "finalStatus" "ChangeFinalStatus" NOT NULL DEFAULT 'OPEN',
    "closureConclusion" TEXT,
    "internalObservations" TEXT,
    "signedDocumentAvailable" BOOLEAN,
    "dataQualityStatus" "DataQualityStatus" NOT NULL DEFAULT 'REVIEW_REQUIRED',
    "includeInKpi" BOOLEAN NOT NULL DEFAULT true,
    "kpiExclusionReason" TEXT,
    "formVersionId" TEXT,
    "annexIIITemplateVersionId" TEXT,
    "annexIVTemplateVersionId" TEXT,
    "annexVTemplateVersionId" TEXT,
    "extraData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeControlTask" (
    "id" TEXT NOT NULL,
    "changeControlId" TEXT NOT NULL,
    "departmentId" TEXT,
    "departmentCodeSnapshot" TEXT,
    "departmentNameSnapshot" TEXT,
    "description" TEXT NOT NULL,
    "responsible" TEXT,
    "plannedDate" DATE,
    "origin" "ChangeTaskOrigin" NOT NULL,
    "introducedInFollowup" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeControlTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeControlFollowup" (
    "id" TEXT NOT NULL,
    "changeControlId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "followupDate" DATE NOT NULL,
    "responsible" TEXT NOT NULL,
    "observations" TEXT,
    "executionStatus" "ChangeExecutionStatus" NOT NULL,
    "executionDate" DATE,
    "effectivenessStatus" "ChangeEffectivenessStatus" NOT NULL,
    "effectivenessObservations" TEXT,
    "closeChange" BOOLEAN NOT NULL DEFAULT false,
    "nextFollowupDate" DATE,
    "remainOpenReason" TEXT,
    "conclusion" TEXT,
    "approvalByText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeControlFollowup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeControlTaskState" (
    "id" TEXT NOT NULL,
    "followupId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "status" "ChangeTaskStatus" NOT NULL,
    "actualDate" DATE,
    "evidenceComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeControlTaskState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "qmsRecordId" TEXT NOT NULL,
    "departmentId" TEXT,
    "departmentCodeSnapshot" TEXT,
    "departmentNameSnapshot" TEXT,
    "openedAt" DATE,
    "detectionDate" DATE,
    "detectedBy" TEXT,
    "createdByText" TEXT,
    "complaintType" "ComplaintType" NOT NULL,
    "receptionDate" DATE,
    "sourceTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceOther" TEXT,
    "scopeTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scopeOther" TEXT,
    "affectedObjectTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "affectedObjectOther" TEXT,
    "categoryTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categoryOther" TEXT,
    "partyName" TEXT,
    "contact" TEXT,
    "affectedScope" TEXT,
    "reference" TEXT,
    "lotReference" TEXT,
    "quantity" TEXT,
    "expiryReanalysis" TEXT,
    "purchaseDeliveryReference" TEXT,
    "description" TEXT,
    "recurrent" BOOLEAN,
    "recurrenceReference" TEXT,
    "attachedDocumentation" TEXT,
    "emittedBy" TEXT,
    "qaValidatedBy" TEXT,
    "investigation" TEXT,
    "impactAssessment" TEXT,
    "impactQualityGmp" "TriState",
    "impactSafetyEfficacy" "TriState",
    "impactRegulatory" "TriState",
    "impactEnvironment" "TriState",
    "impactOtherSimilar" "TriState",
    "containmentActions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "containmentOther" TEXT,
    "riskJustification" TEXT,
    "investigationResult" "ComplaintInvestigationResult",
    "rootCause" TEXT,
    "classification" "ComplaintClassification",
    "potentialRecall" "TriState",
    "recallProcedureRequired" "TriState",
    "authorityNotificationRequired" "TriState",
    "responsiblePartyCommunicationRequired" "TriState",
    "regulatoryJustification" TEXT,
    "resolutionLines" TEXT,
    "resolutionActions" "ComplaintResolutionAction"[] DEFAULT ARRAY[]::"ComplaintResolutionAction"[],
    "immediateActionDetails" TEXT,
    "recallActionDetails" TEXT,
    "creditActionDetails" TEXT,
    "replacementActionDetails" TEXT,
    "otherResolutionDetails" TEXT,
    "externalCommunication" TEXT,
    "communicationDate" DATE,
    "communicationMedium" TEXT,
    "communicationParties" TEXT,
    "communicationSummary" TEXT,
    "partIIRequired" BOOLEAN,
    "hasDerivedActions" BOOLEAN,
    "nextFollowupDate" DATE,
    "conclusion" TEXT,
    "effectivenessRequired" BOOLEAN,
    "initialEvaluationDate" DATE,
    "initialConclusionDate" DATE,
    "responseDate" DATE,
    "responseMedium" TEXT,
    "responseSummary" TEXT,
    "responseSufficient" BOOLEAN,
    "effectivenessStatus" "ComplaintEffectivenessStatus" NOT NULL DEFAULT 'PENDING',
    "effectivenessAssessment" TEXT,
    "closeConclusion" TEXT,
    "closeActionStatus" TEXT,
    "closeActionReferences" TEXT,
    "approvalNames" TEXT,
    "closeApprovalNames" TEXT,
    "closedAt" DATE,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "internalObservations" TEXT,
    "signedDocumentAvailable" BOOLEAN,
    "dataQualityStatus" "DataQualityStatus" NOT NULL DEFAULT 'REVIEW_REQUIRED',
    "includeInKpi" BOOLEAN NOT NULL DEFAULT true,
    "kpiExclusionReason" TEXT,
    "formVersionId" TEXT,
    "annexIIITemplateVersionId" TEXT,
    "annexIVTemplateVersionId" TEXT,
    "annexVTemplateVersionId" TEXT,
    "extraData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintCapaPlan" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "actionType" "CapaActionType" NOT NULL,
    "description" TEXT NOT NULL,
    "plannedExecutionDate" DATE,
    "responsible" TEXT,
    "businessCapaCode" TEXT,
    "linkedCapaRecordId" TEXT,
    "proposalStatus" "CapaProposalStatus" NOT NULL DEFAULT 'PROPOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplaintCapaPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintDerivedAction" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "businessCode" TEXT,
    "description" TEXT,
    "responsible" TEXT,
    "plannedExecutionDate" DATE,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplaintDerivedAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintFollowup" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "followupDate" DATE NOT NULL,
    "completedByText" TEXT NOT NULL,
    "followupType" TEXT,
    "comment" TEXT NOT NULL,
    "nextFollowupDate" DATE,
    "evidenceReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintFollowup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnRecord" (
    "id" TEXT NOT NULL,
    "qmsRecordId" TEXT NOT NULL,
    "departmentId" TEXT,
    "departmentCodeSnapshot" TEXT,
    "departmentNameSnapshot" TEXT,
    "communicationDate" DATE,
    "receivedAt" DATE,
    "createdByText" TEXT,
    "returnType" "ReturnType" NOT NULL,
    "otherReturnType" TEXT,
    "customerEntity" TEXT,
    "country" TEXT,
    "address" TEXT,
    "relatedDocument" TEXT,
    "conservationConditions" TEXT,
    "deliveryNote" TEXT,
    "reasonObservations" TEXT,
    "attachedDocumentation" TEXT,
    "withinAcceptedReturnPeriod" "TriState",
    "roomTemperatureWithinTenDays" "TriState",
    "coldChainWithinFortyEightHours" "TriState",
    "uniqueIdentifierActive" "TriState",
    "tamperEvidenceIntact" "TriState",
    "packagingIntegrityOk" "TriState",
    "customerDeclarationAvailable" "TriState",
    "customerDeclarationSignatoryName" TEXT,
    "customerDeclarationSignatoryRole" TEXT,
    "customerDeclarationSignedAt" DATE,
    "customerDeclarationObservations" TEXT,
    "storageTransportConditionsOk" "TriState",
    "noUseDamageContamination" "TriState",
    "noRecallAlertBlock" "TriState",
    "expiryAcceptable" "TriState",
    "qcAssessmentCompleted" "TriState",
    "storageTemperatureRecord" "TriState",
    "returnTransportTempEvidence" "TriState",
    "transportPackagingSuitable" "TriState",
    "receiptTemperatureAcceptable" "TriState",
    "temperatureExcursionEvaluated" "TriState",
    "coldChainReturnSystemValidated" "TriState",
    "decision" "ReturnDecision" NOT NULL DEFAULT 'PENDING',
    "finalDestination" TEXT,
    "decisionObservations" TEXT,
    "qaApprovalName" TEXT,
    "technicalApprovalName" TEXT,
    "decisionDate" DATE,
    "destructionManagedBy" TEXT,
    "destructionCertificate" TEXT,
    "traceabilityUpdated" "TriState",
    "closedAt" DATE,
    "status" "ReturnStatus" NOT NULL DEFAULT 'OPEN',
    "internalObservations" TEXT,
    "signedDocumentAvailable" BOOLEAN,
    "dataQualityStatus" "DataQualityStatus" NOT NULL DEFAULT 'REVIEW_REQUIRED',
    "includeInKpi" BOOLEAN NOT NULL DEFAULT true,
    "kpiExclusionReason" TEXT,
    "formVersionId" TEXT,
    "annexIIITemplateVersionId" TEXT,
    "annexIVTemplateVersionId" TEXT,
    "annexVTemplateVersionId" TEXT,
    "annexVITemplateVersionId" TEXT,
    "extraData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnProduct" (
    "id" TEXT NOT NULL,
    "returnRecordId" TEXT NOT NULL,
    "departmentId" TEXT,
    "productType" "ReturnProductType" NOT NULL,
    "otherProductType" TEXT,
    "productNameCode" TEXT NOT NULL,
    "format" TEXT,
    "lot" TEXT,
    "expiryReanalysis" TEXT,
    "quantity" TEXT,
    "unit" TEXT,
    "netWeight" TEXT,
    "grossWeight" TEXT,
    "receptionObservations" TEXT,
    "receivedBy" TEXT,
    "receivedByDate" DATE,
    "verifiedBy" TEXT,
    "verifiedByDate" DATE,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnFollowup" (
    "id" TEXT NOT NULL,
    "returnRecordId" TEXT NOT NULL,
    "followupDate" DATE NOT NULL,
    "completedByText" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "nextFollowupDate" DATE,
    "evidenceReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnFollowup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeHistory" (
    "id" TEXT NOT NULL,
    "qmsRecordId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedByText" TEXT,
    "fieldPath" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "source" "HistorySource" NOT NULL DEFAULT 'UI',

    CONSTRAINT "ChangeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QmsRecordVersion" (
    "id" TEXT NOT NULL,
    "qmsRecordId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "kind" "RecordVersionKind" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT,
    "sourceEntityId" TEXT,
    "createdByText" TEXT,
    "source" "HistorySource" NOT NULL DEFAULT 'UI',
    "frozenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QmsRecordVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewThread" (
    "id" TEXT NOT NULL,
    "qmsRecordId" TEXT NOT NULL,
    "recordVersionId" TEXT,
    "targetKind" "ReviewTargetKind" NOT NULL,
    "tabKey" TEXT,
    "sectionKey" TEXT,
    "fieldPath" TEXT,
    "targetEntityType" TEXT,
    "targetEntityId" TEXT,
    "fieldLabelSnapshot" TEXT,
    "valueSnapshot" JSONB,
    "status" "ReviewThreadStatus" NOT NULL DEFAULT 'PENDING',
    "createdByText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedByText" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "resolvedByText" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewMessage" (
    "id" TEXT NOT NULL,
    "reviewThreadId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdByText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordVersionDocument" (
    "id" TEXT NOT NULL,
    "recordVersionId" TEXT NOT NULL,
    "kind" "RecordVersionDocumentKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "fileData" BYTEA NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "uploadedByText" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordVersionDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedDocument" (
    "id" TEXT NOT NULL,
    "qmsRecordId" TEXT NOT NULL,
    "recordVersionId" TEXT,
    "documentType" "DocumentType" NOT NULL,
    "templateVersionId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedByText" TEXT,
    "checksum" TEXT,
    "metadata" JSONB,

    CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LookupCatalog" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "module" "QmsRecordType",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LookupCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LookupCatalogItem" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" DATE,
    "validTo" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LookupCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppParameter" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'GLOBAL',
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "valueType" "ParameterValueType" NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "module" "QmsRecordType" NOT NULL,
    "kind" "AlertRuleKind" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "leadDays" INTEGER NOT NULL DEFAULT 7,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigurationChange" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "changedByText" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigurationChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricalImportBatch" (
    "id" TEXT NOT NULL,
    "recordType" "QmsRecordType" NOT NULL DEFAULT 'DEVIATION',
    "sourceFileName" TEXT NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "years" INTEGER[],
    "importedByText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "rejectedRows" INTEGER NOT NULL DEFAULT 0,
    "reviewRows" INTEGER NOT NULL DEFAULT 0,
    "report" JSONB,

    CONSTRAINT "HistoricalImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricalImportRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "qmsRecordId" TEXT,
    "sourceSheet" TEXT NOT NULL,
    "sourceRow" INTEGER NOT NULL,
    "businessCode" TEXT,
    "result" "HistoricalImportRowResult" NOT NULL,
    "issues" JSONB,
    "sourceSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricalImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderLog" (
    "id" TEXT NOT NULL,
    "qmsRecordId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "status" "ReminderStatus" NOT NULL DEFAULT 'PREPARED',
    "recipients" TEXT[],
    "ccRecipients" TEXT[],
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdByText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QmsRecord_recordType_year_idx" ON "QmsRecord"("recordType", "year");

-- CreateIndex
CREATE INDEX "QmsRecord_recordType_isActive_idx" ON "QmsRecord"("recordType", "isActive");

-- CreateIndex
CREATE INDEX "QmsRecord_businessCode_idx" ON "QmsRecord"("businessCode");

-- CreateIndex
CREATE INDEX "QmsRecord_annulledBusinessCode_idx" ON "QmsRecord"("annulledBusinessCode");

-- CreateIndex
CREATE UNIQUE INDEX "QmsRecord_recordType_businessCode_key" ON "QmsRecord"("recordType", "businessCode");

-- CreateIndex
CREATE INDEX "QmsRelation_sourceRecordId_isActive_idx" ON "QmsRelation"("sourceRecordId", "isActive");

-- CreateIndex
CREATE INDEX "QmsRelation_targetRecordId_isActive_idx" ON "QmsRelation"("targetRecordId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "QmsRelation_sourceRecordId_targetRecordId_relationType_key" ON "QmsRelation"("sourceRecordId", "targetRecordId", "relationType");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE INDEX "FormVersion_module_isActive_effectiveFrom_idx" ON "FormVersion"("module", "isActive", "effectiveFrom");

-- CreateIndex
CREATE INDEX "FormVersion_module_status_idx" ON "FormVersion"("module", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FormVersion_module_versionCode_key" ON "FormVersion"("module", "versionCode");

-- CreateIndex
CREATE INDEX "FormFieldConfig_formVersionId_sectionKey_sortOrder_idx" ON "FormFieldConfig"("formVersionId", "sectionKey", "sortOrder");

-- CreateIndex
CREATE INDEX "FormFieldConfig_formVersionId_listAvailable_listVisibleByDe_idx" ON "FormFieldConfig"("formVersionId", "listAvailable", "listVisibleByDefault");

-- CreateIndex
CREATE UNIQUE INDEX "FormFieldConfig_formVersionId_fieldKey_key" ON "FormFieldConfig"("formVersionId", "fieldKey");

-- CreateIndex
CREATE INDEX "TemplateVersion_module_documentType_isActive_effectiveFrom_idx" ON "TemplateVersion"("module", "documentType", "isActive", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateVersion_module_documentType_versionCode_key" ON "TemplateVersion"("module", "documentType", "versionCode");

-- CreateIndex
CREATE UNIQUE INDEX "Deviation_qmsRecordId_key" ON "Deviation"("qmsRecordId");

-- CreateIndex
CREATE INDEX "Deviation_departmentId_idx" ON "Deviation"("departmentId");

-- CreateIndex
CREATE INDEX "Deviation_status_idx" ON "Deviation"("status");

-- CreateIndex
CREATE INDEX "Deviation_classification_idx" ON "Deviation"("classification");

-- CreateIndex
CREATE INDEX "Deviation_provenance_idx" ON "Deviation"("provenance");

-- CreateIndex
CREATE INDEX "Deviation_deadlineStatus_idx" ON "Deviation"("deadlineStatus");

-- CreateIndex
CREATE INDEX "Deviation_includeInKpi_idx" ON "Deviation"("includeInKpi");

-- CreateIndex
CREATE INDEX "Deviation_issueDate_idx" ON "Deviation"("issueDate");

-- CreateIndex
CREATE INDEX "Deviation_closedAt_idx" ON "Deviation"("closedAt");

-- CreateIndex
CREATE INDEX "DeviationImmediateAction_deviationId_sortOrder_idx" ON "DeviationImmediateAction"("deviationId", "sortOrder");

-- CreateIndex
CREATE INDEX "DeviationFollowup_deviationId_followupDate_idx" ON "DeviationFollowup"("deviationId", "followupDate");

-- CreateIndex
CREATE INDEX "DeviationFollowup_nextFollowupDate_idx" ON "DeviationFollowup"("nextFollowupDate");

-- CreateIndex
CREATE INDEX "DeviationCapaPlan_deviationId_idx" ON "DeviationCapaPlan"("deviationId");

-- CreateIndex
CREATE INDEX "DeviationCapaPlan_linkedCapaRecordId_idx" ON "DeviationCapaPlan"("linkedCapaRecordId");

-- CreateIndex
CREATE INDEX "DeviationCapaPlan_plannedExecutionDate_idx" ON "DeviationCapaPlan"("plannedExecutionDate");

-- CreateIndex
CREATE UNIQUE INDEX "Capa_qmsRecordId_key" ON "Capa"("qmsRecordId");

-- CreateIndex
CREATE INDEX "Capa_departmentId_idx" ON "Capa"("departmentId");

-- CreateIndex
CREATE INDEX "Capa_actionType_idx" ON "Capa"("actionType");

-- CreateIndex
CREATE INDEX "Capa_status_idx" ON "Capa"("status");

-- CreateIndex
CREATE INDEX "Capa_effectivenessStatus_idx" ON "Capa"("effectivenessStatus");

-- CreateIndex
CREATE INDEX "Capa_openedAt_idx" ON "Capa"("openedAt");

-- CreateIndex
CREATE INDEX "Capa_nextFollowupDate_idx" ON "Capa"("nextFollowupDate");

-- CreateIndex
CREATE INDEX "Capa_operationalClosedAt_idx" ON "Capa"("operationalClosedAt");

-- CreateIndex
CREATE INDEX "Capa_effectiveClosedAt_idx" ON "Capa"("effectiveClosedAt");

-- CreateIndex
CREATE INDEX "Capa_includeInKpi_idx" ON "Capa"("includeInKpi");

-- CreateIndex
CREATE INDEX "CapaPlannedAction_capaId_sortOrder_idx" ON "CapaPlannedAction"("capaId", "sortOrder");

-- CreateIndex
CREATE INDEX "CapaPlannedAction_plannedExecutionDate_idx" ON "CapaPlannedAction"("plannedExecutionDate");

-- CreateIndex
CREATE INDEX "CapaActionFollowup_capaId_sortOrder_idx" ON "CapaActionFollowup"("capaId", "sortOrder");

-- CreateIndex
CREATE INDEX "CapaActionFollowup_followupDate_idx" ON "CapaActionFollowup"("followupDate");

-- CreateIndex
CREATE INDEX "CapaFollowup_capaId_followupDate_idx" ON "CapaFollowup"("capaId", "followupDate");

-- CreateIndex
CREATE INDEX "CapaFollowup_nextFollowupDate_idx" ON "CapaFollowup"("nextFollowupDate");

-- CreateIndex
CREATE UNIQUE INDEX "CapaFollowup_capaId_sequenceNumber_key" ON "CapaFollowup"("capaId", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeControl_qmsRecordId_key" ON "ChangeControl"("qmsRecordId");

-- CreateIndex
CREATE INDEX "ChangeControl_departmentId_idx" ON "ChangeControl"("departmentId");

-- CreateIndex
CREATE INDEX "ChangeControl_requestDate_idx" ON "ChangeControl"("requestDate");

-- CreateIndex
CREATE INDEX "ChangeControl_classification_idx" ON "ChangeControl"("classification");

-- CreateIndex
CREATE INDEX "ChangeControl_dictamenResult_idx" ON "ChangeControl"("dictamenResult");

-- CreateIndex
CREATE INDEX "ChangeControl_executionStatus_idx" ON "ChangeControl"("executionStatus");

-- CreateIndex
CREATE INDEX "ChangeControl_effectivenessStatus_idx" ON "ChangeControl"("effectivenessStatus");

-- CreateIndex
CREATE INDEX "ChangeControl_finalStatus_idx" ON "ChangeControl"("finalStatus");

-- CreateIndex
CREATE INDEX "ChangeControl_plannedImplementationDate_idx" ON "ChangeControl"("plannedImplementationDate");

-- CreateIndex
CREATE INDEX "ChangeControl_includeInKpi_idx" ON "ChangeControl"("includeInKpi");

-- CreateIndex
CREATE INDEX "ChangeControlTask_changeControlId_origin_sortOrder_idx" ON "ChangeControlTask"("changeControlId", "origin", "sortOrder");

-- CreateIndex
CREATE INDEX "ChangeControlTask_departmentId_idx" ON "ChangeControlTask"("departmentId");

-- CreateIndex
CREATE INDEX "ChangeControlTask_plannedDate_idx" ON "ChangeControlTask"("plannedDate");

-- CreateIndex
CREATE INDEX "ChangeControlFollowup_changeControlId_followupDate_idx" ON "ChangeControlFollowup"("changeControlId", "followupDate");

-- CreateIndex
CREATE INDEX "ChangeControlFollowup_nextFollowupDate_idx" ON "ChangeControlFollowup"("nextFollowupDate");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeControlFollowup_changeControlId_sequenceNumber_key" ON "ChangeControlFollowup"("changeControlId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "ChangeControlTaskState_taskId_idx" ON "ChangeControlTaskState"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeControlTaskState_followupId_taskId_key" ON "ChangeControlTaskState"("followupId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "Complaint_qmsRecordId_key" ON "Complaint"("qmsRecordId");

-- CreateIndex
CREATE INDEX "Complaint_departmentId_idx" ON "Complaint"("departmentId");

-- CreateIndex
CREATE INDEX "Complaint_openedAt_idx" ON "Complaint"("openedAt");

-- CreateIndex
CREATE INDEX "Complaint_complaintType_idx" ON "Complaint"("complaintType");

-- CreateIndex
CREATE INDEX "Complaint_classification_idx" ON "Complaint"("classification");

-- CreateIndex
CREATE INDEX "Complaint_status_idx" ON "Complaint"("status");

-- CreateIndex
CREATE INDEX "Complaint_effectivenessStatus_idx" ON "Complaint"("effectivenessStatus");

-- CreateIndex
CREATE INDEX "Complaint_nextFollowupDate_idx" ON "Complaint"("nextFollowupDate");

-- CreateIndex
CREATE INDEX "Complaint_partyName_idx" ON "Complaint"("partyName");

-- CreateIndex
CREATE INDEX "Complaint_includeInKpi_idx" ON "Complaint"("includeInKpi");

-- CreateIndex
CREATE INDEX "Complaint_closedAt_idx" ON "Complaint"("closedAt");

-- CreateIndex
CREATE INDEX "ComplaintCapaPlan_complaintId_idx" ON "ComplaintCapaPlan"("complaintId");

-- CreateIndex
CREATE INDEX "ComplaintCapaPlan_linkedCapaRecordId_idx" ON "ComplaintCapaPlan"("linkedCapaRecordId");

-- CreateIndex
CREATE INDEX "ComplaintCapaPlan_plannedExecutionDate_idx" ON "ComplaintCapaPlan"("plannedExecutionDate");

-- CreateIndex
CREATE INDEX "ComplaintDerivedAction_complaintId_sortOrder_idx" ON "ComplaintDerivedAction"("complaintId", "sortOrder");

-- CreateIndex
CREATE INDEX "ComplaintDerivedAction_businessCode_idx" ON "ComplaintDerivedAction"("businessCode");

-- CreateIndex
CREATE INDEX "ComplaintFollowup_complaintId_followupDate_idx" ON "ComplaintFollowup"("complaintId", "followupDate");

-- CreateIndex
CREATE INDEX "ComplaintFollowup_nextFollowupDate_idx" ON "ComplaintFollowup"("nextFollowupDate");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRecord_qmsRecordId_key" ON "ReturnRecord"("qmsRecordId");

-- CreateIndex
CREATE INDEX "ReturnRecord_departmentId_idx" ON "ReturnRecord"("departmentId");

-- CreateIndex
CREATE INDEX "ReturnRecord_communicationDate_idx" ON "ReturnRecord"("communicationDate");

-- CreateIndex
CREATE INDEX "ReturnRecord_receivedAt_idx" ON "ReturnRecord"("receivedAt");

-- CreateIndex
CREATE INDEX "ReturnRecord_returnType_idx" ON "ReturnRecord"("returnType");

-- CreateIndex
CREATE INDEX "ReturnRecord_decision_idx" ON "ReturnRecord"("decision");

-- CreateIndex
CREATE INDEX "ReturnRecord_status_idx" ON "ReturnRecord"("status");

-- CreateIndex
CREATE INDEX "ReturnRecord_customerEntity_idx" ON "ReturnRecord"("customerEntity");

-- CreateIndex
CREATE INDEX "ReturnRecord_includeInKpi_idx" ON "ReturnRecord"("includeInKpi");

-- CreateIndex
CREATE INDEX "ReturnRecord_closedAt_idx" ON "ReturnRecord"("closedAt");

-- CreateIndex
CREATE INDEX "ReturnProduct_returnRecordId_sortOrder_idx" ON "ReturnProduct"("returnRecordId", "sortOrder");

-- CreateIndex
CREATE INDEX "ReturnProduct_departmentId_idx" ON "ReturnProduct"("departmentId");

-- CreateIndex
CREATE INDEX "ReturnProduct_lot_idx" ON "ReturnProduct"("lot");

-- CreateIndex
CREATE INDEX "ReturnFollowup_returnRecordId_followupDate_idx" ON "ReturnFollowup"("returnRecordId", "followupDate");

-- CreateIndex
CREATE INDEX "ReturnFollowup_nextFollowupDate_idx" ON "ReturnFollowup"("nextFollowupDate");

-- CreateIndex
CREATE INDEX "ChangeHistory_qmsRecordId_changedAt_idx" ON "ChangeHistory"("qmsRecordId", "changedAt");

-- CreateIndex
CREATE INDEX "ChangeHistory_source_idx" ON "ChangeHistory"("source");

-- CreateIndex
CREATE INDEX "QmsRecordVersion_qmsRecordId_frozenAt_idx" ON "QmsRecordVersion"("qmsRecordId", "frozenAt");

-- CreateIndex
CREATE INDEX "QmsRecordVersion_kind_idx" ON "QmsRecordVersion"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "QmsRecordVersion_qmsRecordId_sequenceNumber_key" ON "QmsRecordVersion"("qmsRecordId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "ReviewThread_qmsRecordId_status_idx" ON "ReviewThread"("qmsRecordId", "status");

-- CreateIndex
CREATE INDEX "ReviewThread_recordVersionId_idx" ON "ReviewThread"("recordVersionId");

-- CreateIndex
CREATE INDEX "ReviewThread_qmsRecordId_targetKind_tabKey_sectionKey_field_idx" ON "ReviewThread"("qmsRecordId", "targetKind", "tabKey", "sectionKey", "fieldPath");

-- CreateIndex
CREATE INDEX "ReviewThread_targetEntityType_targetEntityId_idx" ON "ReviewThread"("targetEntityType", "targetEntityId");

-- CreateIndex
CREATE INDEX "ReviewThread_createdAt_idx" ON "ReviewThread"("createdAt");

-- CreateIndex
CREATE INDEX "ReviewMessage_reviewThreadId_createdAt_idx" ON "ReviewMessage"("reviewThreadId", "createdAt");

-- CreateIndex
CREATE INDEX "RecordVersionDocument_recordVersionId_uploadedAt_idx" ON "RecordVersionDocument"("recordVersionId", "uploadedAt");

-- CreateIndex
CREATE INDEX "RecordVersionDocument_kind_uploadedAt_idx" ON "RecordVersionDocument"("kind", "uploadedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecordVersionDocument_recordVersionId_kind_key" ON "RecordVersionDocument"("recordVersionId", "kind");

-- CreateIndex
CREATE INDEX "GeneratedDocument_qmsRecordId_generatedAt_idx" ON "GeneratedDocument"("qmsRecordId", "generatedAt");

-- CreateIndex
CREATE INDEX "GeneratedDocument_recordVersionId_idx" ON "GeneratedDocument"("recordVersionId");

-- CreateIndex
CREATE INDEX "GeneratedDocument_templateVersionId_idx" ON "GeneratedDocument"("templateVersionId");

-- CreateIndex
CREATE INDEX "GeneratedDocument_documentType_generatedAt_idx" ON "GeneratedDocument"("documentType", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LookupCatalog_key_key" ON "LookupCatalog"("key");

-- CreateIndex
CREATE INDEX "LookupCatalog_module_isActive_idx" ON "LookupCatalog"("module", "isActive");

-- CreateIndex
CREATE INDEX "LookupCatalogItem_catalogId_isActive_sortOrder_idx" ON "LookupCatalogItem"("catalogId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LookupCatalogItem_catalogId_key_key" ON "LookupCatalogItem"("catalogId", "key");

-- CreateIndex
CREATE INDEX "AppParameter_scope_isActive_idx" ON "AppParameter"("scope", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AppParameter_scope_key_key" ON "AppParameter"("scope", "key");

-- CreateIndex
CREATE UNIQUE INDEX "AlertRule_key_key" ON "AlertRule"("key");

-- CreateIndex
CREATE INDEX "AlertRule_module_kind_isActive_idx" ON "AlertRule"("module", "kind", "isActive");

-- CreateIndex
CREATE INDEX "ConfigurationChange_entityType_entityKey_createdAt_idx" ON "ConfigurationChange"("entityType", "entityKey", "createdAt");

-- CreateIndex
CREATE INDEX "ConfigurationChange_createdAt_idx" ON "ConfigurationChange"("createdAt");

-- CreateIndex
CREATE INDEX "HistoricalImportBatch_recordType_idx" ON "HistoricalImportBatch"("recordType");

-- CreateIndex
CREATE INDEX "HistoricalImportBatch_sourceSha256_idx" ON "HistoricalImportBatch"("sourceSha256");

-- CreateIndex
CREATE INDEX "HistoricalImportBatch_createdAt_idx" ON "HistoricalImportBatch"("createdAt");

-- CreateIndex
CREATE INDEX "HistoricalImportRow_businessCode_idx" ON "HistoricalImportRow"("businessCode");

-- CreateIndex
CREATE INDEX "HistoricalImportRow_qmsRecordId_idx" ON "HistoricalImportRow"("qmsRecordId");

-- CreateIndex
CREATE INDEX "HistoricalImportRow_result_idx" ON "HistoricalImportRow"("result");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalImportRow_batchId_sourceSheet_sourceRow_key" ON "HistoricalImportRow"("batchId", "sourceSheet", "sourceRow");

-- CreateIndex
CREATE INDEX "ReminderLog_qmsRecordId_createdAt_idx" ON "ReminderLog"("qmsRecordId", "createdAt");

-- CreateIndex
CREATE INDEX "ReminderLog_batchId_idx" ON "ReminderLog"("batchId");

-- CreateIndex
CREATE INDEX "ReminderLog_createdAt_idx" ON "ReminderLog"("createdAt");

-- AddForeignKey
ALTER TABLE "QmsRelation" ADD CONSTRAINT "QmsRelation_sourceRecordId_fkey" FOREIGN KEY ("sourceRecordId") REFERENCES "QmsRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QmsRelation" ADD CONSTRAINT "QmsRelation_targetRecordId_fkey" FOREIGN KEY ("targetRecordId") REFERENCES "QmsRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormFieldConfig" ADD CONSTRAINT "FormFieldConfig_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "FormVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deviation" ADD CONSTRAINT "Deviation_qmsRecordId_fkey" FOREIGN KEY ("qmsRecordId") REFERENCES "QmsRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deviation" ADD CONSTRAINT "Deviation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deviation" ADD CONSTRAINT "Deviation_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "FormVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deviation" ADD CONSTRAINT "Deviation_anexoIIITemplateVersionId_fkey" FOREIGN KEY ("anexoIIITemplateVersionId") REFERENCES "TemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviationImmediateAction" ADD CONSTRAINT "DeviationImmediateAction_deviationId_fkey" FOREIGN KEY ("deviationId") REFERENCES "Deviation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviationFollowup" ADD CONSTRAINT "DeviationFollowup_deviationId_fkey" FOREIGN KEY ("deviationId") REFERENCES "Deviation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviationCapaPlan" ADD CONSTRAINT "DeviationCapaPlan_deviationId_fkey" FOREIGN KEY ("deviationId") REFERENCES "Deviation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviationCapaPlan" ADD CONSTRAINT "DeviationCapaPlan_linkedCapaRecordId_fkey" FOREIGN KEY ("linkedCapaRecordId") REFERENCES "QmsRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_qmsRecordId_fkey" FOREIGN KEY ("qmsRecordId") REFERENCES "QmsRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "FormVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_annexIIITemplateVersionId_fkey" FOREIGN KEY ("annexIIITemplateVersionId") REFERENCES "TemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaPlannedAction" ADD CONSTRAINT "CapaPlannedAction_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "Capa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaActionFollowup" ADD CONSTRAINT "CapaActionFollowup_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "Capa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaFollowup" ADD CONSTRAINT "CapaFollowup_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "Capa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeControl" ADD CONSTRAINT "ChangeControl_qmsRecordId_fkey" FOREIGN KEY ("qmsRecordId") REFERENCES "QmsRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeControl" ADD CONSTRAINT "ChangeControl_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeControl" ADD CONSTRAINT "ChangeControl_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "FormVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeControl" ADD CONSTRAINT "ChangeControl_annexIIITemplateVersionId_fkey" FOREIGN KEY ("annexIIITemplateVersionId") REFERENCES "TemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeControl" ADD CONSTRAINT "ChangeControl_annexIVTemplateVersionId_fkey" FOREIGN KEY ("annexIVTemplateVersionId") REFERENCES "TemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeControl" ADD CONSTRAINT "ChangeControl_annexVTemplateVersionId_fkey" FOREIGN KEY ("annexVTemplateVersionId") REFERENCES "TemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeControlTask" ADD CONSTRAINT "ChangeControlTask_changeControlId_fkey" FOREIGN KEY ("changeControlId") REFERENCES "ChangeControl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeControlTask" ADD CONSTRAINT "ChangeControlTask_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeControlFollowup" ADD CONSTRAINT "ChangeControlFollowup_changeControlId_fkey" FOREIGN KEY ("changeControlId") REFERENCES "ChangeControl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeControlTaskState" ADD CONSTRAINT "ChangeControlTaskState_followupId_fkey" FOREIGN KEY ("followupId") REFERENCES "ChangeControlFollowup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeControlTaskState" ADD CONSTRAINT "ChangeControlTaskState_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ChangeControlTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_qmsRecordId_fkey" FOREIGN KEY ("qmsRecordId") REFERENCES "QmsRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "FormVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_annexIIITemplateVersionId_fkey" FOREIGN KEY ("annexIIITemplateVersionId") REFERENCES "TemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_annexIVTemplateVersionId_fkey" FOREIGN KEY ("annexIVTemplateVersionId") REFERENCES "TemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_annexVTemplateVersionId_fkey" FOREIGN KEY ("annexVTemplateVersionId") REFERENCES "TemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintCapaPlan" ADD CONSTRAINT "ComplaintCapaPlan_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintCapaPlan" ADD CONSTRAINT "ComplaintCapaPlan_linkedCapaRecordId_fkey" FOREIGN KEY ("linkedCapaRecordId") REFERENCES "QmsRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintDerivedAction" ADD CONSTRAINT "ComplaintDerivedAction_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintFollowup" ADD CONSTRAINT "ComplaintFollowup_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRecord" ADD CONSTRAINT "ReturnRecord_qmsRecordId_fkey" FOREIGN KEY ("qmsRecordId") REFERENCES "QmsRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRecord" ADD CONSTRAINT "ReturnRecord_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRecord" ADD CONSTRAINT "ReturnRecord_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "FormVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRecord" ADD CONSTRAINT "ReturnRecord_annexIIITemplateVersionId_fkey" FOREIGN KEY ("annexIIITemplateVersionId") REFERENCES "TemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRecord" ADD CONSTRAINT "ReturnRecord_annexIVTemplateVersionId_fkey" FOREIGN KEY ("annexIVTemplateVersionId") REFERENCES "TemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRecord" ADD CONSTRAINT "ReturnRecord_annexVTemplateVersionId_fkey" FOREIGN KEY ("annexVTemplateVersionId") REFERENCES "TemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRecord" ADD CONSTRAINT "ReturnRecord_annexVITemplateVersionId_fkey" FOREIGN KEY ("annexVITemplateVersionId") REFERENCES "TemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnProduct" ADD CONSTRAINT "ReturnProduct_returnRecordId_fkey" FOREIGN KEY ("returnRecordId") REFERENCES "ReturnRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnProduct" ADD CONSTRAINT "ReturnProduct_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnFollowup" ADD CONSTRAINT "ReturnFollowup_returnRecordId_fkey" FOREIGN KEY ("returnRecordId") REFERENCES "ReturnRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeHistory" ADD CONSTRAINT "ChangeHistory_qmsRecordId_fkey" FOREIGN KEY ("qmsRecordId") REFERENCES "QmsRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QmsRecordVersion" ADD CONSTRAINT "QmsRecordVersion_qmsRecordId_fkey" FOREIGN KEY ("qmsRecordId") REFERENCES "QmsRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewThread" ADD CONSTRAINT "ReviewThread_qmsRecordId_fkey" FOREIGN KEY ("qmsRecordId") REFERENCES "QmsRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewThread" ADD CONSTRAINT "ReviewThread_recordVersionId_fkey" FOREIGN KEY ("recordVersionId") REFERENCES "QmsRecordVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewMessage" ADD CONSTRAINT "ReviewMessage_reviewThreadId_fkey" FOREIGN KEY ("reviewThreadId") REFERENCES "ReviewThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordVersionDocument" ADD CONSTRAINT "RecordVersionDocument_recordVersionId_fkey" FOREIGN KEY ("recordVersionId") REFERENCES "QmsRecordVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_qmsRecordId_fkey" FOREIGN KEY ("qmsRecordId") REFERENCES "QmsRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_recordVersionId_fkey" FOREIGN KEY ("recordVersionId") REFERENCES "QmsRecordVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "TemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LookupCatalogItem" ADD CONSTRAINT "LookupCatalogItem_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "LookupCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalImportRow" ADD CONSTRAINT "HistoricalImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "HistoricalImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalImportRow" ADD CONSTRAINT "HistoricalImportRow_qmsRecordId_fkey" FOREIGN KEY ("qmsRecordId") REFERENCES "QmsRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_qmsRecordId_fkey" FOREIGN KEY ("qmsRecordId") REFERENCES "QmsRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
