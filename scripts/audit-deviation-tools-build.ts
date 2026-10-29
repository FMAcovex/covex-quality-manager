import { createHash } from "node:crypto";
import { basename } from "node:path";
import previous from "../ops/backup/audit-contract-change-control-models.json";
import { changeModelsCapturePolicy } from "./audit-change-models-build";
import { canonicalAuditJson } from "../src/lib/audit/canonical-json";

// D-123: herramientas de investigación de Desviaciones (5 porqués, Ishikawa, brainstorming).
// Solo amplía la política de captura; no cambia funciones, triggers ni tablas.
export const deviationToolsMigration = "prisma/migrations/20261030000100_deviation_investigation_tools/migration.sql";
const byPath = (a: { fieldPath: string }, b: { fieldPath: string }) => a.fieldPath < b.fieldPath ? -1 : a.fieldPath > b.fieldPath ? 1 : 0;

export function deviationToolsCapturePolicy() {
  return changeModelsCapturePolicy().map(table => table.entityType === "Deviation"
    ? { ...table, fields: [...table.fields, { fieldPath: "investigationTools", valueType: "JSON", transform: "VALUE", critical: false }].sort(byPath) }
    : table);
}
export function deviationToolsPolicySql() {
  return `INSERT INTO "AuditCaptureFieldPolicy" VALUES\n('Deviation','investigationTools','JSON','VALUE',false);`;
}
export function auditDeviationToolsContract() {
  return { ...previous, contractVersion: "B2_DEVIATION_INVESTIGATION_TOOLS",
    capturePolicySha256: createHash("sha256").update(canonicalAuditJson(deviationToolsCapturePolicy())).digest("hex") };
}
if (basename(process.argv[1] ?? "") === "audit-deviation-tools-build.ts" && process.argv.includes("--contract")) process.stdout.write(JSON.stringify(auditDeviationToolsContract(), null, 2) + "\n");
