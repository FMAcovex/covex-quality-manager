import { createHash } from "node:crypto";
import { basename } from "node:path";
import previous from "../ops/backup/audit-contract-capa-plan.json";
import { capaPlanCapturePolicy } from "./audit-capa-plan-build";
import { canonicalAuditJson } from "../src/lib/audit/canonical-json";

// D-116: turno del evento en Desviaciones (casilla «turno» del Anexo III).
// Solo amplía la política de captura; no cambia funciones, triggers ni tablas.
export const deviationShiftMigration = "prisma/migrations/20261020000100_deviation_shift/migration.sql";
const byPath = (a: { fieldPath: string }, b: { fieldPath: string }) => a.fieldPath < b.fieldPath ? -1 : a.fieldPath > b.fieldPath ? 1 : 0;

export function deviationShiftCapturePolicy() {
  return capaPlanCapturePolicy().map(table => table.entityType === "Deviation"
    ? { ...table, fields: [...table.fields, { fieldPath: "shift", valueType: "STRING", transform: "VALUE", critical: false }].sort(byPath) }
    : table);
}
export function deviationShiftPolicySql() {
  return `INSERT INTO "AuditCaptureFieldPolicy" VALUES\n('Deviation','shift','STRING','VALUE',false);`;
}
export function auditDeviationShiftContract() {
  return { ...previous, contractVersion: "B2_DEVIATION_SHIFT",
    capturePolicySha256: createHash("sha256").update(canonicalAuditJson(deviationShiftCapturePolicy())).digest("hex") };
}
if (basename(process.argv[1] ?? "") === "audit-deviation-shift-build.ts" && process.argv.includes("--contract")) process.stdout.write(JSON.stringify(auditDeviationShiftContract(), null, 2) + "\n");
