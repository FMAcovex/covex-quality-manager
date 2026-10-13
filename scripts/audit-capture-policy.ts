import { readFileSync } from "node:fs";
import { basename } from "node:path";
import foundation from "../ops/backup/audit-contract-b2.json";

export type CaptureFieldPolicy = { fieldPath: string; valueType: string; transform: string; critical: boolean };
export type CaptureTablePolicy = { entityType: string; primaryKey: string[]; rootPaths: Record<string, string>[]; captureMode: string; fields: CaptureFieldPolicy[] };

/** Freeze published metadata: later Prisma fields cannot rewrite an applied
 * policy/hash/migration. New releases explicitly extend it with additive SQL. */
export function auditCapturePolicy(): CaptureTablePolicy[] {
  const sql = readFileSync("prisma/migrations/20261013000300_b2_sql_capture/migration.sql", "utf8");
  const tables: CaptureTablePolicy[] = [];
  const pattern = /INSERT INTO "AuditCaptureTablePolicy" VALUES \('([\w]+)',ARRAY\[([^\]]+)\],'([^']+)'::jsonb,'(EVENT|EVIDENCE)'\);\nINSERT INTO "AuditCaptureFieldPolicy" VALUES\n([\s\S]*?);/g;
  for (const match of sql.matchAll(pattern)) {
    const fields: CaptureFieldPolicy[] = [];
    for (const field of match[5].matchAll(/\('([\w]+)','([\w]+)','([\w]+)','([\w]+)',(true|false)\)/g)) {
      if (field[1] !== match[1]) throw Error("Published field/table identity mismatch");
      fields.push({ fieldPath: field[2], valueType: field[3], transform: field[4], critical: field[5] === "true" });
    }
    const primaryKey = [...match[2].matchAll(/'([\w]+)'/g)].map(key => key[1]);
    const rootPaths = JSON.parse(match[3]) as Record<string, string>[];
    if (!primaryKey.length || !rootPaths.length || !fields.length) throw Error("Incomplete published capture metadata");
    tables.push({ entityType: match[1], primaryKey, rootPaths, captureMode: match[4], fields });
  }
  if (JSON.stringify(tables.map(t => t.entityType)) !== JSON.stringify(foundation.guardTables)) throw Error("Published capture table inventory mismatch");
  return tables;
}
export function auditCapturePolicySql() {
  const quote = (s: string) => "'" + s.replaceAll("'", "''") + "'";
  return auditCapturePolicy().map(table => [
    `INSERT INTO "AuditCaptureTablePolicy" VALUES (${quote(table.entityType)},ARRAY[${table.primaryKey.map(quote).join(",")}],${quote(JSON.stringify(table.rootPaths))}::jsonb,${quote(table.captureMode)});`,
    `INSERT INTO "AuditCaptureFieldPolicy" VALUES\n${table.fields.map(f => `(${[table.entityType, f.fieldPath, f.valueType, f.transform].map(quote).join(",")},${f.critical})`).join(",\n")};`,
  ].join("\n")).join("\n");
}
if (basename(process.argv[1] ?? "") === "audit-capture-policy.ts") {
  if (process.argv.includes("--sql")) process.stdout.write(auditCapturePolicySql());
  else if (process.argv.includes("--print")) process.stdout.write(JSON.stringify(auditCapturePolicy(), null, 2) + "\n");
}
