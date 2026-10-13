import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import previous from "../ops/backup/audit-contract-b2-integration.json";
import { auditCapturePolicy, type CaptureTablePolicy } from "./audit-capture-policy";
import { canonicalAuditJson } from "../src/lib/audit/canonical-json";

export const documentMigration = "prisma/migrations/20261013000500_b2_signed_originals/migration.sql";
export function documentCapturePolicy() {
  const fields = ["id", "originalDocumentId", "recordVersionId", "kind", "sourceKind", "identitySource", "retainedByUserId", "retainedByName", "retainedAt", "replacesId", "reason"].sort().map(fieldPath => ({ fieldPath, valueType: fieldPath === "retainedAt" ? "INSTANT" : "STRING", transform: "VALUE", critical: false }));
  const addition: CaptureTablePolicy = { entityType: "SignedDocumentCustody", primaryKey: ["id"], rootPaths: [{ via: "recordVersionId", table: "QmsRecordVersion" }], captureMode: "EVENT", fields };
  return [...auditCapturePolicy().map(table => table.entityType === "RecordVersionDocument" ? { ...table, fields: [...table.fields, { fieldPath: "custodyId", valueType: "STRING", transform: "VALUE", critical: false }].sort((a,b) => a.fieldPath < b.fieldPath ? -1 : a.fieldPath > b.fieldPath ? 1 : 0) } : table), addition].sort((a,b) => a.entityType < b.entityType ? -1 : a.entityType > b.entityType ? 1 : 0);
}
export function documentPolicySql() {
  const table = documentCapturePolicy().find(p => p.entityType === "SignedDocumentCustody")!;
  return `INSERT INTO "AuditCaptureTablePolicy" VALUES ('SignedDocumentCustody',ARRAY['id'],'${JSON.stringify(table.rootPaths)}'::jsonb,'EVENT');\nINSERT INTO "AuditCaptureFieldPolicy" VALUES\n${table.fields.map(field => `('SignedDocumentCustody','${field.fieldPath}','${field.valueType}','${field.transform}',false)`).join(",\n")};\nINSERT INTO "AuditCaptureFieldPolicy" VALUES ('RecordVersionDocument','custodyId','STRING','VALUE',false);\n`;
}
export function auditDocumentContract() {
  const sql = readFileSync(documentMigration, "utf8");
  const functions: Record<string, { sha256: string; definer: boolean }> = { ...previous.functions };
  for (const match of sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION (covex_\w+)\([\s\S]*? AS \$\$([\s\S]*?)\$\$;/g)) functions[match[1]] = { sha256: createHash("sha256").update(match[2]).digest("hex"), definer: match[0].includes("SECURITY DEFINER") };
  const triggers = [...previous.triggers];
  for (const match of sql.matchAll(/CREATE (CONSTRAINT )?TRIGGER (\w+) (BEFORE|AFTER) (INSERT OR UPDATE OR DELETE|UPDATE OR DELETE|TRUNCATE|INSERT) ON "(\w+)" ([\s\S]*?)EXECUTE FUNCTION (\w+)\(\);/g)) {
    const type = match[4] === "TRUNCATE" ? 34 : (match[3] === "BEFORE" ? 2 : 0) + 1 + (match[4].includes("INSERT") ? 4 : 0) + (match[4].includes("UPDATE") ? 16 : 0) + (match[4].includes("DELETE") ? 8 : 0);
    triggers.push({ name: match[2], table: match[5], function: match[7], type, deferred: !!match[1] });
  }
  return { ...previous, contractVersion: "B2_SIGNED_ORIGINALS", tables: [...previous.tables, "SignedDocumentCustody"], guardTables: [...previous.guardTables, "SignedDocumentCustody"], functions, triggers,
    capturePolicySha256: createHash("sha256").update(canonicalAuditJson(documentCapturePolicy())).digest("hex") };
}
if (basename(process.argv[1] ?? "") === "audit-document-build.ts") {
  if (process.argv.includes("--policy")) process.stdout.write(documentPolicySql());
  if (process.argv.includes("--contract")) process.stdout.write(JSON.stringify(auditDocumentContract(), null, 2) + "\n");
}
