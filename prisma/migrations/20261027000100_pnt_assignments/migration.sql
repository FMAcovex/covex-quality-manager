BEGIN;
-- D-118: responsables de las funciones de cada revisión de PNT (elabora, revisa, aprueba) con
-- fecha prevista, y responsable de la revisión periódica en el maestro. Texto libre + usuario
-- opcional, como D-101. Aditivo y opcional; la captura B2 los registra como campos no críticos.
ALTER TABLE "ControlledDocument" ADD COLUMN "periodicReviewResponsible" TEXT;
ALTER TABLE "ControlledDocument" ADD COLUMN "periodicReviewResponsibleUserId" UUID;
ALTER TABLE "ControlledDocumentRevision" ADD COLUMN "preparationResponsible" TEXT;
ALTER TABLE "ControlledDocumentRevision" ADD COLUMN "preparationResponsibleUserId" UUID;
ALTER TABLE "ControlledDocumentRevision" ADD COLUMN "preparationTargetDate" DATE;
ALTER TABLE "ControlledDocumentRevision" ADD COLUMN "reviewResponsible" TEXT;
ALTER TABLE "ControlledDocumentRevision" ADD COLUMN "reviewResponsibleUserId" UUID;
ALTER TABLE "ControlledDocumentRevision" ADD COLUMN "reviewTargetDate" DATE;
ALTER TABLE "ControlledDocumentRevision" ADD COLUMN "approvalResponsible" TEXT;
ALTER TABLE "ControlledDocumentRevision" ADD COLUMN "approvalResponsibleUserId" UUID;
ALTER TABLE "ControlledDocumentRevision" ADD COLUMN "approvalTargetDate" DATE;
ALTER TABLE "ControlledDocument" ADD CONSTRAINT "ControlledDocument_periodicReviewResponsibleUserId_fkey" FOREIGN KEY ("periodicReviewResponsibleUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ControlledDocumentRevision" ADD CONSTRAINT "ControlledDocumentRevision_preparationResponsibleUserId_fkey" FOREIGN KEY ("preparationResponsibleUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ControlledDocumentRevision" ADD CONSTRAINT "ControlledDocumentRevision_reviewResponsibleUserId_fkey" FOREIGN KEY ("reviewResponsibleUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ControlledDocumentRevision" ADD CONSTRAINT "ControlledDocumentRevision_approvalResponsibleUserId_fkey" FOREIGN KEY ("approvalResponsibleUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ControlledDocument_periodicReviewResponsibleUserId_idx" ON "ControlledDocument"("periodicReviewResponsibleUserId");
CREATE INDEX "ControlledDocumentRevision_preparationResponsibleUserId_idx" ON "ControlledDocumentRevision"("preparationResponsibleUserId");
CREATE INDEX "ControlledDocumentRevision_reviewResponsibleUserId_idx" ON "ControlledDocumentRevision"("reviewResponsibleUserId");
CREATE INDEX "ControlledDocumentRevision_approvalResponsibleUserId_idx" ON "ControlledDocumentRevision"("approvalResponsibleUserId");
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ControlledDocument','periodicReviewResponsible','STRING','VALUE',false),
('ControlledDocument','periodicReviewResponsibleUserId','STRING','VALUE',false),
('ControlledDocumentRevision','approvalResponsible','STRING','VALUE',false),
('ControlledDocumentRevision','approvalResponsibleUserId','STRING','VALUE',false),
('ControlledDocumentRevision','approvalTargetDate','DATE','VALUE',false),
('ControlledDocumentRevision','preparationResponsible','STRING','VALUE',false),
('ControlledDocumentRevision','preparationResponsibleUserId','STRING','VALUE',false),
('ControlledDocumentRevision','preparationTargetDate','DATE','VALUE',false),
('ControlledDocumentRevision','reviewResponsible','STRING','VALUE',false),
('ControlledDocumentRevision','reviewResponsibleUserId','STRING','VALUE',false),
('ControlledDocumentRevision','reviewTargetDate','DATE','VALUE',false);
COMMIT;
