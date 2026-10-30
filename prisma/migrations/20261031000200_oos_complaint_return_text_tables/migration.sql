BEGIN;
-- D-127 (tercera parte): tablas editables en los textos largos de OOS, Reclamaciones y Devoluciones,
-- por campo. Aditivo y opcional: la captura B2 lo registra como un campo JSON más en cada tabla.
ALTER TABLE "OosRecord" ADD COLUMN "textTables" JSONB;
ALTER TABLE "OosRecord" ADD CONSTRAINT "OosRecord_textTables_object_check"
  CHECK ("textTables" IS NULL OR jsonb_typeof("textTables") = 'object');
ALTER TABLE "Complaint" ADD COLUMN "textTables" JSONB;
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_textTables_object_check"
  CHECK ("textTables" IS NULL OR jsonb_typeof("textTables") = 'object');
ALTER TABLE "ReturnRecord" ADD COLUMN "textTables" JSONB;
ALTER TABLE "ReturnRecord" ADD CONSTRAINT "ReturnRecord_textTables_object_check"
  CHECK ("textTables" IS NULL OR jsonb_typeof("textTables") = 'object');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('Complaint','textTables','JSON','VALUE',false),
('OosRecord','textTables','JSON','VALUE',false),
('ReturnRecord','textTables','JSON','VALUE',false);
COMMIT;
