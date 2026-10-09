CREATE TYPE "AuditPlanningStatus" AS ENUM ('UNCLASSIFIED','PLANNED','OUT_OF_PLAN');

CREATE TABLE "AuditAnnualPlan" (
  "id" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "auditType" "AuditType" NOT NULL,
  "title" TEXT NOT NULL,
  "notes" TEXT,
  "createdByText" TEXT NOT NULL,
  "updatedByText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuditAnnualPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AuditAnnualPlan_year_auditType_key" ON "AuditAnnualPlan"("year","auditType");
CREATE INDEX "AuditAnnualPlan_auditType_year_idx" ON "AuditAnnualPlan"("auditType","year");

CREATE TABLE "AuditPlanEntry" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "targetName" TEXT,
  "departmentId" TEXT,
  "plannedDate" DATE,
  "notes" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByText" TEXT NOT NULL,
  "updatedByText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuditPlanEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditPlanEntry_planId_isActive_sortOrder_idx" ON "AuditPlanEntry"("planId","isActive","sortOrder");
ALTER TABLE "AuditPlanEntry" ADD CONSTRAINT "AuditPlanEntry_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AuditAnnualPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditPlanEntry" ADD CONSTRAINT "AuditPlanEntry_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AuditPlanChange" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "entryId" TEXT,
  "event" TEXT NOT NULL,
  "oldValue" JSONB,
  "newValue" JSONB,
  "actor" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditPlanChange_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditPlanChange_planId_createdAt_idx" ON "AuditPlanChange"("planId","createdAt");
ALTER TABLE "AuditPlanChange" ADD CONSTRAINT "AuditPlanChange_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AuditAnnualPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Audit" ADD COLUMN "planningStatus" "AuditPlanningStatus" NOT NULL DEFAULT 'UNCLASSIFIED',
ADD COLUMN "outsidePlanReason" TEXT,
ADD COLUMN "planEntryId" TEXT;
CREATE UNIQUE INDEX "Audit_planEntryId_key" ON "Audit"("planEntryId");
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_planEntryId_fkey" FOREIGN KEY ("planEntryId") REFERENCES "AuditPlanEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_planning_classification_check" CHECK (
  ("planningStatus"='PLANNED' AND "planEntryId" IS NOT NULL AND "outsidePlanReason" IS NULL)
  OR ("planningStatus"='OUT_OF_PLAN' AND "planEntryId" IS NULL)
  OR ("planningStatus"='UNCLASSIFIED' AND "planEntryId" IS NULL AND "outsidePlanReason" IS NULL)
);
