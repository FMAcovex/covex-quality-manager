BEGIN;
-- D-123: herramientas de análisis guiadas en la investigación de Desviaciones (5 porqués,
-- Ishikawa 6M y brainstorming). Aditivo y opcional: la captura B2 lo registra como un campo JSON más.
ALTER TABLE "Deviation" ADD COLUMN "investigationTools" JSONB;
ALTER TABLE "Deviation" ADD CONSTRAINT "Deviation_investigationTools_object_check"
  CHECK ("investigationTools" IS NULL OR jsonb_typeof("investigationTools") = 'object');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('Deviation','investigationTools','JSON','VALUE',false);
COMMIT;
