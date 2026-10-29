import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import previous from "../ops/backup/audit-contract-pnt-assignments.json";
import { pntAssignmentsCapturePolicy } from "./audit-pnt-assignments-build";
import type { CaptureTablePolicy } from "./audit-capture-policy";
import { canonicalAuditJson } from "../src/lib/audit/canonical-json";

// D-122: modelos de Control de cambios. Tabla de configuración nueva, capturada como AlertRule
// (raíz de administración/configuración, sin createdAt/updatedAt); no cambia funciones.
export const changeModelsMigration = "prisma/migrations/20261029000100_change_control_models/migration.sql";
const types: Record<string, string> = { isActive: "BOOLEAN", version: "INTEGER", scope: "JSON", tasks: "JSON" };
const fieldPaths = ["changeDescription", "createdByText", "departmentId", "id", "isActive", "justification", "name", "otherScope", "providedDocuments", "purpose", "scope", "tasks", "updatedByText", "version"];

export const changeModelsCaptureTable: CaptureTablePolicy = {
  entityType: "ChangeControlModel", primaryKey: ["id"], rootPaths: [{ kind: "ADMINISTRATION", category: "CONFIGURATION" }], captureMode: "EVENT",
  fields: [...fieldPaths].sort().map(fieldPath => ({ fieldPath, valueType: types[fieldPath] ?? "STRING", transform: "VALUE", critical: false })),
};
export function changeModelsCapturePolicy() {
  return [...pntAssignmentsCapturePolicy(), changeModelsCaptureTable].sort((a, b) => a.entityType < b.entityType ? -1 : a.entityType > b.entityType ? 1 : 0);
}
export function changeModelsPolicySql() {
  return `INSERT INTO "AuditCaptureTablePolicy" VALUES ('ChangeControlModel',ARRAY['id'],'${JSON.stringify(changeModelsCaptureTable.rootPaths)}'::jsonb,'EVENT');\nINSERT INTO "AuditCaptureFieldPolicy" VALUES\n${changeModelsCaptureTable.fields.map(field => `('ChangeControlModel','${field.fieldPath}','${field.valueType}','${field.transform}',${field.critical})`).join(",\n")};\n`;
}
export function auditChangeModelsContract() {
  const sql = readFileSync(changeModelsMigration, "utf8");
  const triggers = [...previous.triggers];
  for (const match of sql.matchAll(/CREATE (CONSTRAINT )?TRIGGER (\w+) (BEFORE|AFTER) (INSERT OR UPDATE OR DELETE|UPDATE OR DELETE|TRUNCATE|INSERT) ON "(\w+)" ([\s\S]*?)EXECUTE FUNCTION (\w+)\(\);/g)) {
    const type = match[4] === "TRUNCATE" ? 34 : (match[3] === "BEFORE" ? 2 : 0) + 1 + (match[4].includes("INSERT") ? 4 : 0) + (match[4].includes("UPDATE") ? 16 : 0) + (match[4].includes("DELETE") ? 8 : 0);
    if (match[7].startsWith("covex_")) triggers.push({ name: match[2], table: match[5], function: match[7], type, deferred: !!match[1] });
  }
  return { ...previous, contractVersion: "B2_CHANGE_CONTROL_MODELS", guardTables: [...previous.guardTables, "ChangeControlModel"], triggers,
    capturePolicySha256: createHash("sha256").update(canonicalAuditJson(changeModelsCapturePolicy())).digest("hex") };
}
if (basename(process.argv[1] ?? "") === "audit-change-models-build.ts") {
  if (process.argv.includes("--policy")) process.stdout.write(changeModelsPolicySql());
  if (process.argv.includes("--contract")) process.stdout.write(JSON.stringify(auditChangeModelsContract(), null, 2) + "\n");
}
