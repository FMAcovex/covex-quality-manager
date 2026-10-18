BEGIN;
-- Categoría de causa raíz (6M), complementaria a la causa raíz redactada, en Desviaciones,
-- CAPA, Reclamaciones y OOS. Aditivo: la captura B2 registra el campo como el resto.
CREATE TYPE "RootCauseCategory" AS ENUM ('PEOPLE', 'METHOD', 'MACHINE', 'MATERIAL', 'ENVIRONMENT', 'MEASUREMENT', 'UNDETERMINED');
ALTER TABLE "Deviation" ADD COLUMN "rootCauseCategories" "RootCauseCategory"[] DEFAULT ARRAY[]::"RootCauseCategory"[];
ALTER TABLE "Capa" ADD COLUMN "rootCauseCategories" "RootCauseCategory"[] DEFAULT ARRAY[]::"RootCauseCategory"[];
ALTER TABLE "Complaint" ADD COLUMN "rootCauseCategories" "RootCauseCategory"[] DEFAULT ARRAY[]::"RootCauseCategory"[];
ALTER TABLE "OosRecord" ADD COLUMN "rootCauseCategories" "RootCauseCategory"[] DEFAULT ARRAY[]::"RootCauseCategory"[];
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('Deviation','rootCauseCategories','JSON','VALUE',false),
('Capa','rootCauseCategories','JSON','VALUE',false),
('Complaint','rootCauseCategories','JSON','VALUE',false),
('OosRecord','rootCauseCategories','JSON','VALUE',false);
COMMIT;
