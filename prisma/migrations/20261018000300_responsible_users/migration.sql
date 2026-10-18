BEGIN;
-- D-101: usuario de la aplicación junto a cada responsable en texto libre. Aditivo y opcional:
-- el texto se conserva y es lo que se imprime en los anexos. La captura B2 registra el usuario.
ALTER TABLE "DeviationImmediateAction" ADD COLUMN "executedByUserId" UUID;
ALTER TABLE "DeviationCapaPlan" ADD COLUMN "responsibleUserId" UUID;
ALTER TABLE "CapaPlannedAction" ADD COLUMN "responsibleUserId" UUID;
ALTER TABLE "ChangeControl" ADD COLUMN "requestDecisionResponsibleUserId" UUID;
ALTER TABLE "ChangeControl" ADD COLUMN "followupResponsibleUserId" UUID;
ALTER TABLE "ChangeControlTask" ADD COLUMN "responsibleUserId" UUID;
ALTER TABLE "ChangeControlFollowup" ADD COLUMN "responsibleUserId" UUID;
ALTER TABLE "ComplaintCapaPlan" ADD COLUMN "responsibleUserId" UUID;
ALTER TABLE "ComplaintDerivedAction" ADD COLUMN "responsibleUserId" UUID;
ALTER TABLE "AuditFindingAction" ADD COLUMN "responsibleUserId" UUID;
ALTER TABLE "DeviationImmediateAction" ADD CONSTRAINT "DeviationImmediateAction_executedByUserId_fkey" FOREIGN KEY ("executedByUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeviationCapaPlan" ADD CONSTRAINT "DeviationCapaPlan_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapaPlannedAction" ADD CONSTRAINT "CapaPlannedAction_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChangeControl" ADD CONSTRAINT "ChangeControl_requestDecisionResponsibleUserId_fkey" FOREIGN KEY ("requestDecisionResponsibleUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChangeControl" ADD CONSTRAINT "ChangeControl_followupResponsibleUserId_fkey" FOREIGN KEY ("followupResponsibleUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChangeControlTask" ADD CONSTRAINT "ChangeControlTask_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChangeControlFollowup" ADD CONSTRAINT "ChangeControlFollowup_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplaintCapaPlan" ADD CONSTRAINT "ComplaintCapaPlan_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplaintDerivedAction" ADD CONSTRAINT "ComplaintDerivedAction_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditFindingAction" ADD CONSTRAINT "AuditFindingAction_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "DeviationImmediateAction_executedByUserId_idx" ON "DeviationImmediateAction"("executedByUserId");
CREATE INDEX "DeviationCapaPlan_responsibleUserId_idx" ON "DeviationCapaPlan"("responsibleUserId");
CREATE INDEX "CapaPlannedAction_responsibleUserId_idx" ON "CapaPlannedAction"("responsibleUserId");
CREATE INDEX "ChangeControl_requestDecisionResponsibleUserId_idx" ON "ChangeControl"("requestDecisionResponsibleUserId");
CREATE INDEX "ChangeControl_followupResponsibleUserId_idx" ON "ChangeControl"("followupResponsibleUserId");
CREATE INDEX "ChangeControlTask_responsibleUserId_idx" ON "ChangeControlTask"("responsibleUserId");
CREATE INDEX "ChangeControlFollowup_responsibleUserId_idx" ON "ChangeControlFollowup"("responsibleUserId");
CREATE INDEX "ComplaintCapaPlan_responsibleUserId_idx" ON "ComplaintCapaPlan"("responsibleUserId");
CREATE INDEX "ComplaintDerivedAction_responsibleUserId_idx" ON "ComplaintDerivedAction"("responsibleUserId");
CREATE INDEX "AuditFindingAction_responsibleUserId_idx" ON "AuditFindingAction"("responsibleUserId");
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('DeviationImmediateAction','executedByUserId','STRING','VALUE',false),
('DeviationCapaPlan','responsibleUserId','STRING','VALUE',false),
('CapaPlannedAction','responsibleUserId','STRING','VALUE',false),
('ChangeControl','requestDecisionResponsibleUserId','STRING','VALUE',false),
('ChangeControl','followupResponsibleUserId','STRING','VALUE',false),
('ChangeControlTask','responsibleUserId','STRING','VALUE',false),
('ChangeControlFollowup','responsibleUserId','STRING','VALUE',false),
('ComplaintCapaPlan','responsibleUserId','STRING','VALUE',false),
('ComplaintDerivedAction','responsibleUserId','STRING','VALUE',false),
('AuditFindingAction','responsibleUserId','STRING','VALUE',false);
COMMIT;
