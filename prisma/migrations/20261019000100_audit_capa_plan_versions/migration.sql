-- D-110 (R5C1): versiones propias del CAPA plan de auditoría (00, 01…).
-- Tabla nueva, inmutable y capturada por B2 como AuditAnnualProgrammeVersion.
BEGIN;
-- CreateEnum
CREATE TYPE "AuditCapaPlanVersionKind" AS ENUM ('ESTABLISHED', 'FOLLOWUP');

-- CreateTable
CREATE TABLE "AuditCapaPlanVersion" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "kind" "AuditCapaPlanVersionKind" NOT NULL,
    "followupDate" DATE,
    "observations" TEXT,
    "nextReviewDate" DATE,
    "requestId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "contentFingerprint" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "templateChecksum" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileData" BYTEA NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL,
    "authenticatedUserId" UUID,

    CONSTRAINT "AuditCapaPlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditCapaPlanVersion_auditId_generatedAt_idx" ON "AuditCapaPlanVersion"("auditId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditCapaPlanVersion_auditId_sequenceNumber_key" ON "AuditCapaPlanVersion"("auditId", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AuditCapaPlanVersion_auditId_requestId_key" ON "AuditCapaPlanVersion"("auditId", "requestId");

-- AddForeignKey
ALTER TABLE "AuditCapaPlanVersion" ADD CONSTRAINT "AuditCapaPlanVersion_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditCapaPlanVersion" ADD CONSTRAINT "AuditCapaPlanVersion_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "TemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditCapaPlanVersion" ADD CONSTRAINT "AuditCapaPlanVersion_authenticatedUserId_fkey" FOREIGN KEY ("authenticatedUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "AuditCapaPlanVersion" ADD CONSTRAINT "AuditCapaPlanVersion_sequence_nonnegative" CHECK ("sequenceNumber" >= 0);
ALTER TABLE "AuditCapaPlanVersion" ADD CONSTRAINT "AuditCapaPlanVersion_file_size" CHECK ("fileSize" > 0 AND octet_length("fileData") = "fileSize");

-- Las versiones emitidas y su archivo son de solo anexado.
CREATE FUNCTION prevent_audit_capa_plan_version_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Issued audit CAPA plan versions are immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER immutable_audit_capa_plan_version BEFORE UPDATE OR DELETE ON "AuditCapaPlanVersion" FOR EACH ROW EXECUTE FUNCTION prevent_audit_capa_plan_version_mutation();

CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "AuditCapaPlanVersion" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "AuditCapaPlanVersion" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
INSERT INTO "AuditCaptureTablePolicy" VALUES ('AuditCapaPlanVersion',ARRAY['id'],'[{"via":"auditId","table":"Audit"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('AuditCapaPlanVersion','auditId','STRING','VALUE',false),
('AuditCapaPlanVersion','authenticatedUserId','STRING','VALUE',false),
('AuditCapaPlanVersion','checksum','STRING','VALUE',false),
('AuditCapaPlanVersion','contentFingerprint','STRING','VALUE',false),
('AuditCapaPlanVersion','fileName','STRING','VALUE',false),
('AuditCapaPlanVersion','fileSize','INTEGER','VALUE',false),
('AuditCapaPlanVersion','followupDate','DATE','VALUE',false),
('AuditCapaPlanVersion','generatedAt','INSTANT','VALUE',false),
('AuditCapaPlanVersion','generatedBy','STRING','VALUE',false),
('AuditCapaPlanVersion','id','STRING','VALUE',false),
('AuditCapaPlanVersion','kind','STRING','VALUE',false),
('AuditCapaPlanVersion','mimeType','STRING','VALUE',false),
('AuditCapaPlanVersion','nextReviewDate','DATE','VALUE',false),
('AuditCapaPlanVersion','observations','STRING','VALUE',false),
('AuditCapaPlanVersion','requestHash','STRING','VALUE',false),
('AuditCapaPlanVersion','requestId','STRING','VALUE',false),
('AuditCapaPlanVersion','sequenceNumber','INTEGER','VALUE',false),
('AuditCapaPlanVersion','snapshot','STRING','SHA256_JSON',false),
('AuditCapaPlanVersion','templateChecksum','STRING','VALUE',false),
('AuditCapaPlanVersion','templateVersionId','STRING','VALUE',false);
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "AuditCapaPlanVersion" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "AuditCapaPlanVersion" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
DO $$
DECLARE owner_role TEXT:=pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public."AuditOperation"'::regclass));
BEGIN
 EXECUTE format('GRANT SELECT ON public."AuditCapaPlanVersion" TO %I',owner_role);
END;
$$;
COMMIT;
