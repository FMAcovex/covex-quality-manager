-- AlterEnum
ALTER TYPE "RecordVersionKind" ADD VALUE 'AUDIT_REVISION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'AUDIT_INTERNAL_REPORT';
ALTER TYPE "DocumentType" ADD VALUE 'AUDIT_EXTERNAL_REPORT';
ALTER TYPE "DocumentType" ADD VALUE 'AUDIT_CAPA_PLAN';
ALTER TYPE "DocumentType" ADD VALUE 'AUDIT_EXTERNAL_PLAN';
ALTER TYPE "DocumentType" ADD VALUE 'AUDIT_RECEIVED';
ALTER TYPE "DocumentType" ADD VALUE 'AUDIT_RESPONSE';
ALTER TYPE "DocumentType" ADD VALUE 'AUDIT_EVIDENCE';

-- AlterTable
ALTER TABLE "GeneratedDocument" ADD COLUMN     "fileData" BYTEA,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "mimeType" TEXT;

-- AlterTable
ALTER TABLE "Audit" ADD COLUMN     "activityDuration" TEXT,
ADD COLUMN     "auditedContact" TEXT,
ADD COLUMN     "capaPlanDate" DATE,
ADD COLUMN     "capaPlanEstablishedAt" DATE,
ADD COLUMN     "closureEvidence" TEXT,
ADD COLUMN     "conclusion" TEXT,
ADD COLUMN     "planIntroduction" TEXT,
ADD COLUMN     "preparedBy" TEXT,
ADD COLUMN     "preparedPosition" TEXT,
ADD COLUMN     "previousAuditBackground" TEXT,
ADD COLUMN     "programme" TEXT,
ADD COLUMN     "receivedBy" TEXT,
ADD COLUMN     "receivedPosition" TEXT,
ADD COLUMN     "reportDate" DATE,
ADD COLUMN     "reportDistribution" TEXT,
ADD COLUMN     "reportSentAt" DATE,
ADD COLUMN     "responseRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "responseSentAt" DATE,
ADD COLUMN     "reviewedBy" TEXT,
ADD COLUMN     "reviewedPosition" TEXT,
ADD COLUMN     "supplierAssessment" TEXT,
ADD COLUMN     "supplierException" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supplierExceptionAt" DATE,
ADD COLUMN     "supplierExceptionBy" TEXT,
ADD COLUMN     "supplierExceptionReason" TEXT,
ADD COLUMN     "supplierResponseReceivedAt" DATE,
ADD COLUMN     "supplierType" TEXT,
ADD COLUMN     "verifyAtNextAudit" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AuditFindingAction" ADD COLUMN     "verificationResult" "CapaEffectivenessStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "verifiedAt" DATE,
ADD COLUMN     "verifiedBy" TEXT;
