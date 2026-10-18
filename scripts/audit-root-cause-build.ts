import { createHash } from "node:crypto";
import { basename } from "node:path";
import previous from "../ops/backup/audit-contract-oos-signed.json";
import { oosCapturePolicy } from "./audit-oos-build";
import { canonicalAuditJson } from "../src/lib/audit/canonical-json";

// Categoría de causa raíz (6M): campo aditivo rootCauseCategories en Desviación, CAPA,
// Reclamación y OOS. Solo amplía la política de captura; no cambia funciones ni triggers.
export const rootCauseMigration = "prisma/migrations/20261017000700_root_cause_categories/migration.sql";
export const rootCauseEntities = ["Deviation", "Capa", "Complaint", "OosRecord"] as const;
const byPath = (a: { fieldPath: string }, b: { fieldPath: string }) => a.fieldPath < b.fieldPath ? -1 : a.fieldPath > b.fieldPath ? 1 : 0;

export function rootCauseCapturePolicy() {
  return oosCapturePolicy().map(table => (rootCauseEntities as readonly string[]).includes(table.entityType)
    ? { ...table, fields: [...table.fields, { fieldPath: "rootCauseCategories", valueType: "JSON", transform: "VALUE", critical: false }].sort(byPath) }
    : table);
}
export function rootCausePolicySql() {
  return `INSERT INTO "AuditCaptureFieldPolicy" VALUES\n${rootCauseEntities.map(entity => `('${entity}','rootCauseCategories','JSON','VALUE',false)`).join(",\n")};`;
}
export function auditRootCauseContract() {
  return { ...previous, contractVersion: "B2_ROOT_CAUSE_CATEGORIES",
    capturePolicySha256: createHash("sha256").update(canonicalAuditJson(rootCauseCapturePolicy())).digest("hex") };
}
if (basename(process.argv[1] ?? "") === "audit-root-cause-build.ts") {
  if (process.argv.includes("--policy")) process.stdout.write(rootCausePolicySql());
  if (process.argv.includes("--contract")) process.stdout.write(JSON.stringify(auditRootCauseContract(), null, 2) + "\n");
}
