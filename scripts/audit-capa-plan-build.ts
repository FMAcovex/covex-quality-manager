import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import previous from "../ops/backup/audit-contract-responsible-users.json";
import { responsibleUsersCapturePolicy } from "./audit-responsible-users-build";
import type { CaptureTablePolicy } from "./audit-capture-policy";
import { canonicalAuditJson } from "../src/lib/audit/canonical-json";

// D-110 (R5C1): versiones propias del CAPA plan de auditoría. Tabla nueva,
// inmutable y capturada como AuditAnnualProgrammeVersion; no cambia funciones.
export const capaPlanMigration = "prisma/migrations/20261019000100_audit_capa_plan_versions/migration.sql";
const types: Record<string, string> = { followupDate: "DATE", nextReviewDate: "DATE", generatedAt: "INSTANT", sequenceNumber: "INTEGER", fileSize: "INTEGER" };
// fileData se protege por checksum, no se copia a los eventos.
const fieldPaths = ["auditId", "authenticatedUserId", "checksum", "contentFingerprint", "fileName", "fileSize", "followupDate", "generatedAt", "generatedBy", "id", "kind", "mimeType", "nextReviewDate", "observations", "requestHash", "requestId", "sequenceNumber", "snapshot", "templateChecksum", "templateVersionId"];

export const capaPlanCaptureTable: CaptureTablePolicy = {
  entityType: "AuditCapaPlanVersion", primaryKey: ["id"], rootPaths: [{ via: "auditId", table: "Audit" }], captureMode: "EVENT",
  fields: [...fieldPaths].sort().map(fieldPath => ({ fieldPath, valueType: types[fieldPath] ?? "STRING", transform: fieldPath === "snapshot" ? "SHA256_JSON" : "VALUE", critical: false })),
};
export function capaPlanCapturePolicy() {
  return [...responsibleUsersCapturePolicy(), capaPlanCaptureTable].sort((a, b) => a.entityType < b.entityType ? -1 : a.entityType > b.entityType ? 1 : 0);
}
export function capaPlanPolicySql() {
  return `INSERT INTO "AuditCaptureTablePolicy" VALUES ('AuditCapaPlanVersion',ARRAY['id'],'${JSON.stringify(capaPlanCaptureTable.rootPaths)}'::jsonb,'EVENT');\nINSERT INTO "AuditCaptureFieldPolicy" VALUES\n${capaPlanCaptureTable.fields.map(field => `('AuditCapaPlanVersion','${field.fieldPath}','${field.valueType}','${field.transform}',${field.critical})`).join(",\n")};\n`;
}
export function auditCapaPlanContract() {
  const sql = readFileSync(capaPlanMigration, "utf8");
  const triggers = [...previous.triggers];
  for (const match of sql.matchAll(/CREATE (CONSTRAINT )?TRIGGER (\w+) (BEFORE|AFTER) (INSERT OR UPDATE OR DELETE|UPDATE OR DELETE|TRUNCATE|INSERT) ON "(\w+)" ([\s\S]*?)EXECUTE FUNCTION (\w+)\(\);/g)) {
    const type = match[4] === "TRUNCATE" ? 34 : (match[3] === "BEFORE" ? 2 : 0) + 1 + (match[4].includes("INSERT") ? 4 : 0) + (match[4].includes("UPDATE") ? 16 : 0) + (match[4].includes("DELETE") ? 8 : 0);
    if (match[7].startsWith("covex_")) triggers.push({ name: match[2], table: match[5], function: match[7], type, deferred: !!match[1] });
  }
  return { ...previous, contractVersion: "B2_AUDIT_CAPA_PLAN", guardTables: [...previous.guardTables, "AuditCapaPlanVersion"], triggers,
    capturePolicySha256: createHash("sha256").update(canonicalAuditJson(capaPlanCapturePolicy())).digest("hex") };
}
if (basename(process.argv[1] ?? "") === "audit-capa-plan-build.ts") {
  if (process.argv.includes("--policy")) process.stdout.write(capaPlanPolicySql());
  if (process.argv.includes("--contract")) process.stdout.write(JSON.stringify(auditCapaPlanContract(), null, 2) + "\n");
}
