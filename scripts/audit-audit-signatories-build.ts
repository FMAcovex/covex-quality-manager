import { createHash } from "node:crypto";
import { basename } from "node:path";
import previous from "../ops/backup/audit-contract-qms-text-tables.json";
import { qmsTextTablesCapturePolicy } from "./audit-qms-text-tables-build";
import { canonicalAuditJson } from "../src/lib/audit/canonical-json";

// D-134 (R6): firmantes de los documentos de una auditoría. Solo amplía la política de captura;
// no cambia funciones, triggers ni tablas.
export const auditSignatoriesMigration = "prisma/migrations/20261112000100_audit_signatories/migration.sql";
const byPath = (a: { fieldPath: string }, b: { fieldPath: string }) => a.fieldPath < b.fieldPath ? -1 : a.fieldPath > b.fieldPath ? 1 : 0;

export function auditSignatoriesCapturePolicy() {
  return qmsTextTablesCapturePolicy().map(table => table.entityType === "Audit"
    ? { ...table, fields: [...table.fields, { fieldPath: "signatories", valueType: "JSON", transform: "VALUE", critical: false }].sort(byPath) }
    : table);
}
export function auditSignatoriesPolicySql() {
  return `INSERT INTO "AuditCaptureFieldPolicy" VALUES\n('Audit','signatories','JSON','VALUE',false);`;
}
export function auditSignatoriesContract() {
  return { ...previous, contractVersion: "B2_AUDIT_SIGNATORIES",
    capturePolicySha256: createHash("sha256").update(canonicalAuditJson(auditSignatoriesCapturePolicy())).digest("hex") };
}
if (basename(process.argv[1] ?? "") === "audit-audit-signatories-build.ts" && process.argv.includes("--contract")) process.stdout.write(JSON.stringify(auditSignatoriesContract(), null, 2) + "\n");
