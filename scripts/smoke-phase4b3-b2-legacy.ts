import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { Prisma, PrismaClient } from "@prisma/client";
import { isolatedTestEnvironment } from "../src/lib/auth/config";

async function main() {
  assert(isolatedTestEnvironment(), "Own isolated synthetic parent required");
  const parent = new PrismaClient({ log: [] }), url = new URL(process.env.DATABASE_URL!);
  const name = "covex_phase4b1_test_b2_legacy_" + randomBytes(8).toString("hex");
  url.pathname = "/" + name; let created = false;
  const commands = process.argv.includes("--quick") ? ["versions:smoke","r2b-documents:smoke"] : ["versions:smoke","r2b-documents:smoke","r3-capa:smoke","changes:smoke","r3-complaints:smoke","r2-returns-documents:smoke","r3-returns:smoke","audits-r4b:smoke","audits-annual:smoke","pnt-p1b2:smoke","pnt-p2a:smoke","pnt-p2b:smoke","pnt-p3c2:smoke"];
  try {
    await parent.$executeRawUnsafe(`CREATE DATABASE "${name}" TEMPLATE template0`); created = true;
    const env = { ...process.env, DATABASE_URL: url.href };
    for (const command of ["db:deploy","db:seed","auth:fixtures",...commands]) {
      const result = spawnSync("pnpm", [command], { env, encoding: "utf8", timeout: 300000 });
      if (result.status !== 0) process.stderr.write(result.stdout + result.stderr);
      assert.equal(result.status, 0, "Original document/version regression failed: " + command);
      if (commands.includes(command)) console.log("Original isolated regression passed:", command);
    }
    console.log("Original document/version regression OK on its own disposable database; no requirement/activation or corporate data.");
  } finally {
    if (created) {
      await parent.$queryRaw(Prisma.sql`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=${name} AND pid<>pg_backend_pid()`);
      await parent.$executeRawUnsafe(`DROP DATABASE "${name}"`);
    }
    await parent.$disconnect();
  }
}
main().catch(error => { console.error("Isolated original regression failed", error.message); process.exitCode = 1; });
