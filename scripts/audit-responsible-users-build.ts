import { createHash } from "node:crypto";
import { basename } from "node:path";
import previous from "../ops/backup/audit-contract-additional-lots.json";
import { additionalLotsCapturePolicy } from "./audit-additional-lots-build";
import { canonicalAuditJson } from "../src/lib/audit/canonical-json";

// D-101: usuario de la aplicación junto a cada responsable en texto libre.
// Solo amplía la política de captura; no cambia funciones, triggers ni tablas.
export const responsibleUsersMigration = "prisma/migrations/20261018000300_responsible_users/migration.sql";
export const responsibleUserFields = [
  ["DeviationImmediateAction", "executedByUserId"],
  ["DeviationCapaPlan", "responsibleUserId"],
  ["CapaPlannedAction", "responsibleUserId"],
  ["ChangeControl", "requestDecisionResponsibleUserId"],
  ["ChangeControl", "followupResponsibleUserId"],
  ["ChangeControlTask", "responsibleUserId"],
  ["ChangeControlFollowup", "responsibleUserId"],
  ["ComplaintCapaPlan", "responsibleUserId"],
  ["ComplaintDerivedAction", "responsibleUserId"],
  ["AuditFindingAction", "responsibleUserId"],
] as const;
const byPath = (a: { fieldPath: string }, b: { fieldPath: string }) => a.fieldPath < b.fieldPath ? -1 : a.fieldPath > b.fieldPath ? 1 : 0;

export function responsibleUsersCapturePolicy() {
  return additionalLotsCapturePolicy().map(table => {
    const added = responsibleUserFields.filter(([entity]) => entity === table.entityType)
      .map(([, fieldPath]) => ({ fieldPath, valueType: "STRING", transform: "VALUE", critical: false }));
    return added.length ? { ...table, fields: [...table.fields, ...added].sort(byPath) } : table;
  });
}
export function responsibleUsersPolicySql() {
  return `INSERT INTO "AuditCaptureFieldPolicy" VALUES\n${responsibleUserFields.map(([entity, field]) => `('${entity}','${field}','STRING','VALUE',false)`).join(",\n")};`;
}
export function auditResponsibleUsersContract() {
  return { ...previous, contractVersion: "B2_RESPONSIBLE_USERS",
    capturePolicySha256: createHash("sha256").update(canonicalAuditJson(responsibleUsersCapturePolicy())).digest("hex") };
}
if (basename(process.argv[1] ?? "") === "audit-responsible-users-build.ts" && process.argv.includes("--contract")) process.stdout.write(JSON.stringify(auditResponsibleUsersContract(), null, 2) + "\n");
