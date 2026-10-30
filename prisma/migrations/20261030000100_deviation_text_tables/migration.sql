BEGIN;
-- D-127: tablas editables en los textos largos de Desviaciones, por campo (título, cabecera y filas).
-- Aditivo y opcional: la captura B2 lo registra como un campo JSON más.
ALTER TABLE "Deviation" ADD COLUMN "textTables" JSONB;
ALTER TABLE "Deviation" ADD CONSTRAINT "Deviation_textTables_object_check"
  CHECK ("textTables" IS NULL OR jsonb_typeof("textTables") = 'object');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('Deviation','textTables','JSON','VALUE',false);
COMMIT;
