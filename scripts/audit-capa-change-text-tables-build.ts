import { createHash } from "node:crypto";
import { basename } from "node:path";
import previous from "../ops/backup/audit-contract-deviation-text-tables.json";
import { deviationTextTablesCapturePolicy } from "./audit-deviation-text-tables-build";
import { canonicalAuditJson } from "../src/lib/audit/canonical-json";

// D-127 (segunda parte): tablas de los textos largos de CAPA y Controles de cambios. Solo amplía la
// política de captura; no cambia funciones, triggers ni tablas.
export const capaChangeTextTablesMigration = "prisma/migrations/20261031000100_capa_change_text_tables/migration.sql";
const byPath = (a: { fieldPath: string }, b: { fieldPath: string }) => a.fieldPath < b.fieldPath ? -1 : a.fieldPath > b.fieldPath ? 1 : 0;
const entities = ["Capa", "ChangeControl"];

export function capaChangeTextTablesCapturePolicy() {
  return deviationTextTablesCapturePolicy().map(table => entities.includes(table.entityType)
    ? { ...table, fields: [...table.fields, { fieldPath: "textTables", valueType: "JSON", transform: "VALUE", critical: false }].sort(byPath) }
    : table);
}
export function capaChangeTextTablesPolicySql() {
  return `INSERT INTO "AuditCaptureFieldPolicy" VALUES\n('Capa','textTables','JSON','VALUE',false),\n('ChangeControl','textTables','JSON','VALUE',false);`;
}
export function auditCapaChangeTextTablesContract() {
  return { ...previous, contractVersion: "B2_CAPA_CHANGE_TEXT_TABLES",
    capturePolicySha256: createHash("sha256").update(canonicalAuditJson(capaChangeTextTablesCapturePolicy())).digest("hex") };
}
if (basename(process.argv[1] ?? "") === "audit-capa-change-text-tables-build.ts" && process.argv.includes("--contract")) process.stdout.write(JSON.stringify(auditCapaChangeTextTablesContract(), null, 2) + "\n");
