-- D-141: lecturas de PNT. Quién debe leer cada revisión (usuarios o personas externas), plazo, y
-- cuándo y quién confirma la lectura. Control operativo de por dónde va el PNT impreso; la firma de
-- lectura sigue en el procedimiento. Tabla nueva con raíz en el PNT, capturada por B2 como sus revisiones.
BEGIN;
-- CreateEnum
CREATE TYPE "ControlledReadingStatus" AS ENUM ('PENDING', 'READ', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "ControlledReadingAssignment" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "readerUserId" UUID,
    "readerName" TEXT NOT NULL,
    "status" "ControlledReadingStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" DATE NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedByText" TEXT NOT NULL,
    "readOn" DATE,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByText" TEXT,
    "confirmedOnBehalf" BOOLEAN NOT NULL DEFAULT false,
    "withdrawnAt" TIMESTAMP(3),
    "withdrawnByText" TEXT,
    "withdrawalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ControlledReadingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ControlledReadingAssignment_documentId_status_idx" ON "ControlledReadingAssignment"("documentId", "status");

-- CreateIndex
CREATE INDEX "ControlledReadingAssignment_revisionId_status_idx" ON "ControlledReadingAssignment"("revisionId", "status");

-- CreateIndex
CREATE INDEX "ControlledReadingAssignment_readerUserId_status_idx" ON "ControlledReadingAssignment"("readerUserId", "status");

-- AddForeignKey
ALTER TABLE "ControlledReadingAssignment" ADD CONSTRAINT "ControlledReadingAssignment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ControlledDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlledReadingAssignment" ADD CONSTRAINT "ControlledReadingAssignment_documentId_revisionId_fkey" FOREIGN KEY ("documentId", "revisionId") REFERENCES "ControlledDocumentRevision"("documentId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ControlledReadingAssignment" ADD CONSTRAINT "ControlledReadingAssignment_readerUserId_fkey" FOREIGN KEY ("readerUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Coherencia del estado: una lectura confirmada dice cuándo y quién; una retirada, cuándo y quién.
ALTER TABLE "ControlledReadingAssignment" ADD CONSTRAINT "ControlledReadingAssignment_reader_not_blank" CHECK (length(btrim("readerName")) > 0);
ALTER TABLE "ControlledReadingAssignment" ADD CONSTRAINT "ControlledReadingAssignment_read_complete" CHECK ("status" <> 'READ' OR ("readOn" IS NOT NULL AND "confirmedAt" IS NOT NULL AND length(btrim(coalesce("confirmedByText", ''))) > 0));
ALTER TABLE "ControlledReadingAssignment" ADD CONSTRAINT "ControlledReadingAssignment_withdrawn_complete" CHECK ("status" <> 'WITHDRAWN' OR ("withdrawnAt" IS NOT NULL AND length(btrim(coalesce("withdrawnByText", ''))) > 0));
-- Una sola lectura pendiente por persona y revisión (usuario, o nombre si es externa).
CREATE UNIQUE INDEX "ControlledReadingAssignment_pending_user_key" ON "ControlledReadingAssignment"("revisionId", "readerUserId") WHERE "status" = 'PENDING' AND "readerUserId" IS NOT NULL;
CREATE UNIQUE INDEX "ControlledReadingAssignment_pending_external_key" ON "ControlledReadingAssignment"("revisionId", lower(btrim("readerName"))) WHERE "status" = 'PENDING' AND "readerUserId" IS NULL;

-- Misma protección y captura que las revisiones del PNT.
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ControlledReadingAssignment" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ControlledReadingAssignment" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ControlledReadingAssignment" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ControlledReadingAssignment" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();

INSERT INTO "AuditCaptureTablePolicy" VALUES ('ControlledReadingAssignment',ARRAY['id'],'[{"kind":"PNT","field":"documentId"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ControlledReadingAssignment','assignedAt','INSTANT','VALUE',false),
('ControlledReadingAssignment','assignedByText','STRING','VALUE',false),
('ControlledReadingAssignment','confirmedAt','INSTANT','VALUE',false),
('ControlledReadingAssignment','confirmedByText','STRING','VALUE',false),
('ControlledReadingAssignment','confirmedOnBehalf','BOOLEAN','VALUE',false),
('ControlledReadingAssignment','documentId','STRING','VALUE',false),
('ControlledReadingAssignment','dueDate','DATE','VALUE',false),
('ControlledReadingAssignment','id','STRING','VALUE',false),
('ControlledReadingAssignment','readOn','DATE','VALUE',false),
('ControlledReadingAssignment','readerName','STRING','VALUE',false),
('ControlledReadingAssignment','readerUserId','STRING','VALUE',false),
('ControlledReadingAssignment','revisionId','STRING','VALUE',false),
('ControlledReadingAssignment','status','STRING','VALUE',false),
('ControlledReadingAssignment','withdrawalReason','STRING','VALUE',false),
('ControlledReadingAssignment','withdrawnAt','INSTANT','VALUE',false),
('ControlledReadingAssignment','withdrawnByText','STRING','VALUE',false);
DO $$
DECLARE owner_role TEXT:=pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public."AuditOperation"'::regclass));
BEGIN
 EXECUTE format('GRANT SELECT ON public."ControlledReadingAssignment" TO %I',owner_role);
END;
$$;
COMMIT;
