import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import previous from "../ops/backup/audit-contract-b2-staging.json";

export const criticalMigration = "prisma/migrations/20261013000700_b2_critical_integrity/migration.sql";
export function auditCriticalContract() {
  const sql = readFileSync(criticalMigration,"utf8"), functions: Record<string,{sha256:string;definer:boolean}> = {...previous.functions};
  for (const match of sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION (covex_\w+)\([\s\S]*? AS \$\$([\s\S]*?)\$\$;/g)) functions[match[1]] = {sha256:createHash("sha256").update(match[2]).digest("hex"),definer:match[0].includes("SECURITY DEFINER")};
  const triggers = [...previous.triggers];
  for (const match of sql.matchAll(/CREATE (CONSTRAINT )?TRIGGER (\w+) (BEFORE|AFTER) (INSERT OR UPDATE OR DELETE|UPDATE OR DELETE|TRUNCATE|INSERT) ON "(\w+)" ([\s\S]*?)EXECUTE FUNCTION (\w+)\(\);/g)) {
    const type = match[4]==="TRUNCATE"?34:(match[3]==="BEFORE"?2:0)+1+(match[4].includes("INSERT")?4:0)+(match[4].includes("UPDATE")?16:0)+(match[4].includes("DELETE")?8:0);
    triggers.push({name:match[2],table:match[5],function:match[7],type,deferred:!!match[1]});
  }
  return {...previous,contractVersion:"B2_CRITICAL_INTEGRITY",tables:[...previous.tables,"AuditRootMaturity","AuditOperationAssessment"],privateTables:[...previous.privateTables,"AuditRootMaturity"],functions,triggers};
}
if (basename(process.argv[1]??"")==="audit-critical-build.ts" && process.argv.includes("--contract")) process.stdout.write(JSON.stringify(auditCriticalContract(),null,2)+"\n");
