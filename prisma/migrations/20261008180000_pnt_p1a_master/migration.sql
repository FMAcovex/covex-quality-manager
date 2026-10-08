-- CreateEnum
CREATE TYPE "ControlledDocumentType" AS ENUM ('PNT', 'TECHNICAL_INSTRUCTION');

-- CreateEnum
CREATE TYPE "ControlledDocumentAdministrativeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ANNULLED');

-- CreateEnum
CREATE TYPE "ControlledDocumentRevisionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PENDING_APPROVAL', 'APPROVED_PENDING_EFFECTIVE', 'IN_FORCE', 'OBSOLETE', 'ANNULLED');

-- CreateEnum
CREATE TYPE "ControlledDocumentVerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'REVIEW_REQUIRED');

-- CreateTable
CREATE TABLE "ControlledDocument" (
    "id" TEXT NOT NULL,
    "baseCode" TEXT,
    "title" TEXT,
    "documentType" "ControlledDocumentType" NOT NULL DEFAULT 'PNT',
    "departmentId" TEXT,
    "departmentCodeSnapshot" TEXT,
    "departmentNameSnapshot" TEXT,
    "administrativeStatus" "ControlledDocumentAdministrativeStatus" NOT NULL DEFAULT 'DRAFT',
    "observations" TEXT,
    "sourceMetadata" JSONB,
    "verificationStatus" "ControlledDocumentVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "createdByText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "annulledAt" TIMESTAMP(3),
    "annulledByText" TEXT,
    "annulmentReason" TEXT,

    CONSTRAINT "ControlledDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlledDocumentRevision" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "revisionCode" TEXT NOT NULL,
    "baseCodeSnapshot" TEXT,
    "titleSnapshot" TEXT,
    "departmentCodeSnapshot" TEXT,
    "departmentNameSnapshot" TEXT,
    "revisionReason" TEXT,
    "status" "ControlledDocumentRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" DATE,
    "reviewDueAt" DATE,
    "obsoletedAt" DATE,
    "previousRevisionId" TEXT,
    "sourceReference" TEXT,
    "sourceMetadata" JSONB,
    "verificationStatus" "ControlledDocumentVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedByText" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "consolidatedAt" TIMESTAMP(3),
    "registeredByText" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ControlledDocumentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlledDocumentChange" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "revisionId" TEXT,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "changedByText" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" "HistorySource" NOT NULL DEFAULT 'UI',
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ControlledDocumentChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ControlledDocument_baseCode_key" ON "ControlledDocument"("baseCode");

-- CreateIndex
CREATE INDEX "ControlledDocument_departmentId_administrativeStatus_idx" ON "ControlledDocument"("departmentId", "administrativeStatus");

-- CreateIndex
CREATE INDEX "ControlledDocument_administrativeStatus_createdAt_idx" ON "ControlledDocument"("administrativeStatus", "createdAt");

-- CreateIndex
CREATE INDEX "ControlledDocumentRevision_status_effectiveFrom_reviewDueAt_idx" ON "ControlledDocumentRevision"("status", "effectiveFrom", "reviewDueAt");

-- CreateIndex
CREATE INDEX "ControlledDocumentRevision_documentId_revisionCode_idx" ON "ControlledDocumentRevision"("documentId", "revisionCode");

-- CreateIndex
CREATE UNIQUE INDEX "ControlledDocumentRevision_documentId_revisionCode_key" ON "ControlledDocumentRevision"("documentId", "revisionCode");

-- CreateIndex
CREATE UNIQUE INDEX "ControlledDocumentRevision_documentId_id_key" ON "ControlledDocumentRevision"("documentId", "id");

-- CreateIndex
CREATE INDEX "ControlledDocumentChange_documentId_changedAt_id_idx" ON "ControlledDocumentChange"("documentId", "changedAt", "id");

-- CreateIndex
CREATE INDEX "ControlledDocumentChange_revisionId_idx" ON "ControlledDocumentChange"("revisionId");

-- AddForeignKey
ALTER TABLE "ControlledDocument" ADD CONSTRAINT "ControlledDocument_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlledDocumentRevision" ADD CONSTRAINT "ControlledDocumentRevision_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ControlledDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlledDocumentRevision" ADD CONSTRAINT "ControlledDocumentRevision_documentId_previousRevisionId_fkey" FOREIGN KEY ("documentId", "previousRevisionId") REFERENCES "ControlledDocumentRevision"("documentId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ControlledDocumentChange" ADD CONSTRAINT "ControlledDocumentChange_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ControlledDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlledDocumentChange" ADD CONSTRAINT "ControlledDocumentChange_documentId_revisionId_fkey" FOREIGN KEY ("documentId", "revisionId") REFERENCES "ControlledDocumentRevision"("documentId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;


-- Document identity and documentary dates are independent from business records.
ALTER TABLE "ControlledDocument" ADD CONSTRAINT "ControlledDocument_baseCode_format" CHECK ("baseCode" IS NULL OR "baseCode" ~ '^[A-Z]{2}-[0-9]{2}/[0-9]{3}$');
ALTER TABLE "ControlledDocumentRevision" ADD CONSTRAINT "ControlledDocumentRevision_code_format" CHECK ("revisionCode" ~ '^[0-9]{2}$');
ALTER TABLE "ControlledDocumentRevision" ADD CONSTRAINT "ControlledDocumentRevision_dates" CHECK (("reviewDueAt" IS NULL OR "effectiveFrom" IS NULL OR "reviewDueAt" >= "effectiveFrom") AND ("obsoletedAt" IS NULL OR "effectiveFrom" IS NULL OR "obsoletedAt" >= "effectiveFrom"));
CREATE UNIQUE INDEX "ControlledDocumentRevision_one_in_force" ON "ControlledDocumentRevision" ("documentId") WHERE status = 'IN_FORCE';
CREATE UNIQUE INDEX "ControlledDocumentRevision_one_draft" ON "ControlledDocumentRevision" ("documentId") WHERE status IN ('DRAFT', 'IN_REVIEW', 'PENDING_APPROVAL', 'APPROVED_PENDING_EFFECTIVE');
