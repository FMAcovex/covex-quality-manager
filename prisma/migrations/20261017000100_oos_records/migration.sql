-- D-088: módulo OOS (resultados fuera de especificación, PNT GC-10/014/04).
-- Migración aditiva: nuevo tipo de expediente, enums propios y tabla OosRecord.

-- CreateEnum
CREATE TYPE "OosArea" AS ENUM ('API', 'MD');

-- CreateEnum
CREATE TYPE "OosStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "OosMaterialKind" AS ENUM ('FINISHED_PRODUCT', 'RAW_OR_PACKAGING_MATERIAL');

-- CreateEnum
CREATE TYPE "OosPhaseIDisposition" AS ENUM ('LAB_ERROR', 'FULL_SCALE');

-- CreateEnum
CREATE TYPE "OosVerdict" AS ENUM ('APPROVED', 'REJECTED', 'OTHER');

-- CreateEnum
CREATE TYPE "OosInvestigationResult" AS ENUM ('INVALIDATED', 'CONFIRMED', 'INCONCLUSIVE');

-- AlterEnum
ALTER TYPE "QmsRecordType" ADD VALUE 'OOS';

-- AlterEnum
ALTER TYPE "AccessModule" ADD VALUE 'OOS' BEFORE 'PNT';

-- CreateTable
CREATE TABLE "OosRecord" (
    "id" TEXT NOT NULL,
    "qmsRecordId" TEXT NOT NULL,
    "departmentId" TEXT,
    "departmentCodeSnapshot" TEXT,
    "departmentNameSnapshot" TEXT,
    "status" "OosStatus" NOT NULL DEFAULT 'DRAFT',
    "area" "OosArea",
    "createdByText" TEXT,
    "issueDate" DATE,
    "materialKind" "OosMaterialKind",
    "materialName" TEXT,
    "lotNumber" TEXT,
    "batchSize" TEXT,
    "affectedQuantity" TEXT,
    "supplier" TEXT,
    "supplierLot" TEXT,
    "process" TEXT,
    "oosDate" DATE,
    "oosTime" TEXT,
    "detectedBy" TEXT,
    "shift" TEXT,
    "detectionDescription" TEXT,
    "phaseIEvaluation" JSONB,
    "phaseIInvestigation" TEXT,
    "phaseIConclusion" TEXT,
    "phaseIDisposition" "OosPhaseIDisposition",
    "phaseIVerdict" "OosVerdict",
    "phaseIVerdictQuantity" TEXT,
    "phaseIDestroyQuantity" TEXT,
    "phaseIReturnQuantity" TEXT,
    "phaseIVerdictOther" TEXT,
    "phaseIIssuedBy" TEXT,
    "phaseIIssuedAt" DATE,
    "phaseIApprovedBy" TEXT,
    "phaseIApprovedAt" DATE,
    "phaseIIIssueDate" DATE,
    "phaseIIProductionReview" TEXT,
    "phaseIIRetesting" TEXT,
    "phaseIIResampling" TEXT,
    "phaseIIConclusion" TEXT,
    "phaseIIVerdict" "OosVerdict",
    "phaseIIVerdictQuantity" TEXT,
    "phaseIIDestroyQuantity" TEXT,
    "phaseIIReturnQuantity" TEXT,
    "phaseIIVerdictOther" TEXT,
    "phaseIIIssuedBy" TEXT,
    "phaseIIIssuedAt" DATE,
    "phaseIIAffectedDepartments" TEXT,
    "investigationResult" "OosInvestigationResult",
    "closedAt" DATE,
    "internalObservations" TEXT,
    "extraData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OosRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OosRecord_qmsRecordId_key" ON "OosRecord"("qmsRecordId");

-- CreateIndex
CREATE INDEX "OosRecord_departmentId_idx" ON "OosRecord"("departmentId");

-- CreateIndex
CREATE INDEX "OosRecord_status_idx" ON "OosRecord"("status");

-- CreateIndex
CREATE INDEX "OosRecord_area_idx" ON "OosRecord"("area");

-- CreateIndex
CREATE INDEX "OosRecord_issueDate_idx" ON "OosRecord"("issueDate");

-- CreateIndex
CREATE INDEX "OosRecord_investigationResult_idx" ON "OosRecord"("investigationResult");

-- CreateIndex
CREATE INDEX "OosRecord_closedAt_idx" ON "OosRecord"("closedAt");

-- AddForeignKey
ALTER TABLE "OosRecord" ADD CONSTRAINT "OosRecord_qmsRecordId_fkey" FOREIGN KEY ("qmsRecordId") REFERENCES "QmsRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OosRecord" ADD CONSTRAINT "OosRecord_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
