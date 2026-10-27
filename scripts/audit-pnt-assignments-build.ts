import { createHash } from "node:crypto";
import { basename } from "node:path";
import previous from "../ops/backup/audit-contract-deviation-shift.json";
import { deviationShiftCapturePolicy } from "./audit-deviation-shift-build";
import { canonicalAuditJson } from "../src/lib/audit/canonical-json";

// D-118: responsables de las funciones de cada revisión de PNT y de la revisión periódica.
// Solo amplía la política de captura; no cambia funciones, triggers ni tablas.
export const pntAssignmentsMigration = "prisma/migrations/20261027000100_pnt_assignments/migration.sql";
export const pntAssignmentFields = [
  ["ControlledDocument", "periodicReviewResponsible", "STRING"],
  ["ControlledDocument", "periodicReviewResponsibleUserId", "STRING"],
  ["ControlledDocumentRevision", "approvalResponsible", "STRING"],
  ["ControlledDocumentRevision", "approvalResponsibleUserId", "STRING"],
  ["ControlledDocumentRevision", "approvalTargetDate", "DATE"],
  ["ControlledDocumentRevision", "preparationResponsible", "STRING"],
  ["ControlledDocumentRevision", "preparationResponsibleUserId", "STRING"],
  ["ControlledDocumentRevision", "preparationTargetDate", "DATE"],
  ["ControlledDocumentRevision", "reviewResponsible", "STRING"],
  ["ControlledDocumentRevision", "reviewResponsibleUserId", "STRING"],
  ["ControlledDocumentRevision", "reviewTargetDate", "DATE"],
] as const;
const byPath = (a: { fieldPath: string }, b: { fieldPath: string }) => a.fieldPath < b.fieldPath ? -1 : a.fieldPath > b.fieldPath ? 1 : 0;

export function pntAssignmentsCapturePolicy() {
  return deviationShiftCapturePolicy().map(table => {
    const added = pntAssignmentFields.filter(([entity]) => entity === table.entityType)
      .map(([, fieldPath, valueType]) => ({ fieldPath, valueType, transform: "VALUE", critical: false }));
    return added.length ? { ...table, fields: [...table.fields, ...added].sort(byPath) } : table;
  });
}
export function pntAssignmentsPolicySql() {
  return `INSERT INTO "AuditCaptureFieldPolicy" VALUES\n${pntAssignmentFields.map(([entity, field, type]) => `('${entity}','${field}','${type}','VALUE',false)`).join(",\n")};`;
}
export function auditPntAssignmentsContract() {
  return { ...previous, contractVersion: "B2_PNT_ASSIGNMENTS",
    capturePolicySha256: createHash("sha256").update(canonicalAuditJson(pntAssignmentsCapturePolicy())).digest("hex") };
}
if (basename(process.argv[1] ?? "") === "audit-pnt-assignments-build.ts" && process.argv.includes("--contract")) process.stdout.write(JSON.stringify(auditPntAssignmentsContract(), null, 2) + "\n");
