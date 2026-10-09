-- Additive: no backfill or reinterpretation of historical P1A/Excel data.
CREATE TABLE "ControlledRevisionLifecycle" (
 "revisionId" TEXT PRIMARY KEY, "documentId" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 0, "legacyOrigin" BOOLEAN NOT NULL DEFAULT false,
 "approvalAt" DATE, "effectiveFrom" DATE, "reviewDueAt" DATE, "obsoletedAt" DATE,
 CONSTRAINT "ControlledRevisionLifecycle_version_check" CHECK ("version" >= 0),
 CONSTRAINT "ControlledRevisionLifecycle_dates_check" CHECK ("legacyOrigin" OR (("effectiveFrom" IS NULL OR "approvalAt" IS NULL OR "effectiveFrom" >= "approvalAt") AND ("reviewDueAt" IS NULL OR "effectiveFrom" IS NULL OR "reviewDueAt" > "effectiveFrom"))),
 UNIQUE ("documentId", "revisionId"),
 FOREIGN KEY ("documentId", "revisionId") REFERENCES "ControlledDocumentRevision"("documentId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE TABLE "ControlledRevisionDecision" (
 "id" TEXT PRIMARY KEY, "documentId" TEXT NOT NULL, "revisionId" TEXT NOT NULL, "sequence" INTEGER NOT NULL,
 "requestId" TEXT NOT NULL UNIQUE, "requestHash" TEXT NOT NULL,
 "operation" TEXT NOT NULL, "result" TEXT, "actor" TEXT NOT NULL, "identitySource" TEXT NOT NULL,
 "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "reason" TEXT NOT NULL,
 "oldState" "ControlledDocumentRevisionStatus" NOT NULL, "newState" "ControlledDocumentRevisionStatus" NOT NULL,
 "details" JSONB NOT NULL, "before" JSONB NOT NULL, "after" JSONB NOT NULL, "rectifiesId" TEXT,
 UNIQUE ("revisionId", "id"), UNIQUE ("revisionId", "sequence"),
 CONSTRAINT "ControlledRevisionDecision_operation_check" CHECK ("operation" IN ('VERIFY','REGISTER_EXTERNAL','CONTRAST_EXTERNAL','SUBMIT','PLAN','ACTIVATE','RETIRE','ANNUL','RECTIFY')),
 CONSTRAINT "ControlledRevisionDecision_sequence_check" CHECK ("sequence" > 0),
 FOREIGN KEY ("documentId", "revisionId") REFERENCES "ControlledDocumentRevision"("documentId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION,
 FOREIGN KEY ("revisionId", "rectifiesId") REFERENCES "ControlledRevisionDecision"("revisionId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE INDEX "ControlledRevisionDecision_documentId_revisionId_decidedAt_idx" ON "ControlledRevisionDecision"("documentId", "revisionId", "decidedAt");
CREATE TABLE "ControlledDecisionEvidence" (
 "id" TEXT PRIMARY KEY, "revisionId" TEXT NOT NULL, "decisionId" TEXT NOT NULL, "documentObjectId" TEXT NOT NULL, "snapshot" JSONB NOT NULL,
 UNIQUE ("decisionId", "documentObjectId"),
 FOREIGN KEY ("revisionId", "decisionId") REFERENCES "ControlledRevisionDecision"("revisionId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION,
 FOREIGN KEY ("revisionId", "documentObjectId") REFERENCES "ControlledRevisionDocument"("revisionId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE FUNCTION pnt_p2b_immutable_decision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'P2B decisions and evidence links are immutable; append a linked rectification'; END;
$$;
CREATE TRIGGER pnt_p2b_decision_immutable BEFORE UPDATE OR DELETE ON "ControlledRevisionDecision" FOR EACH ROW EXECUTE FUNCTION pnt_p2b_immutable_decision();
CREATE TRIGGER pnt_p2b_evidence_immutable BEFORE UPDATE OR DELETE ON "ControlledDecisionEvidence" FOR EACH ROW EXECUTE FUNCTION pnt_p2b_immutable_decision();
