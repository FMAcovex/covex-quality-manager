import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { Prisma, PrismaClient } from "@prisma/client";
import { isolatedTestEnvironment } from "../src/lib/auth/config";
import { auditApplicationFixture, auditedSqlFixture } from "./audit-fixtures/database";
import { fixtureUsers } from "./auth-fixtures/constants";
import { assertAuditProtection } from "../src/lib/audit/protection";
import { auditPolicyState } from "../src/lib/audit/activation";
import { identityContext } from "../src/lib/auth/context";

async function main() {
  assert(isolatedTestEnvironment(), "Isolated synthetic environment required");
  const parent = new PrismaClient({ log: [] }), url = new URL(process.env.DATABASE_URL!);
  assert(["127.0.0.1", "localhost"].includes(url.hostname));
  const suffix = randomBytes(8).toString("hex"), name = "covex_phase4b1_test_b2_requirement_" + suffix;
  const ownerRole = "covex4b3_owner_" + suffix, migratorRole = "covex4b3_migrator_" + suffix, appRole = "covex4b3_requirement_" + suffix;
  const secret = randomBytes(32).toString("hex");
  let owner: PrismaClient | undefined, application: PrismaClient | undefined, globalClient: PrismaClient | undefined, created = false;
  const previousUrl = process.env.DATABASE_URL;
  const roles: string[] = [];
  try {
    await parent.$executeRawUnsafe(`CREATE ROLE "${ownerRole}" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`); roles.push(ownerRole);
    await parent.$executeRawUnsafe(`CREATE ROLE "${migratorRole}" LOGIN PASSWORD '${secret}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`); roles.push(migratorRole);
    await parent.$executeRawUnsafe(`GRANT "${ownerRole}" TO "${migratorRole}"`);
    await parent.$executeRawUnsafe(`CREATE DATABASE "${name}" OWNER "${migratorRole}" TEMPLATE template0`); created = true;
    await parent.$executeRawUnsafe(`ALTER DATABASE "${name}" SET "covex.audit_owner_role" TO '${ownerRole}'`);
    url.pathname = "/" + name; url.username = migratorRole; url.password = secret;
    for (const command of ["db:deploy", "db:seed", "auth:fixtures"]) {
      const result = spawnSync("pnpm", [command], { env: { ...process.env, DATABASE_URL: url.href }, encoding: "utf8", timeout: 120000 });
      assert.equal(result.status, 0, "Synthetic requirement setup failed: " + command);
    }
    owner = new PrismaClient({ datasourceUrl: url.href, log: [] });
    application = await auditApplicationFixture(owner, url, appRole, parent); roles.push(appRole);
    await owner.$executeRawUnsafe(`GRANT INSERT,UPDATE,DELETE ON "QmsRecord","Department" TO "${appRole}"`);
    const state = await auditPolicyState(application);
    assert.deepEqual(state, { installed: true, required: false, prepared: false, activated: false, corporateUseAuthorized: false });
    const department = await owner.department.findFirstOrThrow();
    const deviation = await owner.deviation.create({ data: { department: { connect: { id: department.id } }, status: "OPEN", qmsRecord: { create: { recordType: "DEVIATION", businessCode: "SYNTHETIC-B2-REQUIRED-" + suffix, year: 2026 } } } });
    await owner.auditPilotRecord.create({ data: { qmsRecordId: deviation.qmsRecordId } });
    await application.qmsRecord.update({ where: { id: deviation.qmsRecordId }, data: { isActive: true } });
    await owner.$executeRaw(Prisma.sql`SELECT covex_b2_require_policy('SYNTHETIC requirement fixture; not an approval')`);
    const required = await auditPolicyState(application);
    assert(required.required && !required.prepared && !required.activated);
    const row = await owner.auditPolicyRequirement.findUniqueOrThrow({ where: { policyVersion: "QMS_B2_V1" } });
    assert.equal(row.requestedByDatabasePrincipal, migratorRole);
    assert.equal(await application.qmsRecord.count(), await owner.qmsRecord.count(), "Global consultation remains available");
    const before = await owner.qmsRecord.findUniqueOrThrow({ where: { id: deviation.qmsRecordId } });
    await assert.rejects(application.qmsRecord.update({ where: { id: before.id }, data: { businessCode: "FORGED" } }));
    await assert.rejects(application.qmsRecord.updateMany({ where: { id: before.id }, data: { isActive: false } }));
    await assert.rejects(application.qmsRecord.deleteMany({ where: { id: before.id } }));
    await assert.rejects(application.department.create({ data: { code: "FORGED", name: "No policy" } }));
    await assert.rejects(owner.$executeRawUnsafe('TRUNCATE "Department" CASCADE'), "Statement-level writes are blocked too");
    await assert.rejects(application.$transaction(async tx => {
      await tx.$executeRaw(Prisma.sql`SELECT set_config('covex.audit.enabled','false',true)`);
      await tx.qmsRecord.update({ where: { id: before.id }, data: { businessCode: "FORGED" } });
    }));
    const [privilege] = await application.$queryRaw<{ allowed: boolean }[]>`SELECT has_function_privilege(current_user,'public.covex_b2_require_policy(text)','EXECUTE') AS allowed`;
    assert.equal(privilege.allowed, false);
    await assert.rejects(application.$executeRaw`SELECT covex_b2_require_policy('SYNTHETIC requirement fixture; not an approval')`);
    await assert.rejects(application.auditPolicyRequirement.deleteMany());
    await assert.rejects(application.$executeRawUnsafe('TRUNCATE "AuditPolicyRequirement"'));
    await assert.rejects(owner.auditPolicyRequirement.deleteMany(), "Ordinary owner DML cannot unset the requirement either");
    assert.deepEqual(await owner.qmsRecord.findUniqueOrThrow({ where: { id: before.id } }), before);
    assert.equal(await owner.auditOperation.count(), 0, "No business success/event fabricated");
    // The already isolated B1 numeric policy remains usable under the requirement.
    await auditedSqlFixture(application, fixtureUsers.qa.id, [before.id], randomUUID(), 3);
    assert.equal(await owner.auditEvent.count(), 2);
    process.env.DATABASE_URL = url.href;
    const { issueSession, sessionFromToken } = await import("../src/lib/auth/session");
    globalClient = (await import("../src/lib/db")).prisma;
    const principal = (await sessionFromToken((await issueSession(fixtureUsers.qa.id)).token)).principal;
    const { updateAuditPilot } = await import("../src/lib/audit/service");
    await identityContext.run({ principal }, () => updateAuditPilot({ requestId: randomUUID(), reason: "Synthetic numeric history under requirement", changes: [{ qmsRecordId: before.id, value: 4 }] }, application));
    assert.equal(await owner.auditEvent.count(), 4);
    assert.equal((await owner.changeHistory.findFirstOrThrow({ where: { fieldPath: "__synthetic_audit_pilot__" } })).authenticatedUserId, principal.id);
    await owner.$transaction(tx => assertAuditProtection(tx));
    await owner.$executeRawUnsafe('ALTER TABLE "Department" DISABLE TRIGGER audit_b2_required');
    await assert.rejects(owner.$transaction(tx => assertAuditProtection(tx)), "Missing requirement guard detected");
    await owner.$executeRawUnsafe('ALTER TABLE "Department" ENABLE TRIGGER audit_b2_required');
    await owner.$transaction(tx => assertAuditProtection(tx));
    console.log("B2 requirement OK: three database duties separated; installation inactive; durable requirement blocks direct/bulk/independent writes without policy; no GUC bypass or ordinary removal; global reads and isolated B1 pilot preserved; disabled guard detected. No B2 capture or corporate activation claimed.");
  } finally {
    await application?.$disconnect(); await owner?.$disconnect(); await globalClient?.$disconnect();
    process.env.DATABASE_URL = previousUrl;
    if (created) {
      await parent.$queryRaw(Prisma.sql`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=${name} AND pid<>pg_backend_pid()`);
      await parent.$executeRawUnsafe(`DROP DATABASE "${name}"`);
    }
    for (const role of roles.reverse()) await parent.$executeRawUnsafe(`DROP ROLE IF EXISTS "${role}"`);
    await parent.$disconnect();
  }
}
main().catch(error => { console.error("Isolated B2 requirement proof failed", error?.name, error?.code, error?.stack?.split("\n").filter((line: string) => line.trim().startsWith("at ") && !line.includes("node_modules")).slice(0,3)); process.exitCode = 1; });
