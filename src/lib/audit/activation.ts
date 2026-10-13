import type { Prisma } from "@prisma/client";

/** Infrastructure status only; it is never an approval or corporate-use claim. */
export async function auditPolicyState(db: Prisma.TransactionClient) {
  const [schema] = await db.$queryRaw<{ installed: boolean }[]>`SELECT to_regclass('public."AuditPolicyRequirement"') IS NOT NULL AS installed`;
  if (!schema?.installed) return { installed: false, required: false, prepared: false, activated: false, corporateUseAuthorized: false };
  const [requirement] = await db.$queryRaw<{ required: boolean }[]>`SELECT EXISTS(SELECT 1 FROM "AuditPolicyRequirement" WHERE "policyVersion"='QMS_B2_V1') AS required`;
  return { installed: true, required: requirement?.required === true, prepared: false, activated: false, corporateUseAuthorized: false };
}
