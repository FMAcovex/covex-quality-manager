-- D-122: modelos de Control de cambios. Configuración que solo prerrellena el alta.
-- Tabla nueva capturada por B2 como AlertRule (raíz de administración/configuración).
BEGIN;
-- CreateTable
CREATE TABLE "ChangeControlModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "departmentId" TEXT,
    "scope" "ChangeControlScope"[] DEFAULT ARRAY[]::"ChangeControlScope"[],
    "otherScope" TEXT,
    "changeDescription" TEXT,
    "justification" TEXT,
    "providedDocuments" TEXT,
    "tasks" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByText" TEXT NOT NULL,
    "updatedByText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeControlModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChangeControlModel_isActive_name_idx" ON "ChangeControlModel"("isActive", "name");

-- CreateIndex
CREATE INDEX "ChangeControlModel_departmentId_idx" ON "ChangeControlModel"("departmentId");

-- AddForeignKey
ALTER TABLE "ChangeControlModel" ADD CONSTRAINT "ChangeControlModel_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChangeControlModel" ADD CONSTRAINT "ChangeControlModel_name_not_blank" CHECK (length(btrim("name")) > 0);
ALTER TABLE "ChangeControlModel" ADD CONSTRAINT "ChangeControlModel_version_positive" CHECK ("version" >= 1);
ALTER TABLE "ChangeControlModel" ADD CONSTRAINT "ChangeControlModel_tasks_array" CHECK (jsonb_typeof("tasks") = 'array');

-- Misma protección y captura que el resto de la configuración (AlertRule).
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ChangeControlModel" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ChangeControlModel" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "ChangeControlModel" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "ChangeControlModel" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();

INSERT INTO "AuditCaptureTablePolicy" VALUES ('ChangeControlModel',ARRAY['id'],'[{"kind":"ADMINISTRATION","category":"CONFIGURATION"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('ChangeControlModel','changeDescription','STRING','VALUE',false),
('ChangeControlModel','createdByText','STRING','VALUE',false),
('ChangeControlModel','departmentId','STRING','VALUE',false),
('ChangeControlModel','id','STRING','VALUE',false),
('ChangeControlModel','isActive','BOOLEAN','VALUE',false),
('ChangeControlModel','justification','STRING','VALUE',false),
('ChangeControlModel','name','STRING','VALUE',false),
('ChangeControlModel','otherScope','STRING','VALUE',false),
('ChangeControlModel','providedDocuments','STRING','VALUE',false),
('ChangeControlModel','purpose','STRING','VALUE',false),
('ChangeControlModel','scope','JSON','VALUE',false),
('ChangeControlModel','tasks','JSON','VALUE',false),
('ChangeControlModel','updatedByText','STRING','VALUE',false),
('ChangeControlModel','version','INTEGER','VALUE',false);
DO $$
DECLARE owner_role TEXT:=pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public."AuditOperation"'::regclass));
BEGIN
 EXECUTE format('GRANT SELECT ON public."ChangeControlModel" TO %I',owner_role);
END;
$$;
COMMIT;
