import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import previous from "../ops/backup/audit-contract-audit-finding-root-cause.json";
import { auditFindingRootCauseCapturePolicy } from "./audit-finding-root-cause-build";
import type { CaptureTablePolicy } from "./audit-capture-policy";
import { canonicalAuditJson } from "../src/lib/audit/canonical-json";

// D-141: lecturas de PNT. Tabla nueva con raíz en el PNT (como ControlledDocumentRevision), capturada
// sin fechas técnicas (createdAt/updatedAt); no cambia funciones. Control operativo: ningún campo crítico.
export const pntReadingsMigration = "prisma/migrations/20261126000200_pnt_readings/migration.sql";
const types: Record<string, string> = {
  dueDate: "DATE", readOn: "DATE", assignedAt: "INSTANT", confirmedAt: "INSTANT", withdrawnAt: "INSTANT", confirmedOnBehalf: "BOOLEAN",
};
const fieldPaths = ["assignedAt", "assignedByText", "confirmedAt", "confirmedByText", "confirmedOnBehalf", "documentId", "dueDate", "id", "readOn", "readerName", "readerUserId", "revisionId", "status", "withdrawalReason", "withdrawnAt", "withdrawnByText"];

export const pntReadingsCaptureTable: CaptureTablePolicy = {
  entityType: "ControlledReadingAssignment", primaryKey: ["id"], rootPaths: [{ kind: "PNT", field: "documentId" }], captureMode: "EVENT",
  fields: [...fieldPaths].sort().map(fieldPath => ({ fieldPath, valueType: types[fieldPath] ?? "STRING", transform: "VALUE", critical: false })),
};
export function pntReadingsCapturePolicy() {
  return [...auditFindingRootCauseCapturePolicy(), pntReadingsCaptureTable].sort((a, b) => a.entityType < b.entityType ? -1 : a.entityType > b.entityType ? 1 : 0);
}
export function pntReadingsPolicySql() {
  return `INSERT INTO "AuditCaptureTablePolicy" VALUES ('ControlledReadingAssignment',ARRAY['id'],'${JSON.stringify(pntReadingsCaptureTable.rootPaths)}'::jsonb,'EVENT');\nINSERT INTO "AuditCaptureFieldPolicy" VALUES\n${pntReadingsCaptureTable.fields.map(field => `('ControlledReadingAssignment','${field.fieldPath}','${field.valueType}','${field.transform}',${field.critical})`).join(",\n")};\n`;
}
export function auditPntReadingsContract() {
  const sql = readFileSync(pntReadingsMigration, "utf8");
  const triggers = [...previous.triggers];
  for (const match of sql.matchAll(/CREATE (CONSTRAINT )?TRIGGER (\w+) (BEFORE|AFTER) (INSERT OR UPDATE OR DELETE|UPDATE OR DELETE|TRUNCATE|INSERT) ON "(\w+)" ([\s\S]*?)EXECUTE FUNCTION (\w+)\(\);/g)) {
    const type = match[4] === "TRUNCATE" ? 34 : (match[3] === "BEFORE" ? 2 : 0) + 1 + (match[4].includes("INSERT") ? 4 : 0) + (match[4].includes("UPDATE") ? 16 : 0) + (match[4].includes("DELETE") ? 8 : 0);
    if (match[7].startsWith("covex_")) triggers.push({ name: match[2], table: match[5], function: match[7], type, deferred: !!match[1] });
  }
  return { ...previous, contractVersion: "B2_PNT_READINGS", guardTables: [...previous.guardTables, "ControlledReadingAssignment"], triggers,
    capturePolicySha256: createHash("sha256").update(canonicalAuditJson(pntReadingsCapturePolicy())).digest("hex") };
}
if (basename(process.argv[1] ?? "") === "audit-pnt-readings-build.ts") {
  if (process.argv.includes("--policy")) process.stdout.write(pntReadingsPolicySql());
  if (process.argv.includes("--contract")) process.stdout.write(JSON.stringify(auditPntReadingsContract(), null, 2) + "\n");
}
