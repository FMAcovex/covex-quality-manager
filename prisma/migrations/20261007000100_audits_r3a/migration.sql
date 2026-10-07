-- CreateEnum
CREATE TYPE "AuditType" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "AuditScenario" AS ENUM ('INTERNAL_COVEX', 'INTERNAL_CONTRACTED', 'SUPPLIER', 'CLIENT', 'AUTHORITY');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "AuditModality" AS ENUM ('ONSITE', 'REMOTE', 'HYBRID');

-- CreateEnum
CREATE TYPE "AuditParticipantRole" AS ENUM ('LEAD_AUDITOR', 'AUDITOR', 'AUDITEE');

-- AlterEnum
ALTER TYPE "QmsRecordType" ADD VALUE 'AUDIT';

-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL,
    "qmsRecordId" TEXT NOT NULL,
    "auditType" "AuditType",
    "scenario" "AuditScenario",
    "status" "AuditStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "scope" TEXT,
    "referenceText" TEXT,
    "externalReference" TEXT,
    "auditedEntityName" TEXT,
    "auditedEntityAddress" TEXT,
    "auditingEntityName" TEXT,
    "entityCode" TEXT,
    "codingDepartmentId" TEXT,
    "codingDepartmentCodeSnapshot" TEXT,
    "codingDepartmentNameSnapshot" TEXT,
    "plannedDate" DATE,
    "performedDate" DATE,
    "openedAt" DATE,
    "closedAt" DATE,
    "modality" "AuditModality",
    "internalObservations" TEXT,
    "dataQualityStatus" "DataQualityStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "createdByText" TEXT,
    "updatedByText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditDepartment" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "departmentCodeSnapshot" TEXT NOT NULL,
    "departmentNameSnapshot" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditParticipant" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "position" TEXT,
    "organization" TEXT,
    "role" "AuditParticipantRole" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Audit_qmsRecordId_key" ON "Audit"("qmsRecordId");

-- CreateIndex
CREATE INDEX "Audit_status_plannedDate_idx" ON "Audit"("status", "plannedDate");

-- CreateIndex
CREATE INDEX "Audit_auditType_plannedDate_idx" ON "Audit"("auditType", "plannedDate");

-- CreateIndex
CREATE INDEX "Audit_performedDate_idx" ON "Audit"("performedDate");

-- CreateIndex
CREATE INDEX "Audit_scenario_idx" ON "Audit"("scenario");

-- CreateIndex
CREATE INDEX "AuditDepartment_departmentId_isActive_idx" ON "AuditDepartment"("departmentId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AuditDepartment_auditId_departmentId_key" ON "AuditDepartment"("auditId", "departmentId");

-- CreateIndex
CREATE INDEX "AuditParticipant_auditId_sortOrder_idx" ON "AuditParticipant"("auditId", "sortOrder");

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_qmsRecordId_fkey" FOREIGN KEY ("qmsRecordId") REFERENCES "QmsRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_codingDepartmentId_fkey" FOREIGN KEY ("codingDepartmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditDepartment" ADD CONSTRAINT "AuditDepartment_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditDepartment" ADD CONSTRAINT "AuditDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditParticipant" ADD CONSTRAINT "AuditParticipant_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Supplied type/scenario pairs must remain compatible, including direct DB writes.
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_type_scenario_check" CHECK (
  "auditType" IS NULL OR "scenario" IS NULL OR
  ("auditType" = 'INTERNAL' AND "scenario" IN ('INTERNAL_COVEX', 'INTERNAL_CONTRACTED')) OR
  ("auditType" = 'EXTERNAL' AND "scenario" IN ('SUPPLIER', 'CLIENT', 'AUTHORITY'))
);
