import { createHash } from "node:crypto";
import { basename } from "node:path";
import previous from "../ops/backup/audit-contract-audit-signatories.json";
import { auditSignatoriesCapturePolicy } from "./audit-audit-signatories-build";
import { canonicalAuditJson } from "../src/lib/audit/canonical-json";

// D-135 (R6): «Elaborado por» del Programa Anual de Auditorías. Solo amplía la política de captura;
// no cambia funciones, triggers ni tablas.
export const auditProgrammePreparerMigration = "prisma/migrations/20261113000100_audit_programme_preparer/migration.sql";
const byPath = (a: { fieldPath: string }, b: { fieldPath: string }) => a.fieldPath < b.fieldPath ? -1 : a.fieldPath > b.fieldPath ? 1 : 0;

export function auditProgrammePreparerCapturePolicy() {
  return auditSignatoriesCapturePolicy().map(table => table.entityType === "AuditAnnualPlan"
    ? { ...table, fields: [...table.fields, { fieldPath: "preparedByName", valueType: "STRING", transform: "VALUE", critical: false }].sort(byPath) }
    : table);
}
export function auditProgrammePreparerPolicySql() {
  return `INSERT INTO "AuditCaptureFieldPolicy" VALUES\n('AuditAnnualPlan','preparedByName','STRING','VALUE',false);`;
}
export function auditProgrammePreparerContract() {
  return { ...previous, contractVersion: "B2_AUDIT_PROGRAMME_PREPARER",
    capturePolicySha256: createHash("sha256").update(canonicalAuditJson(auditProgrammePreparerCapturePolicy())).digest("hex") };
}
if (basename(process.argv[1] ?? "") === "audit-programme-preparer-build.ts" && process.argv.includes("--contract")) process.stdout.write(JSON.stringify(auditProgrammePreparerContract(), null, 2) + "\n");
