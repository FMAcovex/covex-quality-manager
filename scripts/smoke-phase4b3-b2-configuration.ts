import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { Prisma, PrismaClient } from "@prisma/client";
import { isolatedTestEnvironment } from "../src/lib/auth/config";

async function main() {
  assert(isolatedTestEnvironment(), "Isolated synthetic environment required");
  const parent = new PrismaClient({ log: [] }), url = new URL(process.env.DATABASE_URL!);
  assert(["127.0.0.1", "localhost"].includes(url.hostname));
  const name = "covex_phase4b1_test_b2_configuration_" + randomBytes(8).toString("hex");
  url.pathname = "/" + name;
  let created = false;
  try {
    await parent.$executeRawUnsafe(`CREATE DATABASE "${name}" TEMPLATE template0`); created = true;
    const env = { ...process.env, DATABASE_URL: url.href };
    for (const command of ["db:deploy", "db:seed", "auth:fixtures"]) {
      const result = spawnSync("pnpm", [command], { env, encoding: "utf8", timeout: 120000 });
      assert.equal(result.status, 0, "Synthetic configuration setup failed: " + command);
    }
    const result = spawnSync("pnpm", ["exec", "vitest", "run", "--config", "scripts/audit-fixtures/vitest.config.ts"], { env, encoding: "utf8", timeout: 120000 });
    if (result.status !== 0) process.stderr.write(result.stdout + result.stderr);
    assert.equal(result.status, 0, "Synthetic configuration PostgreSQL proof failed");
    console.log("B2 configuration atomicity OK: actual authorized actions, authenticated identity, history failure rolls back department and all form-version retirements; successful change/history together. Audit policy capture not yet integrated.");
  } finally {
    if (created) {
      await parent.$queryRaw(Prisma.sql`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=${name} AND pid<>pg_backend_pid()`);
      await parent.$executeRawUnsafe(`DROP DATABASE "${name}"`);
    }
    await parent.$disconnect();
  }
}
main().catch(error => { console.error("Isolated B2 configuration proof failed", error?.name, error?.code); process.exitCode = 1; });
