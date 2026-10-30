import { createHash } from "node:crypto";
import { basename } from "node:path";
import previous from "../ops/backup/audit-contract-deviation-investigation-tools.json";
import { deviationToolsCapturePolicy } from "./audit-deviation-tools-build";
import { canonicalAuditJson } from "../src/lib/audit/canonical-json";

// D-127: tablas de los textos largos de Desviaciones. Solo amplía la política de captura; no cambia
// funciones, triggers ni tablas.
export const deviationTextTablesMigration = "prisma/migrations/20261030000100_deviation_text_tables/migration.sql";
const byPath = (a: { fieldPath: string }, b: { fieldPath: string }) => a.fieldPath < b.fieldPath ? -1 : a.fieldPath > b.fieldPath ? 1 : 0;

export function deviationTextTablesCapturePolicy() {
  return deviationToolsCapturePolicy().map(table => table.entityType === "Deviation"
    ? { ...table, fields: [...table.fields, { fieldPath: "textTables", valueType: "JSON", transform: "VALUE", critical: false }].sort(byPath) }
    : table);
}
export function deviationTextTablesPolicySql() {
  return `INSERT INTO "AuditCaptureFieldPolicy" VALUES\n('Deviation','textTables','JSON','VALUE',false);`;
}
export function auditDeviationTextTablesContract() {
  return { ...previous, contractVersion: "B2_DEVIATION_TEXT_TABLES",
    capturePolicySha256: createHash("sha256").update(canonicalAuditJson(deviationTextTablesCapturePolicy())).digest("hex") };
}
if (basename(process.argv[1] ?? "") === "audit-deviation-text-tables-build.ts" && process.argv.includes("--contract")) process.stdout.write(JSON.stringify(auditDeviationTextTablesContract(), null, 2) + "\n");
