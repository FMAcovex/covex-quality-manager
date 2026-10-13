import type { Prisma } from "@prisma/client";
import { AuditEngineError } from "./domain";

/** Infrastructure status only; it is never an approval or corporate-use claim. */
export async function auditPolicyState(db: Prisma.TransactionClient) {
  const [schema] = await db.$queryRaw<{ installed: boolean }[]>`SELECT to_regclass('public."AuditPolicyRequirement"') IS NOT NULL AS installed`;
  if (!schema?.installed) {
    const [migrations] = await db.$queryRaw<{ present: boolean }[]>`SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present`;
    if (migrations?.present) {
      const [missing] = await db.$queryRaw<{ installed: boolean }[]>`SELECT EXISTS(SELECT 1 FROM "_prisma_migrations" WHERE migration_name='20261013000200_b2_audit_requirement' AND finished_at IS NOT NULL AND rolled_back_at IS NULL) AS installed`;
      if (missing?.installed) throw new AuditEngineError("PROTECTION");
    }
    return { installed: false, required: false, prepared: false, activated: false, corporateUseAuthorized: false };
  }
  const [requirement] = await db.$queryRaw<{ required: boolean }[]>`SELECT EXISTS(SELECT 1 FROM "AuditPolicyRequirement" WHERE "policyVersion"='QMS_B2_V1') AS required`;
  return { installed: true, required: requirement?.required === true, prepared: false, activated: false, corporateUseAuthorized: false };
}
