import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import previous from "../ops/backup/audit-contract-b2-documents.json";
import { documentCapturePolicy } from "./audit-document-build";
import { canonicalAuditJson } from "../src/lib/audit/canonical-json";

export const stagingMigration = "prisma/migrations/20261013000600_b2_staging_channel/migration.sql";
export function stagingCapturePolicy() {
  return documentCapturePolicy().map(table => table.entityType === "ControlledDocumentImportRow"
    ? { ...table, fields: [...table.fields, { fieldPath: "result", valueType: "JSON", transform: "VALUE", critical: false }].sort((a,b) => a.fieldPath < b.fieldPath ? -1 : a.fieldPath > b.fieldPath ? 1 : 0) } : table);
}
export function auditStagingContract() {
  const sql = readFileSync(stagingMigration, "utf8");
  const functions: Record<string, { sha256: string; definer: boolean }> = { ...previous.functions };
  for (const match of sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION (covex_\w+)\([\s\S]*? AS \$\$([\s\S]*?)\$\$;/g)) functions[match[1]] = { sha256: createHash("sha256").update(match[2]).digest("hex"), definer: match[0].includes("SECURITY DEFINER") };
  const triggers = [...previous.triggers];
  for (const match of sql.matchAll(/CREATE (CONSTRAINT )?TRIGGER (\w+) (BEFORE|AFTER) (INSERT OR UPDATE OR DELETE|UPDATE OR DELETE|TRUNCATE|INSERT) ON "(\w+)" ([\s\S]*?)EXECUTE FUNCTION (\w+)\(\);/g)) {
    const type = match[4] === "TRUNCATE" ? 34 : (match[3] === "BEFORE" ? 2 : 0) + 1 + (match[4].includes("INSERT") ? 4 : 0) + (match[4].includes("UPDATE") ? 16 : 0) + (match[4].includes("DELETE") ? 8 : 0);
    triggers.push({ name: match[2], table: match[5], function: match[7], type, deferred: !!match[1] });
  }
  return { ...previous, contractVersion: "B2_STAGING_CHANNEL", tables: [...previous.tables, "AuditTechnicalContext", "AuditTechnicalEvent"],
    privateTables: [...previous.privateTables, "AuditTechnicalContext"], functions, triggers,
    capturePolicySha256: createHash("sha256").update(canonicalAuditJson(stagingCapturePolicy())).digest("hex") };
}
if (basename(process.argv[1] ?? "") === "audit-staging-build.ts" && process.argv.includes("--contract")) process.stdout.write(JSON.stringify(auditStagingContract(), null, 2) + "\n");
