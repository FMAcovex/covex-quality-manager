BEGIN;
-- D-134 (R6): firmantes de los documentos de una auditoría (informe y CAPA plan), con varias
-- personas por función. Aditivo: los expedientes anteriores siguen usando elaborado/revisado/recibido
-- hasta que se registre la lista. La captura B2 lo registra como un campo JSON más de Audit.
ALTER TABLE "Audit" ADD COLUMN "signatories" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_signatories_array_check"
  CHECK (jsonb_typeof("signatories") = 'array');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('Audit','signatories','JSON','VALUE',false);
COMMIT;
