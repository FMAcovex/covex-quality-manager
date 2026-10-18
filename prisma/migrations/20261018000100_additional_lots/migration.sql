BEGIN;
-- D-094: otros lotes afectados además del principal en Desviaciones, Reclamaciones y OOS.
-- Aditivo: la captura B2 registra la lista como un campo JSON más.
ALTER TABLE "Deviation" ADD COLUMN "additionalLots" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Complaint" ADD COLUMN "additionalLots" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "OosRecord" ADD COLUMN "additionalLots" JSONB NOT NULL DEFAULT '[]';
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('Deviation','additionalLots','JSON','VALUE',false),
('Complaint','additionalLots','JSON','VALUE',false),
('OosRecord','additionalLots','JSON','VALUE',false);
COMMIT;
