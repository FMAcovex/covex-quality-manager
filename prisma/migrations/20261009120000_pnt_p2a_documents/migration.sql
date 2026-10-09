CREATE TABLE "ControlledRevisionDocument" (
 "id" TEXT PRIMARY KEY, "documentId" TEXT NOT NULL, "revisionId" TEXT NOT NULL,
 "originalName" TEXT NOT NULL, "kind" TEXT NOT NULL, "state" TEXT NOT NULL,
 "mimeType" TEXT, "sizeBytes" INTEGER, "sha256" TEXT, "fileData" BYTEA,
 "storageReference" TEXT NOT NULL, "externalReference" TEXT, "description" TEXT,
 "incorporatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "incorporatedBy" TEXT NOT NULL, "identitySource" TEXT NOT NULL,
 "replacesId" TEXT, "replacementReason" TEXT,
 CONSTRAINT "ControlledRevisionDocument_revision_fkey" FOREIGN KEY ("documentId", "revisionId") REFERENCES "ControlledDocumentRevision"("documentId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "ControlledRevisionDocument_kind_check" CHECK ("kind" IN ('WORKING_WORD','DOCUMENT_PDF','EXTERNAL_SIGNED_PDF','APPROVAL_EVIDENCE','ANNEX')),
 CONSTRAINT "ControlledRevisionDocument_state_check" CHECK ("state" = CASE WHEN "kind" = 'WORKING_WORD' THEN 'WORKING' ELSE 'RECORDED_UNVERIFIED' END),
 CONSTRAINT "ControlledRevisionDocument_storage_check" CHECK (
  ("fileData" IS NOT NULL AND "externalReference" IS NULL AND "sizeBytes" IS NOT NULL AND "sizeBytes" BETWEEN 1 AND 15728640 AND octet_length("fileData") = "sizeBytes" AND "sha256" IS NOT NULL AND "sha256" ~ '^[0-9a-f]{64}$' AND "mimeType" IS NOT NULL AND "storageReference" = 'postgres:' || "id") OR
  ("fileData" IS NULL AND "externalReference" IS NOT NULL AND "mimeType" IS NULL AND "sizeBytes" IS NULL AND "sha256" IS NULL AND "storageReference" = 'external:' || "id")
 ),
 CONSTRAINT "ControlledRevisionDocument_reason_check" CHECK (("replacesId" IS NULL AND "replacementReason" IS NULL) OR ("replacesId" IS NOT NULL AND "replacesId" <> "id" AND "replacementReason" IS NOT NULL AND length(btrim("replacementReason")) > 0))
);
CREATE UNIQUE INDEX "ControlledRevisionDocument_storageReference_key" ON "ControlledRevisionDocument"("storageReference");
CREATE UNIQUE INDEX "ControlledRevisionDocument_replacesId_key" ON "ControlledRevisionDocument"("replacesId");
CREATE UNIQUE INDEX "ControlledRevisionDocument_revisionId_id_key" ON "ControlledRevisionDocument"("revisionId", "id");
CREATE UNIQUE INDEX "ControlledRevisionDocument_revisionId_replacesId_key" ON "ControlledRevisionDocument"("revisionId", "replacesId");
CREATE INDEX "ControlledRevisionDocument_documentId_revisionId_incorporatedAt_idx" ON "ControlledRevisionDocument"("documentId", "revisionId", "incorporatedAt");
ALTER TABLE "ControlledRevisionDocument" ADD CONSTRAINT "ControlledRevisionDocument_replacement_fkey" FOREIGN KEY ("revisionId", "replacesId") REFERENCES "ControlledRevisionDocument"("revisionId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;
-- No ordinary update/delete: replacements are inserts. Maintenance/retention needs a separately authorized procedure.
CREATE FUNCTION pnt_document_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'PNT documentary objects are immutable; insert a replacement'; END;
$$;
CREATE TRIGGER "pnt_document_immutable" BEFORE UPDATE OR DELETE ON "ControlledRevisionDocument" FOR EACH ROW EXECUTE FUNCTION pnt_document_immutable();
