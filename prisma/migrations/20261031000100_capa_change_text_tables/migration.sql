BEGIN;
-- D-127 (segunda parte): tablas editables en los textos largos de CAPA y Controles de cambios, por campo.
-- Aditivo y opcional: la captura B2 lo registra como un campo JSON más en cada tabla.
ALTER TABLE "Capa" ADD COLUMN "textTables" JSONB;
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_textTables_object_check"
  CHECK ("textTables" IS NULL OR jsonb_typeof("textTables") = 'object');
ALTER TABLE "ChangeControl" ADD COLUMN "textTables" JSONB;
ALTER TABLE "ChangeControl" ADD CONSTRAINT "ChangeControl_textTables_object_check"
  CHECK ("textTables" IS NULL OR jsonb_typeof("textTables") = 'object');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('Capa','textTables','JSON','VALUE',false),
('ChangeControl','textTables','JSON','VALUE',false);
COMMIT;
