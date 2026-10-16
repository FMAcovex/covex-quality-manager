-- D-083 MC-4, etapa 2: retira del enum los tipos de relación que ninguna regla
-- admite (RELATED_TO, IMPLEMENTED_BY, ASSOCIATED_WITH). La migración se detiene
-- sin cambiar nada si alguna relación, activa o inactiva, usa uno de ellos.
-- Sin BEGIN/COMMIT explícitos: el script se ejecuta como una sola transacción
-- implícita y así el error de la comprobación llega íntegro al operador.
DO $$
DECLARE
  in_use BIGINT;
BEGIN
  SELECT count(*) INTO in_use FROM "QmsRelation"
  WHERE "relationType"::text IN ('RELATED_TO', 'IMPLEMENTED_BY', 'ASSOCIATED_WITH');
  IF in_use > 0 THEN
    RAISE EXCEPTION 'MC-4: % relaciones usan RELATED_TO, IMPLEMENTED_BY o ASSOCIATED_WITH; deben revisarse antes de retirar esos tipos', in_use;
  END IF;
END $$;

CREATE TYPE "QmsRelationType_new" AS ENUM ('GENERATES');
ALTER TABLE "QmsRelation" ALTER COLUMN "relationType" TYPE "QmsRelationType_new" USING ("relationType"::text::"QmsRelationType_new");
ALTER TYPE "QmsRelationType" RENAME TO "QmsRelationType_old";
ALTER TYPE "QmsRelationType_new" RENAME TO "QmsRelationType";
DROP TYPE "QmsRelationType_old";
