import { createHash } from "node:crypto";
import { basename } from "node:path";
import previous from "../ops/backup/audit-contract-capa-change-text-tables.json";
import { capaChangeTextTablesCapturePolicy } from "./audit-capa-change-text-tables-build";
import { canonicalAuditJson } from "../src/lib/audit/canonical-json";

// D-127 (tercera parte): tablas de los textos largos de OOS, Reclamaciones y Devoluciones. Solo amplía
// la política de captura; no cambia funciones, triggers ni tablas.
export const qmsTextTablesMigration = "prisma/migrations/20261031000200_oos_complaint_return_text_tables/migration.sql";
const byPath = (a: { fieldPath: string }, b: { fieldPath: string }) => a.fieldPath < b.fieldPath ? -1 : a.fieldPath > b.fieldPath ? 1 : 0;
const entities = ["Complaint", "OosRecord", "ReturnRecord"];

export function qmsTextTablesCapturePolicy() {
  return capaChangeTextTablesCapturePolicy().map(table => entities.includes(table.entityType)
    ? { ...table, fields: [...table.fields, { fieldPath: "textTables", valueType: "JSON", transform: "VALUE", critical: false }].sort(byPath) }
    : table);
}
export function qmsTextTablesPolicySql() {
  return `INSERT INTO "AuditCaptureFieldPolicy" VALUES\n('Complaint','textTables','JSON','VALUE',false),\n('OosRecord','textTables','JSON','VALUE',false),\n('ReturnRecord','textTables','JSON','VALUE',false);`;
}
export function auditQmsTextTablesContract() {
  return { ...previous, contractVersion: "B2_QMS_TEXT_TABLES",
    capturePolicySha256: createHash("sha256").update(canonicalAuditJson(qmsTextTablesCapturePolicy())).digest("hex") };
}
if (basename(process.argv[1] ?? "") === "audit-qms-text-tables-build.ts" && process.argv.includes("--contract")) process.stdout.write(JSON.stringify(auditQmsTextTablesContract(), null, 2) + "\n");
