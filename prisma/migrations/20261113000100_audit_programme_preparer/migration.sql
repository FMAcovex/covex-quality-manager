BEGIN;
-- D-135 (R6): «Elaborado por» del Programa Anual de Auditorías (Anexo V de los PNT GC-00/033/04 y
-- GC-00/034/05). Aditivo y opcional. La captura B2 lo registra como un campo de texto más del plan.
ALTER TABLE "AuditAnnualPlan" ADD COLUMN "preparedByName" TEXT;
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('AuditAnnualPlan','preparedByName','STRING','VALUE',false);
COMMIT;
