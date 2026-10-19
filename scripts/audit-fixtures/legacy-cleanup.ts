import type { Prisma, PrismaClient } from "@prisma/client";
import { isolatedTestEnvironment } from "../../src/lib/auth/config";

/** Privileged teardown ONLY for legacy synthetic suites. No application import,
 * never an application RPC, and refused if a durable policy or journal covers
 * the fixture. Normal application and owner SQL remain immutable. */
export async function purgeLegacyFixtureDocuments(db: PrismaClient, where: Prisma.RecordVersionDocumentWhereInput,
  env: Record<string, string | undefined> = process.env) {
  if (!isolatedTestEnvironment(env) || !Object.keys(where).length) throw Error("Explicit isolated synthetic fixture scope required");
  const expectedDatabase = new URL(env.DATABASE_URL!).pathname.slice(1);
  await db.$transaction(async tx => {
    const [database] = await tx.$queryRaw<{ name: string; owner: boolean; required: boolean }[]>`SELECT current_database() AS name,
      EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper) OR pg_has_role(current_user,(SELECT relowner FROM pg_class WHERE oid='public."SignedDocumentCustody"'::regclass),'USAGE') AS owner,
      EXISTS(SELECT 1 FROM "AuditPolicyRequirement" WHERE "policyVersion"='QMS_B2_V1') AS required`;
    if (!database || database.name !== expectedDatabase || !database.owner || database.required) throw Error("Non-audited disposable fixture and its controlled owner required");
    // Hold the policy lock through teardown: another connection cannot install
    // a requirement after the check and turn cleanup into an audit bypass.
    await tx.$executeRaw`LOCK TABLE "AuditPolicyRequirement","AuditOperationTarget" IN SHARE MODE`;
    if (await tx.auditPolicyRequirement.count()) throw Error("Durable policy refuses privileged fixture teardown");
    const slots = await tx.recordVersionDocument.findMany({ where, select: { recordVersionId: true, recordVersion: { select: { qmsRecordId: true } } } });
    if (!slots.length) return;
    const versions = [...new Set(slots.map(slot => slot.recordVersionId))], roots = [...new Set(slots.map(slot => "QMS_RECORD:" + slot.recordVersion.qmsRecordId))];
    if (await tx.recordVersionDocument.count({ where: { recordVersionId: { in: versions } } }) !== slots.length) throw Error("Whole fixture versions must be selected for custody teardown");
    if (await tx.auditOperationTarget.count({ where: { rootKey: { in: roots } } })) throw Error("Journal-covered fixture cannot be physically purged");
    const [protection] = await tx.$queryRaw<{ count: bigint }[]>`SELECT count(*) AS count FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND t.tgenabled='O'
      AND (c.oid='public."RecordVersionDocument"'::regclass AND t.tgname='audit_b2_signed_slot' OR c.oid='public."SignedDocumentCustody"'::regclass AND t.tgname='audit_b2_immutable')`;
    if (protection?.count !== BigInt(2)) throw Error("Fixture teardown refuses weakened original protection");
    const originals = await tx.signedDocumentCustody.findMany({ where: { recordVersionId: { in: versions } }, select: { originalDocumentId: true } });
    // Explicit DBA teardown on the OWN disposable database. ALTER is
    // transactional; any error restores both triggers and all rows.
    await tx.$executeRaw`ALTER TABLE "RecordVersionDocument" DISABLE TRIGGER audit_b2_signed_slot`;
    await tx.$executeRaw`ALTER TABLE "SignedDocumentCustody" DISABLE TRIGGER audit_b2_immutable`;
    await tx.recordVersionDocument.updateMany({ where: { recordVersionId: { in: versions } }, data: { custodyId: null } });
    await tx.signedDocumentCustody.deleteMany({ where: { recordVersionId: { in: versions } } });
    await tx.recordVersionDocument.deleteMany({ where });
    if (originals.length) await tx.generatedDocument.deleteMany({ where: { id: { in: originals.map(original => original.originalDocumentId) } } });
    await tx.$executeRaw`ALTER TABLE "SignedDocumentCustody" ENABLE TRIGGER audit_b2_immutable`;
    await tx.$executeRaw`ALTER TABLE "RecordVersionDocument" ENABLE TRIGGER audit_b2_signed_slot`;
  }, { timeout: 30000 });
}

/** D-110 (R5C1): same guarded teardown for immutable CAPA plan versions of
 * synthetic audits on the OWN disposable, non-journaled database. */
export async function purgeFixtureCapaPlanVersions(db: PrismaClient, auditIds: string[], env: Record<string, string | undefined> = process.env) {
  if (!isolatedTestEnvironment(env) || !auditIds.length) return;
  const expectedDatabase = new URL(env.DATABASE_URL!).pathname.slice(1);
  await db.$transaction(async tx => {
    if (!await tx.auditCapaPlanVersion.count({ where: { auditId: { in: auditIds } } })) return;
    const [database] = await tx.$queryRaw<{ name: string; owner: boolean }[]>`SELECT current_database() AS name,
      EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper) OR pg_has_role(current_user,(SELECT relowner FROM pg_class WHERE oid='public."AuditCapaPlanVersion"'::regclass),'USAGE') AS owner`;
    if (!database || database.name !== expectedDatabase || !database.owner) throw Error("Non-audited disposable fixture and its controlled owner required");
    await tx.$executeRaw`LOCK TABLE "AuditPolicyRequirement","AuditOperationTarget" IN SHARE MODE`;
    if (await tx.auditPolicyRequirement.count()) throw Error("Durable policy refuses privileged fixture teardown");
    const roots = (await tx.audit.findMany({ where: { id: { in: auditIds } }, select: { qmsRecordId: true } })).map(audit => "QMS_RECORD:" + audit.qmsRecordId);
    if (await tx.auditOperationTarget.count({ where: { rootKey: { in: roots } } })) throw Error("Journal-covered fixture cannot be physically purged");
    await tx.$executeRaw`ALTER TABLE "AuditCapaPlanVersion" DISABLE TRIGGER immutable_audit_capa_plan_version`;
    await tx.auditCapaPlanVersion.deleteMany({ where: { auditId: { in: auditIds } } });
    await tx.$executeRaw`ALTER TABLE "AuditCapaPlanVersion" ENABLE TRIGGER immutable_audit_capa_plan_version`;
  }, { timeout: 30000 });
}
