-- CreateEnum
CREATE TYPE "AuditFindingType" AS ENUM ('FINDING', 'RECOMMENDATION', 'CLIENT_OBSERVATION', 'AUTHORITY_OBSERVATION');

-- CreateEnum
CREATE TYPE "AuditFindingCriticality" AS ENUM ('CRITICAL', 'MAJOR', 'MINOR', 'NA');

-- CreateEnum
CREATE TYPE "AuditActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'CLOSED', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "AuditFinding" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "findingType" "AuditFindingType" NOT NULL,
    "criticality" "AuditFindingCriticality" NOT NULL DEFAULT 'NA',
    "description" TEXT NOT NULL,
    "criterionReference" TEXT,
    "objectiveEvidence" TEXT,
    "treatment" TEXT,
    "treatmentStatus" "AuditActionStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" DATE,
    "evidence" TEXT,
    "evidenceReference" TEXT,
    "verificationComment" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "retiredAt" TIMESTAMP(3),
    "retiredByText" TEXT,
    "retirementReason" TEXT,
    "createdByText" TEXT NOT NULL,
    "updatedByText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditFindingAction" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsible" TEXT,
    "targetDate" DATE,
    "status" "AuditActionStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" DATE,
    "evidence" TEXT,
    "evidenceReference" TEXT,
    "verificationComment" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "retiredAt" TIMESTAMP(3),
    "retiredByText" TEXT,
    "retirementReason" TEXT,
    "createdByText" TEXT NOT NULL,
    "updatedByText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditFindingAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditFindingRelation" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "qmsRelationId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByText" TEXT NOT NULL,
    "updatedByText" TEXT,
    "retiredAt" TIMESTAMP(3),
    "retiredByText" TEXT,
    "retirementReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditFindingRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditFollowup" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "findingId" TEXT,
    "followupDate" DATE NOT NULL,
    "completedByText" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "nextReviewDate" DATE,
    "evidenceReference" TEXT,
    "createdByText" TEXT NOT NULL,
    "updatedByText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditFollowup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditFinding_auditId_isActive_sortOrder_idx" ON "AuditFinding"("auditId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "AuditFinding_criticality_isActive_idx" ON "AuditFinding"("criticality", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AuditFinding_auditId_reference_key" ON "AuditFinding"("auditId", "reference");

-- CreateIndex
CREATE INDEX "AuditFindingAction_findingId_isActive_sortOrder_idx" ON "AuditFindingAction"("findingId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "AuditFindingAction_status_targetDate_idx" ON "AuditFindingAction"("status", "targetDate");

-- CreateIndex
CREATE INDEX "AuditFindingRelation_qmsRelationId_isActive_idx" ON "AuditFindingRelation"("qmsRelationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AuditFindingRelation_findingId_qmsRelationId_key" ON "AuditFindingRelation"("findingId", "qmsRelationId");

-- CreateIndex
CREATE INDEX "AuditFollowup_auditId_followupDate_idx" ON "AuditFollowup"("auditId", "followupDate");

-- CreateIndex
CREATE INDEX "AuditFollowup_findingId_followupDate_idx" ON "AuditFollowup"("findingId", "followupDate");

-- CreateIndex
CREATE INDEX "AuditFollowup_nextReviewDate_idx" ON "AuditFollowup"("nextReviewDate");

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFindingAction" ADD CONSTRAINT "AuditFindingAction_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "AuditFinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFindingRelation" ADD CONSTRAINT "AuditFindingRelation_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "AuditFinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFindingRelation" ADD CONSTRAINT "AuditFindingRelation_qmsRelationId_fkey" FOREIGN KEY ("qmsRelationId") REFERENCES "QmsRelation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFollowup" ADD CONSTRAINT "AuditFollowup_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFollowup" ADD CONSTRAINT "AuditFollowup_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "AuditFinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
