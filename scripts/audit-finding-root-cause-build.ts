import { createHash } from "node:crypto";
import { basename } from "node:path";
import previous from "../ops/backup/audit-contract-audit-programme-preparer.json";
import { auditProgrammePreparerCapturePolicy } from "./audit-programme-preparer-build";
import { canonicalAuditJson } from "../src/lib/audit/canonical-json";

// D-136 (R6): causa raíz del hallazgo para el plan CAPA. Solo amplía la política de captura;
// no cambia funciones, triggers ni tablas.
export const auditFindingRootCauseMigration = "prisma/migrations/20261114000100_audit_finding_root_cause/migration.sql";
const byPath = (a: { fieldPath: string }, b: { fieldPath: string }) => a.fieldPath < b.fieldPath ? -1 : a.fieldPath > b.fieldPath ? 1 : 0;

export function auditFindingRootCauseCapturePolicy() {
  return auditProgrammePreparerCapturePolicy().map(table => table.entityType === "AuditFinding"
    ? { ...table, fields: [...table.fields, { fieldPath: "rootCause", valueType: "STRING", transform: "VALUE", critical: false }].sort(byPath) }
    : table);
}
export function auditFindingRootCausePolicySql() {
  return `INSERT INTO "AuditCaptureFieldPolicy" VALUES\n('AuditFinding','rootCause','STRING','VALUE',false);`;
}
export function auditFindingRootCauseContract() {
  return { ...previous, contractVersion: "B2_AUDIT_FINDING_ROOT_CAUSE",
    capturePolicySha256: createHash("sha256").update(canonicalAuditJson(auditFindingRootCauseCapturePolicy())).digest("hex") };
}
if (basename(process.argv[1] ?? "") === "audit-finding-root-cause-build.ts" && process.argv.includes("--contract")) process.stdout.write(JSON.stringify(auditFindingRootCauseContract(), null, 2) + "\n");
