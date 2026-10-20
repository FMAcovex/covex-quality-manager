BEGIN;
-- D-116: turno del evento en Desviaciones, en la casilla «turno» del Anexo III.
-- Aditivo y opcional: la captura B2 lo registra como un campo de texto más.
ALTER TABLE "Deviation" ADD COLUMN "shift" TEXT;
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('Deviation','shift','STRING','VALUE',false);
COMMIT;
