BEGIN;
-- D-136 (R6): causa raíz de un hallazgo de auditoría para el plan CAPA (Anexo IV del PNT GC-00/033/04),
-- solo cuando el hallazgo no tiene desviación (con desviación se toma la de la desviación). Aditivo y
-- opcional. La captura B2 lo registra como un campo de texto más del hallazgo.
ALTER TABLE "AuditFinding" ADD COLUMN "rootCause" TEXT;
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('AuditFinding','rootCause','STRING','VALUE',false);
COMMIT;
