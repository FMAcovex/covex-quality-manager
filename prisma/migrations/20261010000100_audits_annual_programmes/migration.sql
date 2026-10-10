-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'AUDIT_ANNUAL_INTERNAL_PROGRAMME';
ALTER TYPE "DocumentType" ADD VALUE 'AUDIT_ANNUAL_EXTERNAL_PROGRAMME';

-- AlterTable
ALTER TABLE "AuditAnnualPlan" ADD COLUMN     "qualityApproverName" TEXT,
ADD COLUMN     "technicalApproverName" TEXT;

-- AlterTable
ALTER TABLE "AuditPlanEntry" ADD COLUMN     "plannedAuditorsText" TEXT,
ADD COLUMN     "plannedModality" "AuditModality",
ADD COLUMN     "plannedPeriodText" TEXT,
ADD COLUMN     "plannedScope" TEXT,
ADD COLUMN     "productService" TEXT,
ADD COLUMN     "programmeArea" TEXT;

-- CreateTable
CREATE TABLE "AuditAnnualProgrammeVersion" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "requestId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "contentFingerprint" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "templateChecksum" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileData" BYTEA NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,

    CONSTRAINT "AuditAnnualProgrammeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditAnnualProgrammeVersion_planId_generatedAt_idx" ON "AuditAnnualProgrammeVersion"("planId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditAnnualProgrammeVersion_planId_sequenceNumber_key" ON "AuditAnnualProgrammeVersion"("planId", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AuditAnnualProgrammeVersion_planId_requestId_key" ON "AuditAnnualProgrammeVersion"("planId", "requestId");

-- AddForeignKey
ALTER TABLE "AuditAnnualProgrammeVersion" ADD CONSTRAINT "AuditAnnualProgrammeVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AuditAnnualPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditAnnualProgrammeVersion" ADD CONSTRAINT "AuditAnnualProgrammeVersion_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "TemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Issued snapshots and archived bytes are append-only, independent of mutable plans.
CREATE FUNCTION prevent_annual_programme_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Issued annual programme versions are immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER immutable_annual_programme_version
BEFORE UPDATE OR DELETE ON "AuditAnnualProgrammeVersion"
FOR EACH ROW EXECUTE FUNCTION prevent_annual_programme_mutation();
ALTER TABLE "AuditAnnualProgrammeVersion" ADD CONSTRAINT "AnnualProgramme_sequence_nonnegative" CHECK ("sequenceNumber" >= 0);
ALTER TABLE "AuditAnnualProgrammeVersion" ADD CONSTRAINT "AnnualProgramme_file_size" CHECK ("fileSize" > 0 AND octet_length("fileData") = "fileSize");
