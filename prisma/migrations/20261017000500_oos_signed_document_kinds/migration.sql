-- D-088, OOS-4: PDF firmado de los Anexos III y IV de OOS. Valores añadidos al
-- final del enum para no alterar el orden de los existentes.
ALTER TYPE "RecordVersionDocumentKind" ADD VALUE 'OOS_ANNEX_III_SIGNED';
ALTER TYPE "RecordVersionDocumentKind" ADD VALUE 'OOS_ANNEX_IV_SIGNED';
