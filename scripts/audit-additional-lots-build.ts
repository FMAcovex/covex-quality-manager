import { createHash } from "node:crypto";
import { basename } from "node:path";
import previous from "../ops/backup/audit-contract-root-cause.json";
import { rootCauseCapturePolicy } from "./audit-root-cause-build";
import { canonicalAuditJson } from "../src/lib/audit/canonical-json";

// D-094: lista additionalLots (otros lotes afectados) en Desviación, Reclamación y OOS.
// Solo amplía la política de captura; no cambia funciones, triggers ni tablas.
export const additionalLotsMigration = "prisma/migrations/20261018000100_additional_lots/migration.sql";
export const additionalLotsEntities = ["Deviation", "Complaint", "OosRecord"] as const;
const byPath = (a: { fieldPath: string }, b: { fieldPath: string }) => a.fieldPath < b.fieldPath ? -1 : a.fieldPath > b.fieldPath ? 1 : 0;

export function additionalLotsCapturePolicy() {
  return rootCauseCapturePolicy().map(table => (additionalLotsEntities as readonly string[]).includes(table.entityType)
    ? { ...table, fields: [...table.fields, { fieldPath: "additionalLots", valueType: "JSON", transform: "VALUE", critical: false }].sort(byPath) }
    : table);
}
export function additionalLotsPolicySql() {
  return `INSERT INTO "AuditCaptureFieldPolicy" VALUES\n${additionalLotsEntities.map(entity => `('${entity}','additionalLots','JSON','VALUE',false)`).join(",\n")};`;
}
export function auditAdditionalLotsContract() {
  return { ...previous, contractVersion: "B2_ADDITIONAL_LOTS",
    capturePolicySha256: createHash("sha256").update(canonicalAuditJson(additionalLotsCapturePolicy())).digest("hex") };
}
if (basename(process.argv[1] ?? "") === "audit-additional-lots-build.ts" && process.argv.includes("--contract")) process.stdout.write(JSON.stringify(auditAdditionalLotsContract(), null, 2) + "\n");
