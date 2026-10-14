-- B2 real SQL capture foundation. Corporate activation remains unavailable.
-- The new begin RPC is confined to disposable integration databases until the
-- complete writer/evidence/acceptance contract is delivered. No activation row.
BEGIN;
ALTER TABLE "AuditOperation" ALTER COLUMN reason DROP NOT NULL;
ALTER TABLE "AuditOperation" DROP CONSTRAINT "AuditOperation_schemaVersion_check";
ALTER TABLE "AuditOperation" ADD CONSTRAINT "AuditOperation_schemaVersion_check" CHECK ("schemaVersion" IN (1,2));
ALTER TABLE "AuditOperation" ADD COLUMN "accessModule" TEXT, ADD COLUMN "accessPermission" TEXT;
ALTER TABLE "AuditOperation" ADD CONSTRAINT audit_business_permission_identity CHECK ("policyVersion"<>'QMS_B2_ENGINE_V1' OR ("accessModule" IS NOT NULL AND "accessPermission" IS NOT NULL));
ALTER TABLE "AuditEvent" ADD COLUMN "mutationId" UUID;
CREATE TABLE "AuditAdministrationRoot" (
  id TEXT PRIMARY KEY, category TEXT NOT NULL CHECK (category IN ('CONFIGURATION','AUTHORIZATION','HISTORICAL_IMPORT','PNT_IMPORT')),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(), CHECK (id=category)
);
ALTER TABLE "AuditAggregateCursor" ADD COLUMN "administrationRootId" TEXT UNIQUE REFERENCES "AuditAdministrationRoot"(id) ON DELETE RESTRICT;
ALTER TABLE "AuditAggregateCursor" DROP CONSTRAINT audit_root_identity;
ALTER TABLE "AuditAggregateCursor" ADD CONSTRAINT audit_root_identity CHECK (
  ("rootKind"='QMS_RECORD' AND "qmsRecordId" IS NOT NULL AND "controlledDocumentId" IS NULL AND "auditAnnualPlanId" IS NULL AND "administrationRootId" IS NULL AND "rootKey"='QMS_RECORD:'||"qmsRecordId") OR
  ("rootKind"='PNT' AND "controlledDocumentId" IS NOT NULL AND "qmsRecordId" IS NULL AND "auditAnnualPlanId" IS NULL AND "administrationRootId" IS NULL AND "rootKey"='PNT:'||"controlledDocumentId") OR
  ("rootKind"='AUDIT_PLAN' AND "auditAnnualPlanId" IS NOT NULL AND "qmsRecordId" IS NULL AND "controlledDocumentId" IS NULL AND "administrationRootId" IS NULL AND "rootKey"='AUDIT_PLAN:'||"auditAnnualPlanId") OR
  ("rootKind"='ADMINISTRATION' AND "administrationRootId" IS NOT NULL AND "qmsRecordId" IS NULL AND "controlledDocumentId" IS NULL AND "auditAnnualPlanId" IS NULL AND "rootKey"='ADMINISTRATION:'||"administrationRootId")
);
CREATE TABLE "AuditEventAdditionalTarget" (
  "eventId" UUID NOT NULL REFERENCES "AuditEvent"(id) ON DELETE RESTRICT,
  "operationId" UUID NOT NULL, "rootKey" TEXT NOT NULL,
  FOREIGN KEY ("operationId","rootKey") REFERENCES "AuditOperationTarget"("operationId","rootKey") ON DELETE RESTRICT,
  PRIMARY KEY ("eventId","rootKey")
);
CREATE TABLE "AuditBusinessContext" (
  "transactionId" BIGINT PRIMARY KEY, "backendPid" INTEGER NOT NULL, "databasePrincipal" TEXT NOT NULL,
  "actorUserId" UUID NOT NULL, "actorName" TEXT NOT NULL, "requestId" UUID NOT NULL, "requestDigest" TEXT NOT NULL,
  "operationCode" TEXT NOT NULL, "accessModule" TEXT NOT NULL, "accessPermission" TEXT NOT NULL, reason TEXT,
  "operationId" UUID
);
CREATE TABLE "AuditMutationWitness" (
  id UUID PRIMARY KEY, "transactionId" BIGINT NOT NULL REFERENCES "AuditBusinessContext"("transactionId") ON DELETE RESTRICT,
  "entityType" TEXT NOT NULL, "entityKey" TEXT NOT NULL, verb TEXT NOT NULL,
  "beforeRoots" TEXT[] NOT NULL, expected JSONB, completed BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX "AuditMutationWitness_transactionId_entityType_entityKey_idx" ON "AuditMutationWitness"("transactionId","entityType","entityKey");
CREATE TABLE "AuditRootBinding" (
  "transactionId" BIGINT NOT NULL REFERENCES "AuditBusinessContext"("transactionId") ON DELETE RESTRICT,
  "entityType" TEXT NOT NULL, "entityKey" TEXT NOT NULL, roots TEXT[] NOT NULL,
  PRIMARY KEY ("transactionId","entityType","entityKey")
);
CREATE TABLE "AuditCaptureTablePolicy" ("entityType" TEXT PRIMARY KEY, "primaryKey" TEXT[] NOT NULL, "rootPaths" JSONB NOT NULL, "captureMode" TEXT NOT NULL CHECK ("captureMode" IN ('EVENT','EVIDENCE')));
CREATE TABLE "AuditCaptureFieldPolicy" (
  "entityType" TEXT NOT NULL REFERENCES "AuditCaptureTablePolicy"("entityType") ON DELETE RESTRICT,
  "fieldPath" TEXT NOT NULL, "valueType" TEXT NOT NULL, transform TEXT NOT NULL, critical BOOLEAN NOT NULL,
  PRIMARY KEY ("entityType","fieldPath")
);
CREATE TABLE "AuditOperationEvidence" (
  id UUID PRIMARY KEY, "operationId" UUID NOT NULL REFERENCES "AuditOperation"(id) ON DELETE RESTRICT,
  "changeHistoryId" TEXT REFERENCES "ChangeHistory"(id) ON DELETE RESTRICT,
  "configurationChangeId" TEXT REFERENCES "ConfigurationChange"(id) ON DELETE RESTRICT,
  "authorizationChangeId" UUID REFERENCES "AuthAuthorizationChange"(id) ON DELETE RESTRICT,
  "auditPlanChangeId" TEXT REFERENCES "AuditPlanChange"(id) ON DELETE RESTRICT,
  "controlledDocumentChangeId" TEXT REFERENCES "ControlledDocumentChange"(id) ON DELETE RESTRICT,
  CHECK (num_nonnulls("changeHistoryId","configurationChangeId","authorizationChangeId","auditPlanChangeId","controlledDocumentChangeId")=1)
);

-- CAPTURE_POLICY_ROWS: fixed release metadata; never an application input.
INSERT INTO "AuditCaptureTablePolicy" VALUES ('AlertRule',ARRAY['id'],'[{"kind":"ADMINISTRATION","category":"CONFIGURATION"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('AlertRule','description','STRING','VALUE',false),
('AlertRule','id','STRING','VALUE',false),
('AlertRule','isActive','BOOLEAN','VALUE',false),
('AlertRule','key','STRING','VALUE',false),
('AlertRule','kind','STRING','VALUE',false),
('AlertRule','label','STRING','VALUE',false),
('AlertRule','leadDays','INTEGER','VALUE',false),
('AlertRule','module','STRING','VALUE',false),
('AlertRule','severity','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('AppParameter',ARRAY['id'],'[{"kind":"ADMINISTRATION","category":"CONFIGURATION"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('AppParameter','description','STRING','VALUE',false),
('AppParameter','id','STRING','VALUE',false),
('AppParameter','isActive','BOOLEAN','VALUE',false),
('AppParameter','key','STRING','VALUE',false),
('AppParameter','label','STRING','VALUE',false),
('AppParameter','scope','STRING','VALUE',false),
('AppParameter','value','JSON','VALUE',true),
('AppParameter','valueType','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('Audit',ARRAY['id'],'[{"kind":"QMS_RECORD","field":"qmsRecordId"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('Audit','activityDuration','STRING','VALUE',false),
('Audit','auditType','STRING','VALUE',false),
('Audit','auditedContact','STRING','VALUE',false),
('Audit','auditedEntityAddress','STRING','VALUE',false),
('Audit','auditedEntityName','STRING','VALUE',false),
('Audit','auditingEntityName','STRING','VALUE',false),
('Audit','capaPlanDate','DATE','VALUE',false),
('Audit','capaPlanEstablishedAt','DATE','VALUE',false),
('Audit','closedAt','DATE','VALUE',false),
('Audit','closureEvidence','STRING','VALUE',true),
('Audit','codingDepartmentCodeSnapshot','STRING','VALUE',false),
('Audit','codingDepartmentId','STRING','VALUE',false),
('Audit','codingDepartmentNameSnapshot','STRING','VALUE',false),
('Audit','conclusion','STRING','VALUE',true),
('Audit','createdByText','STRING','VALUE',false),
('Audit','dataQualityStatus','STRING','VALUE',false),
('Audit','entityCode','STRING','VALUE',false),
('Audit','externalReference','STRING','VALUE',false),
('Audit','id','STRING','VALUE',false),
('Audit','internalObservations','STRING','VALUE',false),
('Audit','modality','STRING','VALUE',false),
('Audit','openedAt','DATE','VALUE',false),
('Audit','outsidePlanReason','STRING','VALUE',false),
('Audit','performedDate','DATE','VALUE',false),
('Audit','planEntryId','STRING','VALUE',false),
('Audit','planIntroduction','STRING','VALUE',false),
('Audit','plannedDate','DATE','VALUE',false),
('Audit','planningStatus','STRING','VALUE',false),
('Audit','preparedBy','STRING','VALUE',false),
('Audit','preparedPosition','STRING','VALUE',false),
('Audit','previousAuditBackground','STRING','VALUE',false),
('Audit','programme','STRING','VALUE',false),
('Audit','qmsRecordId','STRING','VALUE',false),
('Audit','receivedBy','STRING','VALUE',false),
('Audit','receivedPosition','STRING','VALUE',false),
('Audit','referenceText','STRING','VALUE',false),
('Audit','reportDate','DATE','VALUE',false),
('Audit','reportDistribution','STRING','VALUE',false),
('Audit','reportSentAt','DATE','VALUE',false),
('Audit','responseRequired','BOOLEAN','VALUE',false),
('Audit','responseSentAt','DATE','VALUE',false),
('Audit','reviewedBy','STRING','VALUE',false),
('Audit','reviewedPosition','STRING','VALUE',false),
('Audit','scenario','STRING','VALUE',false),
('Audit','scope','STRING','VALUE',false),
('Audit','status','STRING','VALUE',false),
('Audit','supplierAssessment','STRING','VALUE',true),
('Audit','supplierException','BOOLEAN','VALUE',false),
('Audit','supplierExceptionAt','DATE','VALUE',false),
('Audit','supplierExceptionBy','STRING','VALUE',false),
('Audit','supplierExceptionReason','STRING','VALUE',true),
('Audit','supplierResponseReceivedAt','DATE','VALUE',false),
('Audit','supplierType','STRING','VALUE',false),
('Audit','title','STRING','VALUE',false),
('Audit','updatedByText','STRING','VALUE',false),
('Audit','verifyAtNextAudit','BOOLEAN','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('AuditAnnualPlan',ARRAY['id'],'[{"kind":"AUDIT_PLAN","field":"id"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('AuditAnnualPlan','auditType','STRING','VALUE',false),
('AuditAnnualPlan','createdByText','STRING','VALUE',false),
('AuditAnnualPlan','id','STRING','VALUE',false),
('AuditAnnualPlan','notes','STRING','VALUE',false),
('AuditAnnualPlan','qualityApproverName','STRING','VALUE',false),
('AuditAnnualPlan','technicalApproverName','STRING','VALUE',false),
('AuditAnnualPlan','title','STRING','VALUE',false),
('AuditAnnualPlan','updatedByText','STRING','VALUE',false),
('AuditAnnualPlan','year','INTEGER','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('AuditAnnualProgrammeVersion',ARRAY['id'],'[{"kind":"AUDIT_PLAN","field":"planId"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('AuditAnnualProgrammeVersion','authenticatedUserId','STRING','VALUE',false),
('AuditAnnualProgrammeVersion','checksum','STRING','VALUE',false),
('AuditAnnualProgrammeVersion','contentFingerprint','STRING','VALUE',false),
('AuditAnnualProgrammeVersion','fileName','STRING','VALUE',false),
('AuditAnnualProgrammeVersion','fileSize','INTEGER','VALUE',false),
('AuditAnnualProgrammeVersion','generatedAt','INSTANT','VALUE',false),
('AuditAnnualProgrammeVersion','generatedBy','STRING','VALUE',false),
('AuditAnnualProgrammeVersion','id','STRING','VALUE',false),
('AuditAnnualProgrammeVersion','mimeType','STRING','VALUE',false),
('AuditAnnualProgrammeVersion','planId','STRING','VALUE',false),
('AuditAnnualProgrammeVersion','reason','STRING','VALUE',false),
('AuditAnnualProgrammeVersion','reference','STRING','VALUE',false),
('AuditAnnualProgrammeVersion','requestHash','STRING','VALUE',false),
('AuditAnnualProgrammeVersion','requestId','STRING','VALUE',false),
('AuditAnnualProgrammeVersion','sequenceNumber','INTEGER','VALUE',false),
('AuditAnnualProgrammeVersion','snapshot','STRING','SHA256_JSON',false),
('AuditAnnualProgrammeVersion','templateChecksum','STRING','VALUE',false),
('AuditAnnualProgrammeVersion','templateVersionId','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('AuditDepartment',ARRAY['id'],'[{"via":"auditId","table":"Audit"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('AuditDepartment','auditId','STRING','VALUE',false),
('AuditDepartment','departmentCodeSnapshot','STRING','VALUE',false),
('AuditDepartment','departmentId','STRING','VALUE',false),
('AuditDepartment','departmentNameSnapshot','STRING','VALUE',false),
('AuditDepartment','id','STRING','VALUE',false),
('AuditDepartment','isActive','BOOLEAN','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('AuditFinding',ARRAY['id'],'[{"via":"auditId","table":"Audit"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('AuditFinding','auditId','STRING','VALUE',false),
('AuditFinding','closedAt','DATE','VALUE',false),
('AuditFinding','createdByText','STRING','VALUE',false),
('AuditFinding','criterionReference','STRING','VALUE',false),
('AuditFinding','criticality','STRING','VALUE',true),
('AuditFinding','description','STRING','VALUE',true),
('AuditFinding','evidence','STRING','VALUE',true),
('AuditFinding','evidenceReference','STRING','VALUE',false),
('AuditFinding','findingType','STRING','VALUE',false),
('AuditFinding','id','STRING','VALUE',false),
('AuditFinding','isActive','BOOLEAN','VALUE',false),
('AuditFinding','objectiveEvidence','STRING','VALUE',true),
('AuditFinding','reference','STRING','VALUE',false),
('AuditFinding','retiredAt','INSTANT','VALUE',false),
('AuditFinding','retiredByText','STRING','VALUE',false),
('AuditFinding','retirementReason','STRING','VALUE',false),
('AuditFinding','sortOrder','INTEGER','VALUE',false),
('AuditFinding','treatment','STRING','VALUE',false),
('AuditFinding','treatmentStatus','STRING','VALUE',false),
('AuditFinding','updatedByText','STRING','VALUE',false),
('AuditFinding','verificationComment','STRING','VALUE',true);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('AuditFindingAction',ARRAY['id'],'[{"via":"findingId","table":"AuditFinding"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('AuditFindingAction','closedAt','DATE','VALUE',false),
('AuditFindingAction','createdByText','STRING','VALUE',false),
('AuditFindingAction','description','STRING','VALUE',false),
('AuditFindingAction','evidence','STRING','VALUE',true),
('AuditFindingAction','evidenceReference','STRING','VALUE',false),
('AuditFindingAction','findingId','STRING','VALUE',false),
('AuditFindingAction','id','STRING','VALUE',false),
('AuditFindingAction','isActive','BOOLEAN','VALUE',false),
('AuditFindingAction','responsible','STRING','VALUE',false),
('AuditFindingAction','retiredAt','INSTANT','VALUE',false),
('AuditFindingAction','retiredByText','STRING','VALUE',false),
('AuditFindingAction','retirementReason','STRING','VALUE',false),
('AuditFindingAction','sortOrder','INTEGER','VALUE',false),
('AuditFindingAction','status','STRING','VALUE',false),
('AuditFindingAction','targetDate','DATE','VALUE',false),
('AuditFindingAction','updatedByText','STRING','VALUE',false),
('AuditFindingAction','verificationComment','STRING','VALUE',true),
('AuditFindingAction','verificationResult','STRING','VALUE',true),
('AuditFindingAction','verifiedAt','DATE','VALUE',false),
('AuditFindingAction','verifiedBy','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('AuditFindingRelation',ARRAY['id'],'[{"via":"findingId","table":"AuditFinding"},{"via":"qmsRelationId","table":"QmsRelation"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('AuditFindingRelation','createdByText','STRING','VALUE',false),
('AuditFindingRelation','findingId','STRING','VALUE',false),
('AuditFindingRelation','id','STRING','VALUE',false),
('AuditFindingRelation','isActive','BOOLEAN','VALUE',false),
('AuditFindingRelation','qmsRelationId','STRING','VALUE',false),
('AuditFindingRelation','retiredAt','INSTANT','VALUE',false),
('AuditFindingRelation','retiredByText','STRING','VALUE',false),
('AuditFindingRelation','retirementReason','STRING','VALUE',false),
('AuditFindingRelation','updatedByText','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('AuditFollowup',ARRAY['id'],'[{"via":"auditId","table":"Audit"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('AuditFollowup','auditId','STRING','VALUE',false),
('AuditFollowup','completedByText','STRING','VALUE',false),
('AuditFollowup','createdByText','STRING','VALUE',false),
('AuditFollowup','description','STRING','VALUE',false),
('AuditFollowup','evidenceReference','STRING','VALUE',false),
('AuditFollowup','findingId','STRING','VALUE',false),
('AuditFollowup','followupDate','DATE','VALUE',false),
('AuditFollowup','id','STRING','VALUE',false),
('AuditFollowup','nextReviewDate','DATE','VALUE',false),
('AuditFollowup','updatedByText','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('AuditParticipant',ARRAY['id'],'[{"via":"auditId","table":"Audit"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('AuditParticipant','auditId','STRING','VALUE',false),
('AuditParticipant','displayName','STRING','VALUE',false),
('AuditParticipant','id','STRING','VALUE',false),
('AuditParticipant','isActive','BOOLEAN','VALUE',false),
('AuditParticipant','organization','STRING','VALUE',false),
('AuditParticipant','position','STRING','VALUE',false),
('AuditParticipant','role','STRING','VALUE',false),
('AuditParticipant','sortOrder','INTEGER','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('AuditPlanChange',ARRAY['id'],'[{"kind":"AUDIT_PLAN","field":"planId"}]'::jsonb,'EVIDENCE');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('AuditPlanChange','actor','STRING','VALUE',false),
('AuditPlanChange','authenticatedUserId','STRING','VALUE',false),
('AuditPlanChange','entryId','STRING','VALUE',false),
('AuditPlanChange','event','STRING','VALUE',false),
('AuditPlanChange','id','STRING','VALUE',false),
('AuditPlanChange','planId','STRING','VALUE',false),
('AuditPlanChange','reason','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('AuditPlanEntry',ARRAY['id'],'[{"kind":"AUDIT_PLAN","field":"planId"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('AuditPlanEntry','createdByText','STRING','VALUE',false),
('AuditPlanEntry','departmentId','STRING','VALUE',false),
('AuditPlanEntry','id','STRING','VALUE',false),
('AuditPlanEntry','isActive','BOOLEAN','VALUE',false),
('AuditPlanEntry','notes','STRING','VALUE',false),
('AuditPlanEntry','planId','STRING','VALUE',false),
('AuditPlanEntry','plannedAuditorsText','STRING','VALUE',false),
('AuditPlanEntry','plannedDate','DATE','VALUE',false),
('AuditPlanEntry','plannedModality','STRING','VALUE',false),
('AuditPlanEntry','plannedPeriodText','STRING','VALUE',false),
('AuditPlanEntry','plannedScope','STRING','VALUE',false),
('AuditPlanEntry','productService','STRING','VALUE',false),
('AuditPlanEntry','programmeArea','STRING','VALUE',false),
('AuditPlanEntry','sortOrder','INTEGER','VALUE',false),
('AuditPlanEntry','subject','STRING','VALUE',false),
('AuditPlanEntry','targetName','STRING','VALUE',false),
('AuditPlanEntry','updatedByText','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('AuthAuthorizationChange',ARRAY['id'],'[{"kind":"ADMINISTRATION","category":"AUTHORIZATION"}]'::jsonb,'EVIDENCE');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('AuthAuthorizationChange','action','STRING','VALUE',false),
('AuthAuthorizationChange','actorUserId','STRING','VALUE',false),
('AuthAuthorizationChange','id','STRING','VALUE',false),
('AuthAuthorizationChange','reason','STRING','VALUE',false),
('AuthAuthorizationChange','source','STRING','VALUE',false),
('AuthAuthorizationChange','targetUserId','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('AuthRecordAssignment',ARRAY['id'],'[{"kind":"ADMINISTRATION","category":"AUTHORIZATION"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('AuthRecordAssignment','id','STRING','VALUE',false),
('AuthRecordAssignment','module','STRING','VALUE',false),
('AuthRecordAssignment','recordId','STRING','VALUE',false),
('AuthRecordAssignment','userId','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('AuthRole',ARRAY['id'],'[{"kind":"ADMINISTRATION","category":"AUTHORIZATION"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('AuthRole','id','STRING','VALUE',false),
('AuthRole','key','STRING','VALUE',false),
('AuthRole','name','STRING','VALUE',false),
('AuthRole','qaAcceptedAt','INSTANT','VALUE',false),
('AuthRole','qaAcceptedBy','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('AuthRolePermission',ARRAY['id'],'[{"kind":"ADMINISTRATION","category":"AUTHORIZATION"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('AuthRolePermission','id','STRING','VALUE',false),
('AuthRolePermission','module','STRING','VALUE',false),
('AuthRolePermission','permission','STRING','VALUE',false),
('AuthRolePermission','roleId','STRING','VALUE',false),
('AuthRolePermission','scope','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('AuthUser',ARRAY['id'],'[{"kind":"ADMINISTRATION","category":"AUTHORIZATION"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('AuthUser','active','BOOLEAN','VALUE',false),
('AuthUser','authorizedAt','INSTANT','VALUE',false),
('AuthUser','id','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('AuthUserDepartment',ARRAY['userId','departmentId'],'[{"kind":"ADMINISTRATION","category":"AUTHORIZATION"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('AuthUserDepartment','departmentId','STRING','VALUE',false),
('AuthUserDepartment','userId','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('AuthUserRole',ARRAY['userId','roleId'],'[{"kind":"ADMINISTRATION","category":"AUTHORIZATION"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('AuthUserRole','assignedAt','INSTANT','VALUE',false),
('AuthUserRole','roleId','STRING','VALUE',false),
('AuthUserRole','userId','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('Capa',ARRAY['id'],'[{"kind":"QMS_RECORD","field":"qmsRecordId"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('Capa','actionFollowupObservations','STRING','VALUE',false),
('Capa','actionType','STRING','VALUE',false),
('Capa','annexIIITemplateVersionId','STRING','VALUE',false),
('Capa','applicableTo','STRING','VALUE',false),
('Capa','cancellationReason','STRING','VALUE',false),
('Capa','conclusion','STRING','VALUE',true),
('Capa','createdByText','STRING','VALUE',false),
('Capa','dataQualityStatus','STRING','VALUE',false),
('Capa','defectDescription','STRING','VALUE',false),
('Capa','departmentCodeSnapshot','STRING','VALUE',false),
('Capa','departmentId','STRING','VALUE',false),
('Capa','departmentNameSnapshot','STRING','VALUE',false),
('Capa','effectiveClosedAt','DATE','VALUE',false),
('Capa','effectivenessAssessment','STRING','VALUE',true),
('Capa','effectivenessCriteria','STRING','VALUE',true),
('Capa','effectivenessEvidence','STRING','VALUE',true),
('Capa','effectivenessStatus','STRING','VALUE',true),
('Capa','extraData','JSON','VALUE',false),
('Capa','formVersionId','STRING','VALUE',false),
('Capa','id','STRING','VALUE',false),
('Capa','impactAssessment','STRING','VALUE',true),
('Capa','includeInKpi','BOOLEAN','VALUE',false),
('Capa','internalObservations','STRING','VALUE',false),
('Capa','kpiExclusionReason','STRING','VALUE',false),
('Capa','nextFollowupDate','DATE','VALUE',false),
('Capa','openedAt','DATE','VALUE',false),
('Capa','operationalClosedAt','DATE','VALUE',false),
('Capa','operationalStatusDescription','STRING','VALUE',false),
('Capa','originCode','STRING','VALUE',false),
('Capa','originType','STRING','VALUE',false),
('Capa','qmsRecordId','STRING','VALUE',false),
('Capa','rootCause','STRING','VALUE',true),
('Capa','signedDocumentAvailable','BOOLEAN','VALUE',false),
('Capa','status','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('CapaActionFollowup',ARRAY['id'],'[{"via":"capaId","table":"Capa"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('CapaActionFollowup','capaId','STRING','VALUE',false),
('CapaActionFollowup','description','STRING','VALUE',false),
('CapaActionFollowup','followupDate','DATE','VALUE',false),
('CapaActionFollowup','id','STRING','VALUE',false),
('CapaActionFollowup','sortOrder','INTEGER','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('CapaFollowup',ARRAY['id'],'[{"via":"capaId","table":"Capa"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('CapaFollowup','capaId','STRING','VALUE',false),
('CapaFollowup','completedByText','STRING','VALUE',false),
('CapaFollowup','description','STRING','VALUE',false),
('CapaFollowup','evidenceReference','STRING','VALUE',false),
('CapaFollowup','followupDate','DATE','VALUE',false),
('CapaFollowup','id','STRING','VALUE',false),
('CapaFollowup','nextFollowupDate','DATE','VALUE',false),
('CapaFollowup','observations','STRING','VALUE',false),
('CapaFollowup','reason','STRING','VALUE',false),
('CapaFollowup','sequenceNumber','INTEGER','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('CapaPlannedAction',ARRAY['id'],'[{"via":"capaId","table":"Capa"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('CapaPlannedAction','capaId','STRING','VALUE',false),
('CapaPlannedAction','description','STRING','VALUE',false),
('CapaPlannedAction','id','STRING','VALUE',false),
('CapaPlannedAction','impact','STRING','VALUE',false),
('CapaPlannedAction','plannedExecutionDate','DATE','VALUE',false),
('CapaPlannedAction','responsible','STRING','VALUE',false),
('CapaPlannedAction','sortOrder','INTEGER','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('ChangeControl',ARRAY['id'],'[{"kind":"QMS_RECORD","field":"qmsRecordId"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ChangeControl','additionalAnalysisDetails','STRING','VALUE',false),
('ChangeControl','additionalAnalysisRequired','STRING','VALUE',false),
('ChangeControl','additionalValidationDetails','STRING','VALUE',false),
('ChangeControl','additionalValidationRequired','STRING','VALUE',false),
('ChangeControl','annexIIITemplateVersionId','STRING','VALUE',false),
('ChangeControl','annexIVTemplateVersionId','STRING','VALUE',false),
('ChangeControl','annexVTemplateVersionId','STRING','VALUE',false),
('ChangeControl','approvalNames','STRING','VALUE',false),
('ChangeControl','authorityDetails','STRING','VALUE',false),
('ChangeControl','authorityRequired','BOOLEAN','VALUE',false),
('ChangeControl','classification','STRING','VALUE',true),
('ChangeControl','clientNotificationDetails','STRING','VALUE',false),
('ChangeControl','clientNotificationRequired','BOOLEAN','VALUE',false),
('ChangeControl','closureConclusion','STRING','VALUE',true),
('ChangeControl','committeeDetails','STRING','VALUE',false),
('ChangeControl','committeeRequired','BOOLEAN','VALUE',false),
('ChangeControl','dataQualityStatus','STRING','VALUE',false),
('ChangeControl','departmentCodeSnapshot','STRING','VALUE',false),
('ChangeControl','departmentId','STRING','VALUE',false),
('ChangeControl','departmentNameSnapshot','STRING','VALUE',false),
('ChangeControl','description','STRING','VALUE',false),
('ChangeControl','dictamenDate','DATE','VALUE',false),
('ChangeControl','dictamenObservations','STRING','VALUE',true),
('ChangeControl','dictamenResult','STRING','VALUE',true),
('ChangeControl','effectiveClosedAt','DATE','VALUE',false),
('ChangeControl','effectivenessStatus','STRING','VALUE',true),
('ChangeControl','evaluation','STRING','VALUE',true),
('ChangeControl','executionDate','DATE','VALUE',false),
('ChangeControl','executionStatus','STRING','VALUE',false),
('ChangeControl','extraData','JSON','VALUE',false),
('ChangeControl','finalStatus','STRING','VALUE',false),
('ChangeControl','followupResponsible','STRING','VALUE',false),
('ChangeControl','formVersionId','STRING','VALUE',false),
('ChangeControl','id','STRING','VALUE',false),
('ChangeControl','includeInKpi','BOOLEAN','VALUE',false),
('ChangeControl','internalObservations','STRING','VALUE',false),
('ChangeControl','justification','STRING','VALUE',false),
('ChangeControl','kpiExclusionReason','STRING','VALUE',false),
('ChangeControl','operationalClosedAt','DATE','VALUE',false),
('ChangeControl','otherImplicationDetails','STRING','VALUE',false),
('ChangeControl','otherImplicationRequired','BOOLEAN','VALUE',false),
('ChangeControl','otherScope','STRING','VALUE',false),
('ChangeControl','plannedImplementationDate','DATE','VALUE',false),
('ChangeControl','pqrPeriod','STRING','VALUE',false),
('ChangeControl','pqrProducts','STRING','VALUE',false),
('ChangeControl','pqrRequired','STRING','VALUE',false),
('ChangeControl','providedDocuments','STRING','VALUE',false),
('ChangeControl','qmsRecordId','STRING','VALUE',false),
('ChangeControl','requestDate','DATE','VALUE',false),
('ChangeControl','requestDecision','STRING','VALUE',true),
('ChangeControl','requestDecisionDate','DATE','VALUE',false),
('ChangeControl','requestDecisionResponsible','STRING','VALUE',false),
('ChangeControl','requestDecisionRole','STRING','VALUE',false),
('ChangeControl','requesterName','STRING','VALUE',false),
('ChangeControl','requesterPosition','STRING','VALUE',false),
('ChangeControl','scope','JSON','VALUE',false),
('ChangeControl','signedDocumentAvailable','BOOLEAN','VALUE',false),
('ChangeControl','stabilityAccelerated','BOOLEAN','VALUE',false),
('ChangeControl','stabilityOngoing','BOOLEAN','VALUE',false),
('ChangeControl','stabilityRequired','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('ChangeControlFollowup',ARRAY['id'],'[{"via":"changeControlId","table":"ChangeControl"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ChangeControlFollowup','approvalByText','STRING','VALUE',false),
('ChangeControlFollowup','changeControlId','STRING','VALUE',false),
('ChangeControlFollowup','closeChange','BOOLEAN','VALUE',false),
('ChangeControlFollowup','conclusion','STRING','VALUE',false),
('ChangeControlFollowup','effectivenessObservations','STRING','VALUE',false),
('ChangeControlFollowup','effectivenessStatus','STRING','VALUE',false),
('ChangeControlFollowup','executionDate','DATE','VALUE',false),
('ChangeControlFollowup','executionStatus','STRING','VALUE',false),
('ChangeControlFollowup','followupDate','DATE','VALUE',false),
('ChangeControlFollowup','id','STRING','VALUE',false),
('ChangeControlFollowup','nextFollowupDate','DATE','VALUE',false),
('ChangeControlFollowup','observations','STRING','VALUE',false),
('ChangeControlFollowup','remainOpenReason','STRING','VALUE',false),
('ChangeControlFollowup','responsible','STRING','VALUE',false),
('ChangeControlFollowup','sequenceNumber','INTEGER','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('ChangeControlTask',ARRAY['id'],'[{"via":"changeControlId","table":"ChangeControl"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ChangeControlTask','changeControlId','STRING','VALUE',false),
('ChangeControlTask','departmentCodeSnapshot','STRING','VALUE',false),
('ChangeControlTask','departmentId','STRING','VALUE',false),
('ChangeControlTask','departmentNameSnapshot','STRING','VALUE',false),
('ChangeControlTask','description','STRING','VALUE',false),
('ChangeControlTask','id','STRING','VALUE',false),
('ChangeControlTask','introducedInFollowup','INTEGER','VALUE',false),
('ChangeControlTask','origin','STRING','VALUE',false),
('ChangeControlTask','plannedDate','DATE','VALUE',false),
('ChangeControlTask','responsible','STRING','VALUE',false),
('ChangeControlTask','sortOrder','INTEGER','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('ChangeControlTaskState',ARRAY['id'],'[{"via":"taskId","table":"ChangeControlTask"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ChangeControlTaskState','actualDate','DATE','VALUE',false),
('ChangeControlTaskState','evidenceComment','STRING','VALUE',false),
('ChangeControlTaskState','followupId','STRING','VALUE',false),
('ChangeControlTaskState','id','STRING','VALUE',false),
('ChangeControlTaskState','status','STRING','VALUE',false),
('ChangeControlTaskState','taskId','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('ChangeHistory',ARRAY['id'],'[{"kind":"QMS_RECORD","field":"qmsRecordId"}]'::jsonb,'EVIDENCE');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ChangeHistory','authenticatedUserId','STRING','VALUE',false),
('ChangeHistory','changedAt','INSTANT','VALUE',false),
('ChangeHistory','changedByText','STRING','VALUE',false),
('ChangeHistory','fieldPath','STRING','VALUE',false),
('ChangeHistory','id','STRING','VALUE',false),
('ChangeHistory','qmsRecordId','STRING','VALUE',false),
('ChangeHistory','reason','STRING','VALUE',false),
('ChangeHistory','source','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('Complaint',ARRAY['id'],'[{"kind":"QMS_RECORD","field":"qmsRecordId"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('Complaint','affectedObjectOther','STRING','VALUE',false),
('Complaint','affectedObjectTypes','JSON','VALUE',false),
('Complaint','affectedScope','STRING','VALUE',false),
('Complaint','annexIIITemplateVersionId','STRING','VALUE',false),
('Complaint','annexIVTemplateVersionId','STRING','VALUE',false),
('Complaint','annexVTemplateVersionId','STRING','VALUE',false),
('Complaint','approvalNames','STRING','VALUE',false),
('Complaint','attachedDocumentation','STRING','VALUE',false),
('Complaint','authorityNotificationRequired','STRING','VALUE',false),
('Complaint','categoryOther','STRING','VALUE',false),
('Complaint','categoryTypes','JSON','VALUE',false),
('Complaint','classification','STRING','VALUE',true),
('Complaint','closeActionReferences','STRING','VALUE',false),
('Complaint','closeActionStatus','STRING','VALUE',false),
('Complaint','closeApprovalNames','STRING','VALUE',false),
('Complaint','closeConclusion','STRING','VALUE',false),
('Complaint','closedAt','DATE','VALUE',false),
('Complaint','communicationDate','DATE','VALUE',false),
('Complaint','communicationMedium','STRING','VALUE',false),
('Complaint','communicationParties','STRING','VALUE',false),
('Complaint','communicationSummary','STRING','VALUE',false),
('Complaint','complaintType','STRING','VALUE',false),
('Complaint','conclusion','STRING','VALUE',true),
('Complaint','contact','STRING','VALUE',false),
('Complaint','containmentActions','JSON','VALUE',false),
('Complaint','containmentOther','STRING','VALUE',false),
('Complaint','createdByText','STRING','VALUE',false),
('Complaint','creditActionDetails','STRING','VALUE',false),
('Complaint','dataQualityStatus','STRING','VALUE',false),
('Complaint','departmentCodeSnapshot','STRING','VALUE',false),
('Complaint','departmentId','STRING','VALUE',false),
('Complaint','departmentNameSnapshot','STRING','VALUE',false),
('Complaint','description','STRING','VALUE',false),
('Complaint','detectedBy','STRING','VALUE',false),
('Complaint','detectionDate','DATE','VALUE',false),
('Complaint','effectivenessAssessment','STRING','VALUE',false),
('Complaint','effectivenessRequired','BOOLEAN','VALUE',false),
('Complaint','effectivenessStatus','STRING','VALUE',false),
('Complaint','emittedBy','STRING','VALUE',false),
('Complaint','expiryReanalysis','STRING','VALUE',false),
('Complaint','externalCommunication','STRING','VALUE',false),
('Complaint','extraData','JSON','VALUE',false),
('Complaint','formVersionId','STRING','VALUE',false),
('Complaint','hasDerivedActions','BOOLEAN','VALUE',false),
('Complaint','id','STRING','VALUE',false),
('Complaint','immediateActionDetails','STRING','VALUE',false),
('Complaint','impactAssessment','STRING','VALUE',true),
('Complaint','impactEnvironment','STRING','VALUE',false),
('Complaint','impactOtherSimilar','STRING','VALUE',false),
('Complaint','impactQualityGmp','STRING','VALUE',false),
('Complaint','impactRegulatory','STRING','VALUE',false),
('Complaint','impactSafetyEfficacy','STRING','VALUE',false),
('Complaint','includeInKpi','BOOLEAN','VALUE',false),
('Complaint','initialConclusionDate','DATE','VALUE',false),
('Complaint','initialEvaluationDate','DATE','VALUE',false),
('Complaint','internalObservations','STRING','VALUE',false),
('Complaint','investigation','STRING','VALUE',true),
('Complaint','investigationResult','STRING','VALUE',false),
('Complaint','kpiExclusionReason','STRING','VALUE',false),
('Complaint','lotReference','STRING','VALUE',false),
('Complaint','nextFollowupDate','DATE','VALUE',false),
('Complaint','openedAt','DATE','VALUE',false),
('Complaint','otherResolutionDetails','STRING','VALUE',false),
('Complaint','partIIRequired','BOOLEAN','VALUE',false),
('Complaint','partyName','STRING','VALUE',false),
('Complaint','potentialRecall','STRING','VALUE',false),
('Complaint','purchaseDeliveryReference','STRING','VALUE',false),
('Complaint','qaValidatedBy','STRING','VALUE',false),
('Complaint','qmsRecordId','STRING','VALUE',false),
('Complaint','quantity','STRING','VALUE',false),
('Complaint','recallActionDetails','STRING','VALUE',false),
('Complaint','recallProcedureRequired','STRING','VALUE',false),
('Complaint','receptionDate','DATE','VALUE',false),
('Complaint','recurrenceReference','STRING','VALUE',false),
('Complaint','recurrent','BOOLEAN','VALUE',false),
('Complaint','reference','STRING','VALUE',false),
('Complaint','regulatoryJustification','STRING','VALUE',false),
('Complaint','replacementActionDetails','STRING','VALUE',false),
('Complaint','resolutionActions','JSON','VALUE',false),
('Complaint','resolutionLines','STRING','VALUE',false),
('Complaint','responseDate','DATE','VALUE',false),
('Complaint','responseMedium','STRING','VALUE',false),
('Complaint','responseSufficient','BOOLEAN','VALUE',false),
('Complaint','responseSummary','STRING','VALUE',false),
('Complaint','responsiblePartyCommunicationRequired','STRING','VALUE',false),
('Complaint','riskJustification','STRING','VALUE',false),
('Complaint','rootCause','STRING','VALUE',true),
('Complaint','scopeOther','STRING','VALUE',false),
('Complaint','scopeTypes','JSON','VALUE',false),
('Complaint','signedDocumentAvailable','BOOLEAN','VALUE',false),
('Complaint','sourceOther','STRING','VALUE',false),
('Complaint','sourceTypes','JSON','VALUE',false),
('Complaint','status','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('ComplaintCapaPlan',ARRAY['id'],'[{"via":"complaintId","table":"Complaint"},{"kind":"QMS_RECORD","field":"linkedCapaRecordId"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ComplaintCapaPlan','actionType','STRING','VALUE',false),
('ComplaintCapaPlan','businessCapaCode','STRING','VALUE',false),
('ComplaintCapaPlan','complaintId','STRING','VALUE',false),
('ComplaintCapaPlan','description','STRING','VALUE',false),
('ComplaintCapaPlan','id','STRING','VALUE',false),
('ComplaintCapaPlan','linkedCapaRecordId','STRING','VALUE',false),
('ComplaintCapaPlan','plannedExecutionDate','DATE','VALUE',false),
('ComplaintCapaPlan','proposalStatus','STRING','VALUE',false),
('ComplaintCapaPlan','responsible','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('ComplaintDerivedAction',ARRAY['id'],'[{"via":"complaintId","table":"Complaint"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ComplaintDerivedAction','actionType','STRING','VALUE',false),
('ComplaintDerivedAction','businessCode','STRING','VALUE',false),
('ComplaintDerivedAction','complaintId','STRING','VALUE',false),
('ComplaintDerivedAction','description','STRING','VALUE',false),
('ComplaintDerivedAction','id','STRING','VALUE',false),
('ComplaintDerivedAction','plannedExecutionDate','DATE','VALUE',false),
('ComplaintDerivedAction','responsible','STRING','VALUE',false),
('ComplaintDerivedAction','sortOrder','INTEGER','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('ComplaintFollowup',ARRAY['id'],'[{"via":"complaintId","table":"Complaint"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ComplaintFollowup','comment','STRING','VALUE',false),
('ComplaintFollowup','complaintId','STRING','VALUE',false),
('ComplaintFollowup','completedByText','STRING','VALUE',false),
('ComplaintFollowup','evidenceReference','STRING','VALUE',false),
('ComplaintFollowup','followupDate','DATE','VALUE',false),
('ComplaintFollowup','followupType','STRING','VALUE',false),
('ComplaintFollowup','id','STRING','VALUE',false),
('ComplaintFollowup','nextFollowupDate','DATE','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('ConfigurationChange',ARRAY['id'],'[{"kind":"ADMINISTRATION","category":"CONFIGURATION"}]'::jsonb,'EVIDENCE');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ConfigurationChange','action','STRING','VALUE',false),
('ConfigurationChange','authenticatedUserId','STRING','VALUE',false),
('ConfigurationChange','changedByText','STRING','VALUE',false),
('ConfigurationChange','entityKey','STRING','VALUE',false),
('ConfigurationChange','entityType','STRING','VALUE',false),
('ConfigurationChange','id','STRING','VALUE',false),
('ConfigurationChange','reason','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('ControlledDecisionEvidence',ARRAY['id'],'[{"via":"revisionId","table":"ControlledDocumentRevision"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ControlledDecisionEvidence','decisionId','STRING','VALUE',false),
('ControlledDecisionEvidence','documentObjectId','STRING','VALUE',false),
('ControlledDecisionEvidence','id','STRING','VALUE',false),
('ControlledDecisionEvidence','revisionId','STRING','VALUE',false),
('ControlledDecisionEvidence','snapshot','STRING','SHA256_JSON',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('ControlledDocument',ARRAY['id'],'[{"kind":"PNT","field":"id"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ControlledDocument','administrativeStatus','STRING','VALUE',false),
('ControlledDocument','annulledAt','INSTANT','VALUE',false),
('ControlledDocument','annulledByText','STRING','VALUE',false),
('ControlledDocument','annulmentReason','STRING','VALUE',false),
('ControlledDocument','baseCode','STRING','VALUE',false),
('ControlledDocument','createdByText','STRING','VALUE',false),
('ControlledDocument','departmentCodeSnapshot','STRING','VALUE',false),
('ControlledDocument','departmentId','STRING','VALUE',false),
('ControlledDocument','departmentNameSnapshot','STRING','VALUE',false),
('ControlledDocument','documentType','STRING','VALUE',false),
('ControlledDocument','id','STRING','VALUE',false),
('ControlledDocument','observations','STRING','VALUE',false),
('ControlledDocument','sourceMetadata','STRING','SHA256_JSON',false),
('ControlledDocument','title','STRING','VALUE',false),
('ControlledDocument','verificationStatus','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('ControlledDocumentChange',ARRAY['id'],'[{"kind":"PNT","field":"documentId"}]'::jsonb,'EVIDENCE');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ControlledDocumentChange','action','STRING','VALUE',false),
('ControlledDocumentChange','authenticatedUserId','STRING','VALUE',false),
('ControlledDocumentChange','changedAt','INSTANT','VALUE',false),
('ControlledDocumentChange','changedByText','STRING','VALUE',false),
('ControlledDocumentChange','documentId','STRING','VALUE',false),
('ControlledDocumentChange','id','STRING','VALUE',false),
('ControlledDocumentChange','reason','STRING','VALUE',false),
('ControlledDocumentChange','revisionId','STRING','VALUE',false),
('ControlledDocumentChange','source','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('ControlledDocumentImportBatch',ARRAY['id'],'[{"kind":"ADMINISTRATION","category":"PNT_IMPORT"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ControlledDocumentImportBatch','actor','STRING','VALUE',false),
('ControlledDocumentImportBatch','analyzedAt','INSTANT','VALUE',false),
('ControlledDocumentImportBatch','confirmedAt','INSTANT','VALUE',false),
('ControlledDocumentImportBatch','expiresAt','INSTANT','VALUE',false),
('ControlledDocumentImportBatch','fileName','STRING','VALUE',false),
('ControlledDocumentImportBatch','id','STRING','VALUE',false),
('ControlledDocumentImportBatch','reportMetadata','STRING','SHA256_JSON',false),
('ControlledDocumentImportBatch','sha256','STRING','VALUE',false),
('ControlledDocumentImportBatch','state','STRING','VALUE',false),
('ControlledDocumentImportBatch','summary','STRING','SHA256_JSON',false),
('ControlledDocumentImportBatch','version','INTEGER','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('ControlledDocumentImportEvent',ARRAY['id'],'[{"kind":"ADMINISTRATION","category":"PNT_IMPORT"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ControlledDocumentImportEvent','action','STRING','VALUE',false),
('ControlledDocumentImportEvent','actor','STRING','VALUE',false),
('ControlledDocumentImportEvent','authenticatedUserId','STRING','VALUE',false),
('ControlledDocumentImportEvent','batchId','STRING','VALUE',false),
('ControlledDocumentImportEvent','detail','JSON','VALUE',false),
('ControlledDocumentImportEvent','id','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('ControlledDocumentImportRow',ARRAY['id'],'[{"kind":"ADMINISTRATION","category":"PNT_IMPORT"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ControlledDocumentImportRow','baseCode','STRING','VALUE',false),
('ControlledDocumentImportRow','baseline','STRING','VALUE',false),
('ControlledDocumentImportRow','batchId','STRING','VALUE',false),
('ControlledDocumentImportRow','data','STRING','SHA256_JSON',false),
('ControlledDocumentImportRow','decidedAt','INSTANT','VALUE',false),
('ControlledDocumentImportRow','decidedBy','STRING','VALUE',false),
('ControlledDocumentImportRow','decision','STRING','VALUE',false),
('ControlledDocumentImportRow','id','STRING','VALUE',false),
('ControlledDocumentImportRow','resolution','STRING','SHA256_JSON',false),
('ControlledDocumentImportRow','sourceKey','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('ControlledDocumentRevision',ARRAY['id'],'[{"kind":"PNT","field":"documentId"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ControlledDocumentRevision','baseCodeSnapshot','STRING','VALUE',false),
('ControlledDocumentRevision','consolidatedAt','INSTANT','VALUE',false),
('ControlledDocumentRevision','departmentCodeSnapshot','STRING','VALUE',false),
('ControlledDocumentRevision','departmentNameSnapshot','STRING','VALUE',false),
('ControlledDocumentRevision','documentId','STRING','VALUE',false),
('ControlledDocumentRevision','effectiveFrom','DATE','VALUE',false),
('ControlledDocumentRevision','id','STRING','VALUE',false),
('ControlledDocumentRevision','obsoletedAt','DATE','VALUE',false),
('ControlledDocumentRevision','previousRevisionId','STRING','VALUE',false),
('ControlledDocumentRevision','registeredAt','INSTANT','VALUE',false),
('ControlledDocumentRevision','registeredByText','STRING','VALUE',false),
('ControlledDocumentRevision','reviewDueAt','DATE','VALUE',false),
('ControlledDocumentRevision','revisionCode','STRING','VALUE',false),
('ControlledDocumentRevision','revisionReason','STRING','VALUE',false),
('ControlledDocumentRevision','sourceMetadata','STRING','SHA256_JSON',false),
('ControlledDocumentRevision','sourceReference','STRING','VALUE',false),
('ControlledDocumentRevision','status','STRING','VALUE',false),
('ControlledDocumentRevision','titleSnapshot','STRING','VALUE',false),
('ControlledDocumentRevision','verificationStatus','STRING','VALUE',false),
('ControlledDocumentRevision','verifiedAt','INSTANT','VALUE',false),
('ControlledDocumentRevision','verifiedByText','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('ControlledRevisionDecision',ARRAY['id'],'[{"kind":"PNT","field":"documentId"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ControlledRevisionDecision','actor','STRING','VALUE',false),
('ControlledRevisionDecision','after','STRING','SHA256_JSON',false),
('ControlledRevisionDecision','authenticatedUserId','STRING','VALUE',false),
('ControlledRevisionDecision','before','STRING','SHA256_JSON',false),
('ControlledRevisionDecision','decidedAt','INSTANT','VALUE',false),
('ControlledRevisionDecision','details','STRING','SHA256_JSON',false),
('ControlledRevisionDecision','documentId','STRING','VALUE',false),
('ControlledRevisionDecision','id','STRING','VALUE',false),
('ControlledRevisionDecision','identitySource','STRING','VALUE',false),
('ControlledRevisionDecision','newState','STRING','VALUE',false),
('ControlledRevisionDecision','oldState','STRING','VALUE',false),
('ControlledRevisionDecision','operation','STRING','VALUE',false),
('ControlledRevisionDecision','reason','STRING','VALUE',false),
('ControlledRevisionDecision','rectifiesId','STRING','VALUE',false),
('ControlledRevisionDecision','requestHash','STRING','VALUE',false),
('ControlledRevisionDecision','requestId','STRING','VALUE',false),
('ControlledRevisionDecision','result','STRING','VALUE',false),
('ControlledRevisionDecision','revisionId','STRING','VALUE',false),
('ControlledRevisionDecision','sequence','INTEGER','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('ControlledRevisionDocument',ARRAY['id'],'[{"kind":"PNT","field":"documentId"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ControlledRevisionDocument','authenticatedUserId','STRING','VALUE',false),
('ControlledRevisionDocument','description','STRING','VALUE',false),
('ControlledRevisionDocument','documentId','STRING','VALUE',false),
('ControlledRevisionDocument','externalReference','STRING','VALUE',false),
('ControlledRevisionDocument','id','STRING','VALUE',false),
('ControlledRevisionDocument','identitySource','STRING','VALUE',false),
('ControlledRevisionDocument','incorporatedAt','INSTANT','VALUE',false),
('ControlledRevisionDocument','incorporatedBy','STRING','VALUE',false),
('ControlledRevisionDocument','kind','STRING','VALUE',false),
('ControlledRevisionDocument','mimeType','STRING','VALUE',false),
('ControlledRevisionDocument','originalName','STRING','VALUE',false),
('ControlledRevisionDocument','replacementReason','STRING','VALUE',false),
('ControlledRevisionDocument','replacesId','STRING','VALUE',false),
('ControlledRevisionDocument','revisionId','STRING','VALUE',false),
('ControlledRevisionDocument','sha256','STRING','VALUE',true),
('ControlledRevisionDocument','sizeBytes','INTEGER','VALUE',false),
('ControlledRevisionDocument','state','STRING','VALUE',false),
('ControlledRevisionDocument','storageReference','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('ControlledRevisionLifecycle',ARRAY['revisionId'],'[{"kind":"PNT","field":"documentId"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ControlledRevisionLifecycle','approvalAt','DATE','VALUE',false),
('ControlledRevisionLifecycle','documentId','STRING','VALUE',false),
('ControlledRevisionLifecycle','effectiveFrom','DATE','VALUE',false),
('ControlledRevisionLifecycle','legacyOrigin','BOOLEAN','VALUE',false),
('ControlledRevisionLifecycle','obsoletedAt','DATE','VALUE',false),
('ControlledRevisionLifecycle','reviewDueAt','DATE','VALUE',false),
('ControlledRevisionLifecycle','revisionId','STRING','VALUE',false),
('ControlledRevisionLifecycle','version','INTEGER','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('Department',ARRAY['id'],'[{"kind":"ADMINISTRATION","category":"CONFIGURATION"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('Department','code','STRING','VALUE',false),
('Department','id','STRING','VALUE',false),
('Department','isActive','BOOLEAN','VALUE',false),
('Department','name','STRING','VALUE',false),
('Department','validFrom','DATE','VALUE',false),
('Department','validTo','DATE','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('Deviation',ARRAY['id'],'[{"kind":"QMS_RECORD","field":"qmsRecordId"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('Deviation','affectedDocumentation','STRING','VALUE',false),
('Deviation','affectedEquipmentLine','STRING','VALUE',false),
('Deviation','affectedQuantity','STRING','VALUE',false),
('Deviation','affectsFinishedProduct','STRING','VALUE',false),
('Deviation','anexoIIITemplateVersionId','STRING','VALUE',false),
('Deviation','capaRequired','BOOLEAN','VALUE',true),
('Deviation','classification','STRING','VALUE',true),
('Deviation','client','STRING','VALUE',false),
('Deviation','clientNotification','STRING','VALUE',false),
('Deviation','closedAt','DATE','VALUE',false),
('Deviation','conclusion','STRING','VALUE',true),
('Deviation','createdByText','STRING','VALUE',false),
('Deviation','dataQualityStatus','STRING','VALUE',false),
('Deviation','deadlineStatus','STRING','VALUE',false),
('Deviation','departmentCodeSnapshot','STRING','VALUE',false),
('Deviation','departmentId','STRING','VALUE',false),
('Deviation','departmentNameSnapshot','STRING','VALUE',false),
('Deviation','detectedBy','STRING','VALUE',false),
('Deviation','disposition','STRING','VALUE',true),
('Deviation','dispositionComments','STRING','VALUE',true),
('Deviation','dispositionQuantity','STRING','VALUE',false),
('Deviation','eventDateTime','INSTANT','VALUE',false),
('Deviation','extraData','JSON','VALUE',false),
('Deviation','finishedProductSystem','STRING','VALUE',false),
('Deviation','formVersionId','STRING','VALUE',false),
('Deviation','howHappened','STRING','VALUE',false),
('Deviation','id','STRING','VALUE',false),
('Deviation','includeInKpi','BOOLEAN','VALUE',false),
('Deviation','internalObservations','STRING','VALUE',false),
('Deviation','investigation','STRING','VALUE',true),
('Deviation','investigationConclusive','STRING','VALUE',false),
('Deviation','investigationMethods','JSON','VALUE',false),
('Deviation','issueDate','DATE','VALUE',false),
('Deviation','kpiExclusionReason','STRING','VALUE',false),
('Deviation','lotSize','STRING','VALUE',false),
('Deviation','materialAffectedQuantity','STRING','VALUE',false),
('Deviation','materialLot','STRING','VALUE',false),
('Deviation','materialLotSize','STRING','VALUE',false),
('Deviation','materialProcessAffected','STRING','VALUE',false),
('Deviation','otherOrigin','STRING','VALUE',false),
('Deviation','otherProcessesImpact','STRING','VALUE',true),
('Deviation','otherProcessesImpactDetails','STRING','VALUE',true),
('Deviation','processEquipmentSystem','STRING','VALUE',false),
('Deviation','productLot','STRING','VALUE',false),
('Deviation','provenance','STRING','VALUE',false),
('Deviation','qmsRecordId','STRING','VALUE',false),
('Deviation','rawOrPackagingMaterial','STRING','VALUE',false),
('Deviation','recurrenceDetails','STRING','VALUE',false),
('Deviation','recurrentRootCause','STRING','VALUE',false),
('Deviation','registrationImpact','STRING','VALUE',true),
('Deviation','rootCause','STRING','VALUE',true),
('Deviation','signedDocumentAvailable','BOOLEAN','VALUE',false),
('Deviation','stabilityImpact','STRING','VALUE',true),
('Deviation','status','STRING','VALUE',false),
('Deviation','supplier','STRING','VALUE',false),
('Deviation','supplierLot','STRING','VALUE',false),
('Deviation','validationImpact','STRING','VALUE',true),
('Deviation','whatHappened','STRING','VALUE',false),
('Deviation','whenHappened','STRING','VALUE',false),
('Deviation','whereHappened','STRING','VALUE',false),
('Deviation','whoInvolved','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('DeviationCapaPlan',ARRAY['id'],'[{"via":"deviationId","table":"Deviation"},{"kind":"QMS_RECORD","field":"linkedCapaRecordId"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('DeviationCapaPlan','actionType','STRING','VALUE',false),
('DeviationCapaPlan','businessCapaCode','STRING','VALUE',false),
('DeviationCapaPlan','description','STRING','VALUE',false),
('DeviationCapaPlan','deviationId','STRING','VALUE',false),
('DeviationCapaPlan','id','STRING','VALUE',false),
('DeviationCapaPlan','linkedCapaRecordId','STRING','VALUE',false),
('DeviationCapaPlan','plannedExecutionDate','DATE','VALUE',false),
('DeviationCapaPlan','proposalStatus','STRING','VALUE',false),
('DeviationCapaPlan','responsible','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('DeviationFollowup',ARRAY['id'],'[{"via":"deviationId","table":"Deviation"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('DeviationFollowup','comment','STRING','VALUE',false),
('DeviationFollowup','completedByText','STRING','VALUE',false),
('DeviationFollowup','deviationId','STRING','VALUE',false),
('DeviationFollowup','evidenceReference','STRING','VALUE',false),
('DeviationFollowup','followupDate','DATE','VALUE',false),
('DeviationFollowup','followupType','STRING','VALUE',false),
('DeviationFollowup','id','STRING','VALUE',false),
('DeviationFollowup','nextFollowupDate','DATE','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('DeviationImmediateAction',ARRAY['id'],'[{"via":"deviationId","table":"Deviation"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('DeviationImmediateAction','description','STRING','VALUE',false),
('DeviationImmediateAction','deviationId','STRING','VALUE',false),
('DeviationImmediateAction','executedAt','DATE','VALUE',false),
('DeviationImmediateAction','executedBy','STRING','VALUE',false),
('DeviationImmediateAction','id','STRING','VALUE',false),
('DeviationImmediateAction','sortOrder','INTEGER','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('FormFieldConfig',ARRAY['id'],'[{"kind":"ADMINISTRATION","category":"CONFIGURATION"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('FormFieldConfig','editableDefinition','BOOLEAN','VALUE',false),
('FormFieldConfig','fieldKey','STRING','VALUE',false),
('FormFieldConfig','filterable','BOOLEAN','VALUE',false),
('FormFieldConfig','formVersionId','STRING','VALUE',false),
('FormFieldConfig','id','STRING','VALUE',false),
('FormFieldConfig','kind','STRING','VALUE',false),
('FormFieldConfig','label','STRING','VALUE',false),
('FormFieldConfig','listAvailable','BOOLEAN','VALUE',false),
('FormFieldConfig','listVisibleByDefault','BOOLEAN','VALUE',false),
('FormFieldConfig','officialAnnexField','BOOLEAN','VALUE',true),
('FormFieldConfig','options','JSON','VALUE',true),
('FormFieldConfig','required','BOOLEAN','VALUE',true),
('FormFieldConfig','sectionKey','STRING','VALUE',false),
('FormFieldConfig','sectionLabel','STRING','VALUE',false),
('FormFieldConfig','simpleExport','BOOLEAN','VALUE',false),
('FormFieldConfig','sortOrder','INTEGER','VALUE',false),
('FormFieldConfig','valueType','STRING','VALUE',true);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('FormVersion',ARRAY['id'],'[{"kind":"ADMINISTRATION","category":"CONFIGURATION"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('FormVersion','effectiveFrom','DATE','VALUE',false),
('FormVersion','effectiveTo','DATE','VALUE',false),
('FormVersion','id','STRING','VALUE',false),
('FormVersion','isActive','BOOLEAN','VALUE',true),
('FormVersion','module','STRING','VALUE',false),
('FormVersion','notes','STRING','VALUE',false),
('FormVersion','status','STRING','VALUE',true),
('FormVersion','versionCode','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('GeneratedDocument',ARRAY['id'],'[{"kind":"QMS_RECORD","field":"qmsRecordId"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('GeneratedDocument','authenticatedUserId','STRING','VALUE',false),
('GeneratedDocument','checksum','STRING','VALUE',false),
('GeneratedDocument','documentType','STRING','VALUE',false),
('GeneratedDocument','fileName','STRING','VALUE',false),
('GeneratedDocument','generatedAt','INSTANT','VALUE',false),
('GeneratedDocument','generatedByText','STRING','VALUE',false),
('GeneratedDocument','id','STRING','VALUE',false),
('GeneratedDocument','metadata','STRING','SHA256_JSON',false),
('GeneratedDocument','mimeType','STRING','VALUE',false),
('GeneratedDocument','qmsRecordId','STRING','VALUE',false),
('GeneratedDocument','recordVersionId','STRING','VALUE',false),
('GeneratedDocument','templateVersionId','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('HistoricalImportBatch',ARRAY['id'],'[{"kind":"ADMINISTRATION","category":"HISTORICAL_IMPORT"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('HistoricalImportBatch','appliedAt','INSTANT','VALUE',false),
('HistoricalImportBatch','duplicateRows','INTEGER','VALUE',false),
('HistoricalImportBatch','id','STRING','VALUE',false),
('HistoricalImportBatch','importedByText','STRING','VALUE',false),
('HistoricalImportBatch','importedRows','INTEGER','VALUE',false),
('HistoricalImportBatch','recordType','STRING','VALUE',false),
('HistoricalImportBatch','rejectedRows','INTEGER','VALUE',false),
('HistoricalImportBatch','report','STRING','SHA256_JSON',false),
('HistoricalImportBatch','reviewRows','INTEGER','VALUE',false),
('HistoricalImportBatch','sourceFileName','STRING','VALUE',false),
('HistoricalImportBatch','sourceSha256','STRING','VALUE',false),
('HistoricalImportBatch','totalRows','INTEGER','VALUE',false),
('HistoricalImportBatch','years','JSON','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('HistoricalImportRow',ARRAY['id'],'[{"kind":"QMS_RECORD","field":"qmsRecordId"},{"kind":"ADMINISTRATION","category":"HISTORICAL_IMPORT"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('HistoricalImportRow','batchId','STRING','VALUE',false),
('HistoricalImportRow','businessCode','STRING','VALUE',false),
('HistoricalImportRow','id','STRING','VALUE',false),
('HistoricalImportRow','issues','JSON','VALUE',false),
('HistoricalImportRow','qmsRecordId','STRING','VALUE',false),
('HistoricalImportRow','result','STRING','VALUE',false),
('HistoricalImportRow','sourceRow','INTEGER','VALUE',false),
('HistoricalImportRow','sourceSheet','STRING','VALUE',false),
('HistoricalImportRow','sourceSnapshot','STRING','SHA256_JSON',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('LookupCatalog',ARRAY['id'],'[{"kind":"ADMINISTRATION","category":"CONFIGURATION"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('LookupCatalog','description','STRING','VALUE',false),
('LookupCatalog','id','STRING','VALUE',false),
('LookupCatalog','isActive','BOOLEAN','VALUE',false),
('LookupCatalog','key','STRING','VALUE',false),
('LookupCatalog','label','STRING','VALUE',false),
('LookupCatalog','module','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('LookupCatalogItem',ARRAY['id'],'[{"kind":"ADMINISTRATION","category":"CONFIGURATION"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('LookupCatalogItem','catalogId','STRING','VALUE',false),
('LookupCatalogItem','id','STRING','VALUE',false),
('LookupCatalogItem','isActive','BOOLEAN','VALUE',false),
('LookupCatalogItem','key','STRING','VALUE',false),
('LookupCatalogItem','label','STRING','VALUE',false),
('LookupCatalogItem','notes','STRING','VALUE',false),
('LookupCatalogItem','sortOrder','INTEGER','VALUE',false),
('LookupCatalogItem','validFrom','DATE','VALUE',false),
('LookupCatalogItem','validTo','DATE','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('QmsRecord',ARRAY['id'],'[{"kind":"QMS_RECORD","field":"id"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('QmsRecord','annulledAt','INSTANT','VALUE',false),
('QmsRecord','annulledBusinessCode','STRING','VALUE',false),
('QmsRecord','annulledByText','STRING','VALUE',false),
('QmsRecord','annulledReason','STRING','VALUE',false),
('QmsRecord','businessCode','STRING','VALUE',false),
('QmsRecord','id','STRING','VALUE',false),
('QmsRecord','isActive','BOOLEAN','VALUE',false),
('QmsRecord','recordType','STRING','VALUE',false),
('QmsRecord','year','INTEGER','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('QmsRecordVersion',ARRAY['id'],'[{"kind":"QMS_RECORD","field":"qmsRecordId"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('QmsRecordVersion','authenticatedUserId','STRING','VALUE',false),
('QmsRecordVersion','createdByText','STRING','VALUE',false),
('QmsRecordVersion','frozenAt','INSTANT','VALUE',false),
('QmsRecordVersion','id','STRING','VALUE',false),
('QmsRecordVersion','kind','STRING','VALUE',false),
('QmsRecordVersion','qmsRecordId','STRING','VALUE',false),
('QmsRecordVersion','reason','STRING','VALUE',false),
('QmsRecordVersion','sequenceNumber','INTEGER','VALUE',false),
('QmsRecordVersion','snapshot','STRING','SHA256_JSON',false),
('QmsRecordVersion','source','STRING','VALUE',false),
('QmsRecordVersion','sourceEntityId','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('QmsRelation',ARRAY['id'],'[{"kind":"QMS_RECORD","field":"sourceRecordId"},{"kind":"QMS_RECORD","field":"targetRecordId"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('QmsRelation','createdByText','STRING','VALUE',false),
('QmsRelation','id','STRING','VALUE',false),
('QmsRelation','isActive','BOOLEAN','VALUE',false),
('QmsRelation','notes','STRING','VALUE',false),
('QmsRelation','relationType','STRING','VALUE',false),
('QmsRelation','sourceRecordId','STRING','VALUE',false),
('QmsRelation','targetRecordId','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('RecordVersionDocument',ARRAY['id'],'[{"via":"recordVersionId","table":"QmsRecordVersion"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('RecordVersionDocument','checksum','STRING','VALUE',true),
('RecordVersionDocument','fileName','STRING','VALUE',false),
('RecordVersionDocument','fileSize','INTEGER','VALUE',false),
('RecordVersionDocument','id','STRING','VALUE',false),
('RecordVersionDocument','kind','STRING','VALUE',false),
('RecordVersionDocument','mimeType','STRING','VALUE',false),
('RecordVersionDocument','recordVersionId','STRING','VALUE',false),
('RecordVersionDocument','uploadedAt','INSTANT','VALUE',false),
('RecordVersionDocument','uploadedByText','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('ReturnFollowup',ARRAY['id'],'[{"via":"returnRecordId","table":"ReturnRecord"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ReturnFollowup','comment','STRING','VALUE',false),
('ReturnFollowup','completedByText','STRING','VALUE',false),
('ReturnFollowup','evidenceReference','STRING','VALUE',false),
('ReturnFollowup','followupDate','DATE','VALUE',false),
('ReturnFollowup','id','STRING','VALUE',false),
('ReturnFollowup','nextFollowupDate','DATE','VALUE',false),
('ReturnFollowup','returnRecordId','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('ReturnProduct',ARRAY['id'],'[{"via":"returnRecordId","table":"ReturnRecord"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ReturnProduct','departmentId','STRING','VALUE',false),
('ReturnProduct','expiryReanalysis','STRING','VALUE',false),
('ReturnProduct','format','STRING','VALUE',false),
('ReturnProduct','grossWeight','STRING','VALUE',false),
('ReturnProduct','id','STRING','VALUE',false),
('ReturnProduct','lot','STRING','VALUE',false),
('ReturnProduct','netWeight','STRING','VALUE',false),
('ReturnProduct','otherProductType','STRING','VALUE',false),
('ReturnProduct','productNameCode','STRING','VALUE',false),
('ReturnProduct','productType','STRING','VALUE',false),
('ReturnProduct','quantity','STRING','VALUE',false),
('ReturnProduct','receivedBy','STRING','VALUE',false),
('ReturnProduct','receivedByDate','DATE','VALUE',false),
('ReturnProduct','receptionObservations','STRING','VALUE',false),
('ReturnProduct','returnRecordId','STRING','VALUE',false),
('ReturnProduct','sortOrder','INTEGER','VALUE',false),
('ReturnProduct','unit','STRING','VALUE',false),
('ReturnProduct','verifiedBy','STRING','VALUE',false),
('ReturnProduct','verifiedByDate','DATE','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('ReturnRecord',ARRAY['id'],'[{"kind":"QMS_RECORD","field":"qmsRecordId"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ReturnRecord','address','STRING','VALUE',false),
('ReturnRecord','annexIIITemplateVersionId','STRING','VALUE',false),
('ReturnRecord','annexIVTemplateVersionId','STRING','VALUE',false),
('ReturnRecord','annexVITemplateVersionId','STRING','VALUE',false),
('ReturnRecord','annexVTemplateVersionId','STRING','VALUE',false),
('ReturnRecord','attachedDocumentation','STRING','VALUE',false),
('ReturnRecord','closedAt','DATE','VALUE',false),
('ReturnRecord','coldChainReturnSystemValidated','STRING','VALUE',false),
('ReturnRecord','coldChainWithinFortyEightHours','STRING','VALUE',false),
('ReturnRecord','communicationDate','DATE','VALUE',false),
('ReturnRecord','conservationConditions','STRING','VALUE',false),
('ReturnRecord','country','STRING','VALUE',false),
('ReturnRecord','createdByText','STRING','VALUE',false),
('ReturnRecord','customerDeclarationAvailable','STRING','VALUE',false),
('ReturnRecord','customerDeclarationObservations','STRING','VALUE',false),
('ReturnRecord','customerDeclarationSignatoryName','STRING','VALUE',false),
('ReturnRecord','customerDeclarationSignatoryRole','STRING','VALUE',false),
('ReturnRecord','customerDeclarationSignedAt','DATE','VALUE',false),
('ReturnRecord','customerEntity','STRING','VALUE',false),
('ReturnRecord','dataQualityStatus','STRING','VALUE',false),
('ReturnRecord','decision','STRING','VALUE',true),
('ReturnRecord','decisionDate','DATE','VALUE',false),
('ReturnRecord','decisionObservations','STRING','VALUE',true),
('ReturnRecord','deliveryNote','STRING','VALUE',false),
('ReturnRecord','departmentCodeSnapshot','STRING','VALUE',false),
('ReturnRecord','departmentId','STRING','VALUE',false),
('ReturnRecord','departmentNameSnapshot','STRING','VALUE',false),
('ReturnRecord','destructionCertificate','STRING','VALUE',false),
('ReturnRecord','destructionManagedBy','STRING','VALUE',false),
('ReturnRecord','expiryAcceptable','STRING','VALUE',false),
('ReturnRecord','extraData','JSON','VALUE',false),
('ReturnRecord','finalDestination','STRING','VALUE',true),
('ReturnRecord','formVersionId','STRING','VALUE',false),
('ReturnRecord','id','STRING','VALUE',false),
('ReturnRecord','includeInKpi','BOOLEAN','VALUE',false),
('ReturnRecord','internalObservations','STRING','VALUE',false),
('ReturnRecord','kpiExclusionReason','STRING','VALUE',false),
('ReturnRecord','noRecallAlertBlock','STRING','VALUE',false),
('ReturnRecord','noUseDamageContamination','STRING','VALUE',false),
('ReturnRecord','otherReturnType','STRING','VALUE',false),
('ReturnRecord','packagingIntegrityOk','STRING','VALUE',false),
('ReturnRecord','qaApprovalName','STRING','VALUE',false),
('ReturnRecord','qcAssessmentCompleted','STRING','VALUE',false),
('ReturnRecord','qmsRecordId','STRING','VALUE',false),
('ReturnRecord','reasonObservations','STRING','VALUE',false),
('ReturnRecord','receiptTemperatureAcceptable','STRING','VALUE',false),
('ReturnRecord','receivedAt','DATE','VALUE',false),
('ReturnRecord','relatedDocument','STRING','VALUE',false),
('ReturnRecord','returnTransportTempEvidence','STRING','VALUE',false),
('ReturnRecord','returnType','STRING','VALUE',false),
('ReturnRecord','roomTemperatureWithinTenDays','STRING','VALUE',false),
('ReturnRecord','signedDocumentAvailable','BOOLEAN','VALUE',false),
('ReturnRecord','status','STRING','VALUE',false),
('ReturnRecord','storageTemperatureRecord','STRING','VALUE',false),
('ReturnRecord','storageTransportConditionsOk','STRING','VALUE',false),
('ReturnRecord','tamperEvidenceIntact','STRING','VALUE',false),
('ReturnRecord','technicalApprovalName','STRING','VALUE',false),
('ReturnRecord','temperatureExcursionEvaluated','STRING','VALUE',false),
('ReturnRecord','traceabilityUpdated','STRING','VALUE',false),
('ReturnRecord','transportPackagingSuitable','STRING','VALUE',false),
('ReturnRecord','uniqueIdentifierActive','STRING','VALUE',false),
('ReturnRecord','withinAcceptedReturnPeriod','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('ReviewMessage',ARRAY['id'],'[{"via":"reviewThreadId","table":"ReviewThread"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ReviewMessage','authenticatedUserId','STRING','VALUE',false),
('ReviewMessage','createdByText','STRING','VALUE',false),
('ReviewMessage','id','STRING','VALUE',false),
('ReviewMessage','message','STRING','VALUE',false),
('ReviewMessage','reviewThreadId','STRING','VALUE',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('ReviewThread',ARRAY['id'],'[{"kind":"QMS_RECORD","field":"qmsRecordId"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ReviewThread','acceptedAt','INSTANT','VALUE',false),
('ReviewThread','acceptedByText','STRING','VALUE',false),
('ReviewThread','authenticatedUserId','STRING','VALUE',false),
('ReviewThread','createdByText','STRING','VALUE',false),
('ReviewThread','fieldLabelSnapshot','STRING','VALUE',false),
('ReviewThread','fieldPath','STRING','VALUE',false),
('ReviewThread','id','STRING','VALUE',false),
('ReviewThread','qmsRecordId','STRING','VALUE',false),
('ReviewThread','recordVersionId','STRING','VALUE',false),
('ReviewThread','resolutionNote','STRING','VALUE',false),
('ReviewThread','resolvedAt','INSTANT','VALUE',false),
('ReviewThread','resolvedByText','STRING','VALUE',false),
('ReviewThread','sectionKey','STRING','VALUE',false),
('ReviewThread','status','STRING','VALUE',false),
('ReviewThread','tabKey','STRING','VALUE',false),
('ReviewThread','targetEntityId','STRING','VALUE',false),
('ReviewThread','targetEntityType','STRING','VALUE',false),
('ReviewThread','targetKind','STRING','VALUE',false),
('ReviewThread','valueSnapshot','STRING','SHA256_JSON',false);
INSERT INTO "AuditCaptureTablePolicy" VALUES ('TemplateVersion',ARRAY['id'],'[{"kind":"ADMINISTRATION","category":"CONFIGURATION"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('TemplateVersion','checksum','STRING','VALUE',true),
('TemplateVersion','documentType','STRING','VALUE',false),
('TemplateVersion','effectiveFrom','DATE','VALUE',false),
('TemplateVersion','effectiveTo','DATE','VALUE',false),
('TemplateVersion','fileName','STRING','VALUE',false),
('TemplateVersion','filePath','STRING','VALUE',false),
('TemplateVersion','fileSize','INTEGER','VALUE',false),
('TemplateVersion','id','STRING','VALUE',false),
('TemplateVersion','isActive','BOOLEAN','VALUE',true),
('TemplateVersion','mimeType','STRING','VALUE',false),
('TemplateVersion','module','STRING','VALUE',false),
('TemplateVersion','versionCode','STRING','VALUE',false);

CREATE FUNCTION covex_b2_entity_key(entity_type TEXT, row_value JSONB) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE keys TEXT[]; result JSONB;
BEGIN
  SELECT "primaryKey" INTO keys FROM public."AuditCaptureTablePolicy" WHERE "entityType"=entity_type;
  IF keys IS NULL OR row_value IS NULL THEN RAISE EXCEPTION 'Capture identity missing'; END IF;
  SELECT jsonb_object_agg(key,row_value->key ORDER BY key) INTO result FROM unnest(keys) key;
  IF EXISTS(SELECT 1 FROM unnest(keys) key WHERE row_value->key IS NULL OR row_value->key='null'::jsonb) THEN RAISE EXCEPTION 'Capture primary key missing'; END IF;
  IF cardinality(keys)=1 THEN RETURN row_value->>keys[1]; END IF;
  RETURN result::text;
END;
$$;

CREATE FUNCTION covex_b2_roots(entity_type TEXT, row_value JSONB, depth INTEGER DEFAULT 0) RETURNS TEXT[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE paths JSONB; path JSONB; parent_value JSONB; parent_keys TEXT[]; result TEXT[]:=ARRAY[]::text[]; cached TEXT[];
BEGIN
  IF row_value IS NULL THEN RETURN result; END IF;
  IF depth>8 THEN RAISE EXCEPTION 'Capture root cycle'; END IF;
  SELECT "rootPaths" INTO paths FROM public."AuditCaptureTablePolicy" WHERE "entityType"=entity_type;
  IF paths IS NULL THEN RAISE EXCEPTION 'Unregistered capture table'; END IF;
  FOR path IN SELECT value FROM jsonb_array_elements(paths) LOOP
    IF path ? 'via' THEN
      IF row_value->>(path->>'via') IS NOT NULL THEN
        SELECT "primaryKey" INTO parent_keys FROM public."AuditCaptureTablePolicy" WHERE "entityType"=path->>'table';
        IF cardinality(parent_keys)<>1 THEN RAISE EXCEPTION 'Unsupported capture parent'; END IF;
        EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE %I::text=$1',path->>'table',parent_keys[1]) INTO parent_value USING row_value->>(path->>'via');
        IF parent_value IS NOT NULL THEN result:=result||public.covex_b2_roots(path->>'table',parent_value,depth+1);
        ELSE
          SELECT roots INTO cached FROM public."AuditRootBinding" WHERE "transactionId"=txid_current() AND "entityType"=path->>'table'
            AND "entityKey"=row_value->>(path->>'via');
          IF cached IS NULL THEN RAISE EXCEPTION 'Capture parent/root missing'; END IF;
          result:=result||cached;
        END IF;
      END IF;
    ELSIF path->>'kind'='ADMINISTRATION' THEN result:=array_append(result,'ADMINISTRATION:'||(path->>'category'));
    ELSIF row_value->>(path->>'field') IS NOT NULL THEN result:=array_append(result,(path->>'kind')||':'||(row_value->>(path->>'field')));
    END IF;
  END LOOP;
  SELECT coalesce(array_agg(DISTINCT key ORDER BY key),ARRAY[]::text[]) INTO result FROM unnest(result) key;
  RETURN result;
END;
$$;

CREATE FUNCTION covex_b2_typed(row_value JSONB, field_name TEXT, value_type TEXT, transform TEXT) RETURNS JSONB
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE value JSONB; scalar TEXT;
BEGIN
  IF row_value IS NULL OR NOT(row_value ? field_name) THEN RETURN '{"present":false,"type":"ABSENT"}'::jsonb; END IF;
  value:=row_value->field_name;
  IF value='null'::jsonb THEN RETURN '{"present":true,"type":"NULL","value":null}'::jsonb; END IF;
  IF transform='SHA256_JSON' THEN value:=to_jsonb(encode(sha256(convert_to(value::text,'UTF8')),'hex'));
  ELSIF value_type NOT IN ('BOOLEAN','JSON') THEN
    scalar:=row_value->>field_name;
    IF value_type='INSTANT' THEN scalar:=to_char(scalar::timestamptz AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'); END IF;
    value:=to_jsonb(scalar);
  END IF;
  RETURN jsonb_build_object('present',true,'type',value_type,'value',value);
END;
$$;

CREATE FUNCTION covex_b2_changes(entity_type TEXT, before_value JSONB, after_value JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE field public."AuditCaptureFieldPolicy"; before_typed JSONB; after_typed JSONB; result JSONB:='[]'::jsonb;
BEGIN
  IF before_value IS NULL AND EXISTS(SELECT 1 FROM public."AuditCaptureTablePolicy" WHERE "entityType"=entity_type AND "captureMode"='EVIDENCE') THEN RETURN result; END IF;
  FOR field IN SELECT * FROM public."AuditCaptureFieldPolicy" WHERE "entityType"=entity_type ORDER BY "fieldPath" LOOP
    before_typed:=public.covex_b2_typed(before_value,field."fieldPath",field."valueType",field.transform);
    after_typed:=public.covex_b2_typed(after_value,field."fieldPath",field."valueType",field.transform);
    IF before_typed IS DISTINCT FROM after_typed THEN result:=result||jsonb_build_array(jsonb_build_object(
      'fieldPath',field."fieldPath"||CASE WHEN field.transform='SHA256_JSON' THEN '.$sha256' ELSE '' END,'oldValue',before_typed,'newValue',after_typed)); END IF;
  END LOOP;
  RETURN result;
END;
$$;

CREATE FUNCTION covex_b2_permission(actor_id UUID, access_module TEXT, access_permission TEXT, resource_id TEXT, departments TEXT[]) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public."AuthUser" WHERE id=actor_id AND active AND "authorizedAt" IS NOT NULL) OR NOT EXISTS (
    SELECT 1 FROM public."AuthRolePermission" p JOIN public."AuthRole" r ON r.id=p."roleId" JOIN public."AuthUserRole" u ON u."roleId"=r.id
    WHERE u."userId"=actor_id AND r."qaAcceptedAt" IS NOT NULL AND p.module::text=access_module AND p.permission::text=access_permission AND
    (p.scope='ALL' OR p.scope='ASSIGNED' AND access_permission NOT IN ('EXPORT','IMPORT','MANAGE_USERS','MANAGE_CONFIGURATION') AND (
      EXISTS(SELECT 1 FROM public."AuthRecordAssignment" a WHERE a."userId"=actor_id AND a.module::text=access_module AND a."recordId"::text=resource_id) OR
      cardinality(departments)>0 AND NOT EXISTS(SELECT 1 FROM unnest(departments) department WHERE NOT EXISTS(
        SELECT 1 FROM public."AuthUserDepartment" d WHERE d."userId"=actor_id AND d."departmentId"=department))))
  ) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Current business authorization required'; END IF;
END;
$$;

CREATE FUNCTION covex_b2_authorize_root(actor_id UUID, access_module TEXT, access_permission TEXT, root_key TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE kind TEXT:=split_part(root_key,':',1); identifier TEXT:=substring(root_key FROM position(':' IN root_key)+1);
  module TEXT; departments TEXT[]:=ARRAY[]::text[]; domain_table TEXT;
BEGIN
  IF kind='QMS_RECORD' THEN
    SELECT "recordType"::text INTO module FROM public."QmsRecord" WHERE id=identifier;
    domain_table:=CASE module WHEN 'DEVIATION' THEN 'Deviation' WHEN 'CAPA' THEN 'Capa' WHEN 'CHANGE_CONTROL' THEN 'ChangeControl' WHEN 'COMPLAINT' THEN 'Complaint' WHEN 'RETURN' THEN 'ReturnRecord' WHEN 'AUDIT' THEN 'Audit' END;
    IF domain_table IS NULL THEN RAISE EXCEPTION 'Business root missing'; END IF;
    IF module='AUDIT' THEN SELECT coalesce(array_agg(d."departmentId" ORDER BY d."departmentId"),ARRAY[]::text[]) INTO departments FROM public."AuditDepartment" d JOIN public."Audit" a ON a.id=d."auditId" WHERE a."qmsRecordId"=identifier AND d."isActive";
    ELSE EXECUTE format('SELECT array_remove(ARRAY["departmentId"],NULL) FROM public.%I WHERE "qmsRecordId"=$1',domain_table) INTO departments USING identifier;
    END IF;
  ELSIF kind='PNT' THEN
    module:='PNT'; SELECT array_remove(ARRAY["departmentId"],NULL) INTO departments FROM public."ControlledDocument" WHERE id=identifier;
    IF NOT FOUND THEN RAISE EXCEPTION 'Controlled root missing'; END IF;
  ELSIF kind='AUDIT_PLAN' THEN
    module:='AUDIT'; IF NOT EXISTS(SELECT 1 FROM public."AuditAnnualPlan" WHERE id=identifier) THEN RAISE EXCEPTION 'Plan root missing'; END IF;
  ELSIF kind='ADMINISTRATION' THEN
    IF identifier='AUTHORIZATION' THEN module:='SYSTEM'; IF access_permission<>'MANAGE_USERS' THEN RAISE EXCEPTION 'Administrative operation mismatch'; END IF;
    ELSIF identifier='CONFIGURATION' THEN module:=access_module; IF access_permission<>'MANAGE_CONFIGURATION' THEN RAISE EXCEPTION 'Configuration operation mismatch'; END IF;
    ELSIF identifier='PNT_IMPORT' THEN module:='PNT'; IF access_permission<>'IMPORT' THEN RAISE EXCEPTION 'Import operation mismatch'; END IF;
    ELSIF identifier='HISTORICAL_IMPORT' THEN module:=access_module; IF access_permission<>'IMPORT' THEN RAISE EXCEPTION 'Historical operation mismatch'; END IF;
    ELSE RAISE EXCEPTION 'Administrative root refused'; END IF;
    identifier:=NULL;
  ELSE RAISE EXCEPTION 'Root kind refused'; END IF;
  PERFORM public.covex_b2_permission(actor_id,module,CASE WHEN module=access_module THEN access_permission ELSE 'EDIT' END,identifier,coalesce(departments,ARRAY[]::text[]));
END;
$$;

CREATE FUNCTION covex_b2_begin(actor_id UUID, request_id UUID, request_digest TEXT, operation_code TEXT, access_module TEXT, access_permission TEXT, operation_reason TEXT)
RETURNS TABLE(operation_id UUID,replayed BOOLEAN) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE previous public."AuditOperation"; actor_name TEXT; target RECORD;
BEGIN
  -- Deliberate preparation boundary, not a deploy-time/HTTP feature flag.
  IF current_database() !~ '^covex_phase4b1_test_[a-z0-9_]+$' THEN RAISE EXCEPTION 'Complete corporate policy is not prepared and active'; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND (rolsuper OR rolcreaterole)) OR has_schema_privilege(session_user,'public','CREATE') OR EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('AuditOperation','AuditEvent','AuditBusinessContext','AuditMutationWitness','AuditCaptureTablePolicy','AuditCaptureFieldPolicy','AuditRootBinding','AuditAdministrationRoot','AuditEventAdditionalTarget','AuditAggregateCursor','AuditOperationTarget','AuditRuntimeContext','AuditPolicyRequirement','AuditOperationEvidence') AND
    (pg_has_role(session_user,c.relowner,'USAGE') OR has_table_privilege(session_user,c.oid,'DELETE,TRUNCATE') OR has_any_column_privilege(session_user,c.oid,'INSERT') OR has_any_column_privilege(session_user,c.oid,'UPDATE'))
  ) THEN RAISE EXCEPTION 'Separate minimal application role required'; END IF;
  IF EXISTS(SELECT 1 FROM public."AuditBusinessContext" WHERE "transactionId"=txid_current()) OR EXISTS(SELECT 1 FROM public."AuditRuntimeContext" WHERE "transactionId"=txid_current()) THEN RAISE EXCEPTION 'Nested business operation refused'; END IF;
  IF actor_id IS NULL OR request_id IS NULL OR request_digest IS NULL OR request_digest !~ '^[a-f0-9]{64}$' OR operation_code IS NULL OR operation_code !~ '^(DV0[1-8]|CA0[1-8]|CC0[1-7]|RC0[1-7]|DE0[1-7]|AU0[1-9]|PN0[1-6]|TR0[1-57])$' OR
    access_module IS NULL OR NOT EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='AccessModule' AND e.enumlabel=access_module) OR
    access_permission IS NULL OR access_permission IN ('READ','DOWNLOAD','EXPORT') OR NOT EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='AccessPermission' AND e.enumlabel=access_permission) OR
    operation_reason IS NOT NULL AND length(btrim(operation_reason)) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid business command'; END IF;
  IF substring(operation_code FROM 1 FOR 2)<>'TR' AND access_module<>(CASE substring(operation_code FROM 1 FOR 2)
    WHEN 'DV' THEN 'DEVIATION' WHEN 'CA' THEN 'CAPA' WHEN 'CC' THEN 'CHANGE_CONTROL' WHEN 'RC' THEN 'COMPLAINT' WHEN 'DE' THEN 'RETURN' WHEN 'AU' THEN 'AUDIT' WHEN 'PN' THEN 'PNT' END) THEN RAISE EXCEPTION 'Policy module mismatch'; END IF;
  SELECT "displayName" INTO actor_name FROM public."AuthUser" WHERE id=actor_id AND active AND "authorizedAt" IS NOT NULL FOR SHARE;
  IF actor_name IS NULL THEN RAISE EXCEPTION 'Active admitted actor required'; END IF;
  -- Scope is resolved from persisted roots at commit, never a client claim.
  IF NOT EXISTS(SELECT 1 FROM public."AuthRolePermission" p JOIN public."AuthRole" r ON r.id=p."roleId" JOIN public."AuthUserRole" u ON u."roleId"=r.id WHERE u."userId"=actor_id AND r."qaAcceptedAt" IS NOT NULL AND p.module::text=access_module AND p.permission::text=access_permission) THEN RAISE EXCEPTION 'Business grant required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('COVEX-B2:'||actor_id::text||':'||request_id::text,0));
  SELECT * INTO previous FROM public."AuditOperation" WHERE "actorUserId"=actor_id AND origin='QMS_SERVER' AND "requestId"=request_id;
  IF FOUND THEN
    IF previous."requestDigest"<>request_digest OR previous.operation<>operation_code OR previous."accessModule"<>access_module OR previous."accessPermission"<>access_permission THEN RAISE EXCEPTION 'Business request conflict'; END IF;
    FOR target IN SELECT "rootKey" FROM public."AuditOperationTarget" WHERE "operationId"=previous.id ORDER BY "rootKey" LOOP
      PERFORM public.covex_b2_authorize_root(actor_id,access_module,access_permission,target."rootKey");
    END LOOP;
    RETURN QUERY SELECT previous.id,true; RETURN;
  END IF;
  INSERT INTO public."AuditBusinessContext" VALUES(txid_current(),pg_backend_pid(),session_user,actor_id,actor_name,request_id,request_digest,operation_code,access_module,access_permission,operation_reason,NULL);
  RETURN QUERY SELECT NULL::uuid,false;
END;
$$;

CREATE FUNCTION covex_b2_before(entity_type TEXT, verb TEXT, before_value JSONB, after_value JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE context public."AuditBusinessContext"; roots TEXT[]; entity_key TEXT; critical_change BOOLEAN; draft BOOLEAN:=false; root TEXT; parent_status TEXT; domain_table TEXT;
BEGIN
  SELECT * INTO context FROM public."AuditBusinessContext" WHERE "transactionId"=txid_current() AND "backendPid"=pg_backend_pid() AND "databasePrincipal"=session_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Private business context required'; END IF;
  IF after_value->'fileData' IS NOT NULL AND after_value->'fileData'<>'null'::jsonb THEN
    IF coalesce(after_value->>'checksum',after_value->>'sha256') IS DISTINCT FROM encode(sha256((after_value->>'fileData')::bytea),'hex') THEN RAISE EXCEPTION 'Original document checksum mismatch'; END IF;
  END IF;
  -- While D05 supersession is unfinished, an audited operation must not destroy
  -- an existing original. Unrequired legacy behavior is not changed by install.
  IF before_value->'fileData' IS NOT NULL AND before_value->'fileData'<>'null'::jsonb AND before_value->'fileData' IS DISTINCT FROM after_value->'fileData' THEN RAISE EXCEPTION 'Original documentary supersession is not yet available'; END IF;
  IF verb<>'INSERT' AND EXISTS(SELECT 1 FROM public."AuditCaptureTablePolicy" WHERE "entityType"=entity_type AND "captureMode"='EVIDENCE') THEN RAISE EXCEPTION 'Existing operational evidence is immutable in audited scope'; END IF;
  entity_key:=public.covex_b2_entity_key(entity_type,coalesce(before_value,after_value));
  IF verb='UPDATE' AND entity_key<>public.covex_b2_entity_key(entity_type,after_value) THEN RAISE EXCEPTION 'Business primary key is immutable'; END IF;
  roots:=public.covex_b2_roots(entity_type,before_value)||public.covex_b2_roots(entity_type,after_value);
  SELECT coalesce(array_agg(DISTINCT key ORDER BY key),ARRAY[]::text[]) INTO roots FROM unnest(roots) key;
  IF cardinality(roots)=0 THEN RAISE EXCEPTION 'Business roots required'; END IF;
  INSERT INTO public."AuditRootBinding" VALUES(txid_current(),entity_type,entity_key,roots) ON CONFLICT("transactionId","entityType","entityKey") DO UPDATE SET roots=EXCLUDED.roots;
  IF verb='UPDATE' THEN
    draft:=before_value->>'status'='DRAFT' OR before_value->>'administrativeStatus'='DRAFT';
    IF draft IS NULL THEN draft:=false; END IF;
    IF entity_type='FormFieldConfig' THEN SELECT status='DRAFT' INTO draft FROM public."FormVersion" WHERE id=before_value->>'formVersionId'; END IF;
    FOR root IN SELECT key FROM unnest(roots) key WHERE key LIKE 'QMS_RECORD:%' LOOP
      SELECT CASE "recordType" WHEN 'DEVIATION' THEN 'Deviation' WHEN 'CAPA' THEN 'Capa' WHEN 'CHANGE_CONTROL' THEN 'ChangeControl' WHEN 'COMPLAINT' THEN 'Complaint' WHEN 'RETURN' THEN 'ReturnRecord' WHEN 'AUDIT' THEN 'Audit' END INTO domain_table FROM public."QmsRecord" WHERE id=substring(root FROM 12);
      IF domain_table IS NOT NULL THEN
        EXECUTE format('SELECT to_jsonb(t)->>''status'' FROM public.%I t WHERE "qmsRecordId"=$1',domain_table) INTO parent_status USING substring(root FROM 12);
        draft:=draft OR parent_status='DRAFT';
      END IF;
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public."AuditCaptureFieldPolicy" p WHERE p."entityType"=entity_type AND p.critical AND (entity_type<>'AppParameter' OR before_value->>'key'='ALLOW_CLOSED_RECORD_EDIT') AND before_value->p."fieldPath" IS DISTINCT FROM after_value->p."fieldPath" AND
      before_value->p."fieldPath" IS NOT NULL AND before_value->p."fieldPath"<>'null'::jsonb AND coalesce(before_value->>p."fieldPath",'') NOT IN ('','UNKNOWN','PENDING','NOT_ASSESSED','NOT_EVALUATED','UNDETERMINED','UNVERIFIED')) INTO critical_change;
    IF critical_change AND NOT coalesce(draft,false) AND context.reason IS NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Reason required for established critical correction'; END IF;
    IF entity_type IN ('FormVersion','TemplateVersion') AND before_value->'isActive' IS DISTINCT FROM after_value->'isActive' AND context.reason IS NULL THEN RAISE EXCEPTION 'Reason required for official version activation/retirement'; END IF;
  END IF;
  INSERT INTO public."AuditMutationWitness" VALUES(gen_random_uuid(),txid_current(),entity_type,entity_key,verb,roots,NULL,false);
END;
$$;

CREATE FUNCTION covex_b2_ensure_operation(roots TEXT[]) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE context public."AuditBusinessContext"; result UUID; root TEXT; kind TEXT; identifier TEXT; sequence BIGINT;
BEGIN
  SELECT * INTO context FROM public."AuditBusinessContext" WHERE "transactionId"=txid_current() AND "backendPid"=pg_backend_pid() AND "databasePrincipal"=session_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Business lease missing'; END IF;
  result:=context."operationId";
  IF result IS NULL THEN
    result:=gen_random_uuid();
    INSERT INTO public."AuditOperation" VALUES(result,context."actorUserId",context."actorName",'QMS_SERVER',context."operationCode",context."requestId",context."requestDigest",context.reason,'QMS_B2_ENGINE_V1',2,clock_timestamp(),session_user,context."accessModule",context."accessPermission");
    UPDATE public."AuditBusinessContext" SET "operationId"=result WHERE "transactionId"=txid_current();
    INSERT INTO public."AuditRuntimeContext" VALUES(result,txid_current(),pg_backend_pid(),session_user);
    PERFORM set_config('covex.audit.operation_id',result::text,true);
  END IF;
  FOR root IN SELECT DISTINCT key FROM unnest(roots) key ORDER BY key LOOP
    IF EXISTS(SELECT 1 FROM public."AuditOperationTarget" WHERE "operationId"=result AND "rootKey"=root) THEN CONTINUE; END IF;
    kind:=split_part(root,':',1); identifier:=substring(root FROM position(':' IN root)+1);
    IF kind='ADMINISTRATION' THEN INSERT INTO public."AuditAdministrationRoot"(id,category) VALUES(identifier,identifier) ON CONFLICT(id) DO NOTHING; END IF;
    INSERT INTO public."AuditAggregateCursor"("rootKey","rootKind","qmsRecordId","controlledDocumentId","auditAnnualPlanId","administrationRootId")
      VALUES(root,kind,CASE WHEN kind='QMS_RECORD' THEN identifier END,CASE WHEN kind='PNT' THEN identifier END,CASE WHEN kind='AUDIT_PLAN' THEN identifier END,CASE WHEN kind='ADMINISTRATION' THEN identifier END) ON CONFLICT("rootKey") DO NOTHING;
    UPDATE public."AuditAggregateCursor" SET "lastSequence"="lastSequence"+1 WHERE "rootKey"=root RETURNING "lastSequence" INTO sequence;
    INSERT INTO public."AuditOperationTarget" VALUES(result,root,sequence);
  END LOOP;
  RETURN result;
END;
$$;

CREATE FUNCTION covex_b2_capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE witness public."AuditMutationWitness"; before_value JSONB; after_value JSONB; changes JSONB; change JSONB; roots TEXT[]; operation_id UUID; event_id UUID; ordinal INTEGER; root TEXT;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public."AuditBusinessContext" WHERE "transactionId"=txid_current() AND "backendPid"=pg_backend_pid() AND "databasePrincipal"=session_user) THEN RETURN NULL; END IF;
  before_value:=CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END; after_value:=CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END;
  SELECT * INTO witness FROM public."AuditMutationWitness" WHERE "transactionId"=txid_current() AND "entityType"=TG_TABLE_NAME AND "entityKey"=public.covex_b2_entity_key(TG_TABLE_NAME,coalesce(before_value,after_value)) AND NOT completed;
  IF NOT FOUND THEN RAISE EXCEPTION 'Independent mutation witness missing'; END IF;
  changes:=public.covex_b2_changes(TG_TABLE_NAME,before_value,after_value);
  IF jsonb_array_length(changes)=0 THEN RETURN NULL; END IF;
  SELECT array_agg(DISTINCT key ORDER BY key) INTO roots FROM unnest(witness."beforeRoots"||public.covex_b2_roots(TG_TABLE_NAME,after_value)) key;
  operation_id:=public.covex_b2_ensure_operation(roots);
  SELECT coalesce(max("eventOrdinal"),0) INTO ordinal FROM public."AuditEvent" WHERE "operationId"=operation_id;
  FOR change IN SELECT value FROM jsonb_array_elements(changes) LOOP
    event_id:=gen_random_uuid(); ordinal:=ordinal+1;
    INSERT INTO public."AuditEvent"("id","operationId","rootKey","eventOrdinal","entityType","entityId","fieldPath","oldValue","newValue","mutationId","recordVersionId","generatedDocumentId","documentChecksum")
      VALUES(event_id,operation_id,roots[1],ordinal,TG_TABLE_NAME,witness."entityKey",change->>'fieldPath',change->'oldValue',change->'newValue',witness.id,
        CASE WHEN TG_OP<>'DELETE' AND TG_TABLE_NAME='QmsRecordVersion' THEN after_value->>'id' END,
        CASE WHEN TG_OP<>'DELETE' AND TG_TABLE_NAME='GeneratedDocument' AND after_value->>'checksum' ~ '^[a-f0-9]{64}$' THEN after_value->>'id' END,
        CASE WHEN TG_OP<>'DELETE' AND TG_TABLE_NAME='GeneratedDocument' AND after_value->>'checksum' ~ '^[a-f0-9]{64}$' THEN after_value->>'checksum' END);
    FOREACH root IN ARRAY roots[2:cardinality(roots)] LOOP
      INSERT INTO public."AuditEventAdditionalTarget" VALUES(event_id,operation_id,root);
    END LOOP;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE FUNCTION covex_b2_witness() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE before_value JSONB; after_value JSONB; roots TEXT[]; expected_values JSONB; witness public."AuditMutationWitness";
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public."AuditBusinessContext" WHERE "transactionId"=txid_current() AND "backendPid"=pg_backend_pid() AND "databasePrincipal"=session_user) THEN RETURN NULL; END IF;
  before_value:=CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END; after_value:=CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END;
  SELECT * INTO witness FROM public."AuditMutationWitness" WHERE "transactionId"=txid_current() AND "entityType"=TG_TABLE_NAME AND "entityKey"=public.covex_b2_entity_key(TG_TABLE_NAME,coalesce(before_value,after_value)) AND NOT completed;
  IF NOT FOUND THEN RAISE EXCEPTION 'Before mutation witness missing'; END IF;
  SELECT array_agg(DISTINCT key ORDER BY key) INTO roots FROM unnest(witness."beforeRoots"||public.covex_b2_roots(TG_TABLE_NAME,after_value)) key;
  SELECT coalesce(jsonb_agg(value||jsonb_build_object('roots',to_jsonb(roots)) ORDER BY value->>'fieldPath'),'[]'::jsonb) INTO expected_values FROM jsonb_array_elements(public.covex_b2_changes(TG_TABLE_NAME,before_value,after_value));
  UPDATE public."AuditMutationWitness" SET expected=expected_values,completed=true WHERE id=witness.id;
  RETURN NULL;
END;
$$;

CREATE FUNCTION covex_b2_finish() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE context public."AuditBusinessContext"; witness public."AuditMutationWitness"; actual JSONB; count_events INTEGER; target RECORD; root TEXT;
BEGIN
  SELECT * INTO context FROM public."AuditBusinessContext" WHERE "transactionId"=NEW."transactionId";
  IF NOT FOUND OR context."transactionId"<>txid_current() OR context."backendPid"<>pg_backend_pid() OR context."databasePrincipal"<>session_user THEN RAISE EXCEPTION 'Business context lost'; END IF;
  FOR witness IN SELECT * FROM public."AuditMutationWitness" WHERE "transactionId"=context."transactionId" LOOP
    IF NOT witness.completed OR witness.expected IS NULL THEN RAISE EXCEPTION 'Independent capture witness incomplete'; END IF;
    -- A no-op still requires the actual write scope, even though no business
    -- event/sequence is emitted. Technical timestamps are not an access bypass.
    FOREACH root IN ARRAY witness."beforeRoots" LOOP
      PERFORM public.covex_b2_authorize_root(context."actorUserId",context."accessModule",context."accessPermission",root);
    END LOOP;
    SELECT coalesce(jsonb_agg(jsonb_build_object('fieldPath',e."fieldPath",'oldValue',e."oldValue",'newValue',e."newValue",'roots',
      (SELECT jsonb_agg(key ORDER BY key) FROM (SELECT e."rootKey" AS key UNION ALL SELECT a."rootKey" FROM public."AuditEventAdditionalTarget" a WHERE a."eventId"=e.id) r)) ORDER BY e."fieldPath"),'[]'::jsonb)
      INTO actual FROM public."AuditEvent" e WHERE e."mutationId"=witness.id AND e."operationId"=context."operationId" AND e."entityType"=witness."entityType" AND e."entityId"=witness."entityKey";
    IF actual IS DISTINCT FROM witness.expected THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Mandatory OLD/NEW capture mismatch'; END IF;
  END LOOP;
  IF context."operationId" IS NOT NULL THEN
    SELECT count(*) INTO count_events FROM public."AuditEvent" WHERE "operationId"=context."operationId";
    IF count_events=0 OR count_events<>(SELECT coalesce(sum(jsonb_array_length(expected)),0) FROM public."AuditMutationWitness" WHERE "transactionId"=context."transactionId") OR
      (SELECT max("eventOrdinal") FROM public."AuditEvent" WHERE "operationId"=context."operationId")<>count_events OR
      EXISTS(SELECT 1 FROM public."AuditEvent" e WHERE e."operationId"=context."operationId" AND NOT EXISTS(SELECT 1 FROM public."AuditMutationWitness" w WHERE w.id=e."mutationId" AND w."transactionId"=context."transactionId")) THEN RAISE EXCEPTION 'Business capture coverage missing'; END IF;
    IF public.covex_audit_context()<>context."operationId" THEN RAISE EXCEPTION 'Business operation lease lost'; END IF;
    FOR target IN SELECT "rootKey" FROM public."AuditOperationTarget" WHERE "operationId"=context."operationId" ORDER BY "rootKey" LOOP
      PERFORM public.covex_b2_authorize_root(context."actorUserId",context."accessModule",context."accessPermission",target."rootKey");
    END LOOP;
    -- Keep source snapshots/history once, through actual typed foreign keys.
    FOR witness IN SELECT w.* FROM public."AuditMutationWitness" w JOIN public."AuditCaptureTablePolicy" p ON p."entityType"=w."entityType" WHERE w."transactionId"=context."transactionId" AND p."captureMode"='EVIDENCE' AND w.verb='INSERT' LOOP
      INSERT INTO public."AuditOperationEvidence" VALUES(gen_random_uuid(),context."operationId",
        CASE WHEN witness."entityType"='ChangeHistory' THEN witness."entityKey" END,
        CASE WHEN witness."entityType"='ConfigurationChange' THEN witness."entityKey" END,
        CASE WHEN witness."entityType"='AuthAuthorizationChange' THEN witness."entityKey"::uuid END,
        CASE WHEN witness."entityType"='AuditPlanChange' THEN witness."entityKey" END,
        CASE WHEN witness."entityType"='ControlledDocumentChange' THEN witness."entityKey" END);
    END LOOP;
    DELETE FROM public."AuditRuntimeContext" WHERE "operationId"=context."operationId";
  END IF;
  DELETE FROM public."AuditMutationWitness" WHERE "transactionId"=context."transactionId";
  DELETE FROM public."AuditRootBinding" WHERE "transactionId"=context."transactionId";
  DELETE FROM public."AuditBusinessContext" WHERE "transactionId"=context."transactionId";
  RETURN NULL;
END;
$$;

CREATE FUNCTION covex_b2_link_target() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW."operationId"<>public.covex_audit_context() OR NOT EXISTS(SELECT 1 FROM public."AuditEvent" WHERE id=NEW."eventId" AND "operationId"=NEW."operationId" AND "rootKey"<>NEW."rootKey") THEN RAISE EXCEPTION 'Additional event target mismatch'; END IF;
  RETURN NEW;
END;
$$;
CREATE FUNCTION covex_b2_evidence_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE entity_type TEXT; entity_key TEXT;
BEGIN
  entity_type:=CASE WHEN NEW."changeHistoryId" IS NOT NULL THEN 'ChangeHistory' WHEN NEW."configurationChangeId" IS NOT NULL THEN 'ConfigurationChange' WHEN NEW."authorizationChangeId" IS NOT NULL THEN 'AuthAuthorizationChange' WHEN NEW."auditPlanChangeId" IS NOT NULL THEN 'AuditPlanChange' WHEN NEW."controlledDocumentChangeId" IS NOT NULL THEN 'ControlledDocumentChange' END;
  entity_key:=coalesce(NEW."changeHistoryId",NEW."configurationChangeId",NEW."authorizationChangeId"::text,NEW."auditPlanChangeId",NEW."controlledDocumentChangeId");
  IF NEW."operationId"<>public.covex_audit_context() OR NOT EXISTS(
    SELECT 1 FROM public."AuditMutationWitness" w JOIN public."AuditOperationTarget" t ON t."operationId"=NEW."operationId" AND t."rootKey"=ANY(w."beforeRoots") WHERE w."transactionId"=txid_current() AND w."entityType"=entity_type AND w."entityKey"=entity_key AND w.verb='INSERT' AND w.completed
  ) THEN RAISE EXCEPTION 'Typed operational evidence ownership missing'; END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER audit_b2_business_coverage AFTER INSERT ON "AuditBusinessContext" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION covex_b2_finish();
CREATE TRIGGER audit_b2_additional_target_guard BEFORE INSERT ON "AuditEventAdditionalTarget" FOR EACH ROW EXECUTE FUNCTION covex_b2_link_target();
CREATE TRIGGER audit_b2_evidence_guard BEFORE INSERT ON "AuditOperationEvidence" FOR EACH ROW EXECUTE FUNCTION covex_b2_evidence_guard();

-- ENGINE_REPLACEMENTS: additive replacements preserve the B1 branch exactly.
CREATE OR REPLACE FUNCTION covex_audit_value_valid(value JSONB) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public AS $$
DECLARE kind TEXT;
BEGIN
  IF value IS NULL OR jsonb_typeof(value)<>'object' THEN RETURN false; END IF;
  kind:=value->>'type';
  IF kind='ABSENT' THEN RETURN value='{"present":false,"type":"ABSENT"}'::jsonb; END IF;
  IF (value-'present'-'type'-'value')<>'{}'::jsonb OR value->'present' IS DISTINCT FROM 'true'::jsonb OR NOT(value ? 'value') THEN RETURN false; END IF;
  IF kind='NULL' THEN RETURN value->'value'='null'::jsonb; END IF;
  IF kind='BOOLEAN' THEN RETURN jsonb_typeof(value->'value')='boolean'; END IF;
  IF kind='JSON' THEN RETURN true; END IF;
  IF jsonb_typeof(value->'value')<>'string' THEN RETURN false; END IF;
  IF kind='STRING' THEN RETURN true; END IF;
  IF kind='INTEGER' THEN RETURN (value->>'value') ~ '^-?(0|[1-9][0-9]*)$'; END IF;
  IF kind='DECIMAL' THEN RETURN (value->>'value') ~ '^-?(0|[1-9][0-9]*)(\.[0-9]+)?$'; END IF;
  IF kind='DATE' THEN RETURN (value->>'value') ~ '^\d{4}-\d{2}-\d{2}$' AND (value->>'value')::date::text=value->>'value'; END IF;
  IF kind='INSTANT' THEN RETURN (value->>'value') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.[0-9]{1,6})?Z$' AND (value->>'value')::timestamptz IS NOT NULL; END IF;
  RETURN false;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE OR REPLACE FUNCTION covex_audit_require_events() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE targets INTEGER; events INTEGER;
BEGIN
  -- General B2 coverage is independently enforced by the private command lease.
  IF NEW."policyVersion"='QMS_B2_ENGINE_V1' THEN RETURN NULL; END IF;
  SELECT count(*) INTO targets FROM public."AuditOperationTarget" WHERE "operationId"=NEW.id;
  SELECT count(*) INTO events FROM public."AuditEvent" WHERE "operationId"=NEW.id;
  IF targets=0 OR events<>targets*2 OR
     EXISTS(SELECT 1 FROM public."AuditOperationTarget" t WHERE t."operationId"=NEW.id AND
       (SELECT count(*) FROM public."AuditEvent" e WHERE e."operationId"=t."operationId" AND e."rootKey"=t."rootKey" AND e."entityId"=substring(t."rootKey" FROM 12) AND e."entityType"='AuditPilotRecord' AND e."fieldPath" IN ('value','revision'))<>2) OR
     (SELECT count(DISTINCT "eventOrdinal") FROM public."AuditEvent" WHERE "operationId"=NEW.id)<>events OR
     (SELECT max("eventOrdinal") FROM public."AuditEvent" WHERE "operationId"=NEW.id)<>events THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Mandatory audit capture missing';
  END IF;
  IF public.covex_audit_context()<>NEW.id THEN RAISE EXCEPTION 'Audit lease mismatch'; END IF;
  DELETE FROM public."AuditRuntimeContext" WHERE "operationId"=NEW.id;
  RETURN NULL;
END;
$$;
CREATE OR REPLACE FUNCTION covex_b2_required_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE operation_id UUID;
BEGIN
  IF current_database() ~ '^covex_phase4b1_test_[a-z0-9_]+$' AND EXISTS(
    SELECT 1 FROM public."AuditBusinessContext" WHERE "transactionId"=txid_current() AND "backendPid"=pg_backend_pid() AND "databasePrincipal"=session_user) THEN
    PERFORM public.covex_b2_before(TG_TABLE_NAME,TG_OP,CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END,CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END);
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public."AuditPolicyRequirement" WHERE "policyVersion"='QMS_B2_V1') THEN
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  -- Corporate profile discovery/refresh is technical; admission/disable is not.
  IF TG_TABLE_NAME='AuthUser' THEN
    IF TG_OP='INSERT' AND NEW."authorizedAt" IS NULL THEN RETURN NEW; END IF;
    IF TG_OP='UPDATE' AND NEW.active IS NOT DISTINCT FROM OLD.active AND NEW."authorizedAt" IS NOT DISTINCT FROM OLD."authorizedAt" THEN RETURN NEW; END IF;
    IF TG_OP='DELETE' AND OLD."authorizedAt" IS NULL THEN RETURN OLD; END IF;
  END IF;
  -- A failed import marker does not report a successful GMP mutation.
  IF TG_TABLE_NAME='ControlledDocumentImportEvent' THEN
    IF TG_OP='INSERT' AND NEW.action='ERROR' AND NEW.detail='{"category":"CONFIRMATION_REJECTED_OR_ROLLED_BACK"}'::jsonb THEN RETURN NEW; END IF;
  END IF;
  -- Keep the isolated B1 pilot operational without admitting business writes.
  IF TG_TABLE_NAME='ChangeHistory' THEN
    IF TG_OP='INSERT' AND NEW."fieldPath"='__synthetic_audit_pilot__' AND current_database() ~ '^covex_phase4b1_test_[a-z0-9_]+$' THEN
      operation_id:=public.covex_audit_context();
      IF EXISTS(SELECT 1 FROM public."AuditOperation" o JOIN public."AuditOperationTarget" t ON t."operationId"=o.id
        WHERE o.id=operation_id AND o.origin='SYNTHETIC_PILOT' AND o."policyVersion"='SYNTHETIC_PILOT_V1' AND t."rootKey"='QMS_RECORD:'||NEW."qmsRecordId") THEN RETURN NEW; END IF;
    END IF;
  END IF;
  -- A later complete B2 policy must explicitly replace this preparation guard.
  -- There is no flag/GUC/context-only escape and no partially active GMP policy.
  RAISE EXCEPTION USING ERRCODE='P4001',MESSAGE='Required business audit policy is not prepared and active';
END;
$$;
-- ENGINE_TRIGGERS_AND_GRANTS: generated hooks and explicit non-public grants.
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "AlertRule" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "AlertRule" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "AppParameter" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "AppParameter" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "Audit" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "Audit" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "AuditAnnualPlan" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "AuditAnnualPlan" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "AuditAnnualProgrammeVersion" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "AuditAnnualProgrammeVersion" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "AuditDepartment" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "AuditDepartment" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "AuditFinding" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "AuditFinding" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "AuditFindingAction" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "AuditFindingAction" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "AuditFindingRelation" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "AuditFindingRelation" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "AuditFollowup" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "AuditFollowup" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "AuditParticipant" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "AuditParticipant" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "AuditPlanChange" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "AuditPlanChange" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "AuditPlanEntry" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "AuditPlanEntry" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "AuthAuthorizationChange" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "AuthAuthorizationChange" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "AuthRecordAssignment" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "AuthRecordAssignment" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "AuthRole" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "AuthRole" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "AuthRolePermission" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "AuthRolePermission" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "AuthUser" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "AuthUser" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "AuthUserDepartment" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "AuthUserDepartment" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "AuthUserRole" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "AuthUserRole" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "Capa" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "Capa" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "CapaActionFollowup" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "CapaActionFollowup" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "CapaFollowup" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "CapaFollowup" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "CapaPlannedAction" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "CapaPlannedAction" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ChangeControl" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ChangeControl" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ChangeControlFollowup" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ChangeControlFollowup" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ChangeControlTask" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ChangeControlTask" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ChangeControlTaskState" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ChangeControlTaskState" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ChangeHistory" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ChangeHistory" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "Complaint" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "Complaint" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ComplaintCapaPlan" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ComplaintCapaPlan" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ComplaintDerivedAction" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ComplaintDerivedAction" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ComplaintFollowup" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ComplaintFollowup" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ConfigurationChange" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ConfigurationChange" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ControlledDecisionEvidence" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ControlledDecisionEvidence" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ControlledDocument" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ControlledDocument" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ControlledDocumentChange" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ControlledDocumentChange" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ControlledDocumentImportBatch" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ControlledDocumentImportBatch" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ControlledDocumentImportEvent" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ControlledDocumentImportEvent" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ControlledDocumentImportRow" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ControlledDocumentImportRow" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ControlledDocumentRevision" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ControlledDocumentRevision" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ControlledRevisionDecision" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ControlledRevisionDecision" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ControlledRevisionDocument" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ControlledRevisionDocument" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ControlledRevisionLifecycle" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ControlledRevisionLifecycle" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "Department" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "Department" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "Deviation" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "Deviation" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "DeviationCapaPlan" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "DeviationCapaPlan" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "DeviationFollowup" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "DeviationFollowup" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "DeviationImmediateAction" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "DeviationImmediateAction" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "FormFieldConfig" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "FormFieldConfig" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "FormVersion" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "FormVersion" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "GeneratedDocument" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "GeneratedDocument" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "HistoricalImportBatch" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "HistoricalImportBatch" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "HistoricalImportRow" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "HistoricalImportRow" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "LookupCatalog" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "LookupCatalog" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "LookupCatalogItem" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "LookupCatalogItem" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "QmsRecord" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "QmsRecord" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "QmsRecordVersion" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "QmsRecordVersion" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "QmsRelation" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "QmsRelation" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "RecordVersionDocument" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "RecordVersionDocument" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ReturnFollowup" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ReturnFollowup" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ReturnProduct" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ReturnProduct" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ReturnRecord" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ReturnRecord" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ReviewMessage" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ReviewMessage" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ReviewThread" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ReviewThread" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "TemplateVersion" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "TemplateVersion" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_immutable BEFORE UPDATE OR DELETE ON "AuditAdministrationRoot" FOR EACH ROW EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_b2_no_truncate BEFORE TRUNCATE ON "AuditAdministrationRoot" FOR EACH STATEMENT EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_b2_immutable BEFORE UPDATE OR DELETE ON "AuditEventAdditionalTarget" FOR EACH ROW EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_b2_no_truncate BEFORE TRUNCATE ON "AuditEventAdditionalTarget" FOR EACH STATEMENT EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_b2_immutable BEFORE UPDATE OR DELETE ON "AuditCaptureTablePolicy" FOR EACH ROW EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_b2_no_truncate BEFORE TRUNCATE ON "AuditCaptureTablePolicy" FOR EACH STATEMENT EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_b2_immutable BEFORE UPDATE OR DELETE ON "AuditCaptureFieldPolicy" FOR EACH ROW EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_b2_no_truncate BEFORE TRUNCATE ON "AuditCaptureFieldPolicy" FOR EACH STATEMENT EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_b2_immutable BEFORE UPDATE OR DELETE ON "AuditOperationEvidence" FOR EACH ROW EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_b2_no_truncate BEFORE TRUNCATE ON "AuditOperationEvidence" FOR EACH STATEMENT EXECUTE FUNCTION covex_audit_immutable();
DO $$
DECLARE function_id regprocedure; object_name TEXT; owner_role TEXT:=pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public."AuditOperation"'::regclass));
BEGIN
  FOREACH object_name IN ARRAY ARRAY['AuditAdministrationRoot','AuditEventAdditionalTarget','AuditBusinessContext','AuditMutationWitness','AuditRootBinding','AuditCaptureTablePolicy','AuditCaptureFieldPolicy','AuditOperationEvidence'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',object_name);
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='covex_app') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM covex_app',object_name);
      IF object_name NOT IN ('AuditBusinessContext','AuditMutationWitness','AuditRootBinding') THEN EXECUTE format('GRANT SELECT ON public.%I TO covex_app',object_name); END IF;
    END IF;
    EXECUTE format('ALTER TABLE public.%I OWNER TO %I',object_name,owner_role);
  END LOOP;
  -- Root resolution reads only versioned business tables, not sessions/secrets.
  FOR object_name IN SELECT "entityType" FROM public."AuditCaptureTablePolicy" LOOP EXECUTE format('GRANT SELECT ON public.%I TO %I',object_name,owner_role); END LOOP;
  EXECUTE format('GRANT REFERENCES ON public."ChangeHistory",public."ConfigurationChange",public."AuthAuthorizationChange",public."AuditPlanChange",public."ControlledDocumentChange" TO %I',owner_role);
  FOR function_id IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'covex_b2_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',function_id);
    EXECUTE format('ALTER FUNCTION %s OWNER TO %I',function_id,owner_role);
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='covex_app') THEN
    GRANT EXECUTE ON FUNCTION covex_b2_begin(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT) TO covex_app;
  END IF;
END;
$$;
COMMIT;
