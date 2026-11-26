BEGIN;
-- D-141: permisos de las lecturas de PNT. «Marcar sus propias lecturas» lo necesita cualquier lector
-- (incluido el usuario de consulta): la captura B2 no admite escrituras con READ. «Confirmar lecturas
-- de otros» es de Garantía de Calidad. Las políticas de rol los asignan; esta migración no concede nada.

ALTER TYPE "AccessPermission" ADD VALUE IF NOT EXISTS 'PNT_READING_SELF';
ALTER TYPE "AccessPermission" ADD VALUE IF NOT EXISTS 'PNT_READING_CONFIRM';

COMMIT;
