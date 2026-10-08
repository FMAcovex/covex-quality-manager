-- AlterEnum
ALTER TYPE "ControlledDocumentRevisionStatus" ADD VALUE 'IMPORTED_PENDING';

-- CreateTable
CREATE TABLE "ControlledDocumentImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "analyzedAt" TIMESTAMP(3) NOT NULL,
    "actor" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB NOT NULL,
    "reportMetadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "ControlledDocumentImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlledDocumentImportRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "baseCode" TEXT,
    "data" JSONB NOT NULL,
    "decision" TEXT NOT NULL DEFAULT 'PENDING',
    "resolution" JSONB,
    "baseline" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "result" JSONB,

    CONSTRAINT "ControlledDocumentImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlledDocumentImportEvent" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ControlledDocumentImportEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ControlledDocumentImportBatch_state_expiresAt_idx" ON "ControlledDocumentImportBatch"("state", "expiresAt");

-- CreateIndex
CREATE INDEX "ControlledDocumentImportBatch_sha256_idx" ON "ControlledDocumentImportBatch"("sha256");

-- CreateIndex
CREATE INDEX "ControlledDocumentImportRow_batchId_decision_idx" ON "ControlledDocumentImportRow"("batchId", "decision");

-- CreateIndex
CREATE UNIQUE INDEX "ControlledDocumentImportRow_batchId_sourceKey_key" ON "ControlledDocumentImportRow"("batchId", "sourceKey");

-- CreateIndex
CREATE INDEX "ControlledDocumentImportEvent_batchId_createdAt_id_idx" ON "ControlledDocumentImportEvent"("batchId", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "ControlledDocumentImportRow" ADD CONSTRAINT "ControlledDocumentImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ControlledDocumentImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlledDocumentImportEvent" ADD CONSTRAINT "ControlledDocumentImportEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ControlledDocumentImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Explicit staging states and identity; imported revisions cannot imply documentary evidence.
ALTER TABLE "ControlledDocumentImportBatch" ADD CONSTRAINT "ControlledImportBatch_state" CHECK (state IN ('PENDING','PARTIAL','CONFIRMED','EXPIRED'));
ALTER TABLE "ControlledDocumentImportBatch" ADD CONSTRAINT "ControlledImportBatch_sha" CHECK (sha256 ~ '^[a-f0-9]{64}$' AND version >= 0);
ALTER TABLE "ControlledDocumentImportRow" ADD CONSTRAINT "ControlledImportRow_decision" CHECK (decision IN ('PENDING','INCLUDE','EXCLUDED'));
ALTER TABLE "ControlledDocumentImportRow" ADD CONSTRAINT "ControlledImportRow_source" CHECK ("sourceKey" ~ '^[a-f0-9]{64}$');
ALTER TABLE "ControlledDocumentImportRow" ADD CONSTRAINT "ControlledImportRow_include" CHECK (decision <> 'INCLUDE' OR (resolution IS NOT NULL AND baseline IS NOT NULL AND "decidedBy" IS NOT NULL AND "decidedAt" IS NOT NULL));
ALTER TABLE "ControlledDocumentRevision" ADD CONSTRAINT "ControlledRevision_import_pending" CHECK (status::text <> 'IMPORTED_PENDING' OR ("verificationStatus" = 'UNVERIFIED' AND "consolidatedAt" IS NULL AND "verifiedAt" IS NULL AND "verifiedByText" IS NULL));
-- Within a batch a duplicate group has one explicitly selected source, never two silent winners.
CREATE UNIQUE INDEX "ControlledImportRow_one_selected_source" ON "ControlledDocumentImportRow" ("batchId", "baseCode") WHERE decision = 'INCLUDE';
