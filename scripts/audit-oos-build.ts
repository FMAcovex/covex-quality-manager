import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import previous from "../ops/backup/audit-contract-c.json";
import { stagingCapturePolicy } from "./audit-staging-build";
import type { CaptureTablePolicy } from "./audit-capture-policy";
import { canonicalAuditJson } from "../src/lib/audit/canonical-json";

// D-088, OOS-2b: additive capture of OosRecord. Published metadata is frozen
// here, not derived from Prisma, so later OOS fields need their own release.
export const oosMigration = "prisma/migrations/20261017000200_b2_oos_capture/migration.sql";
const dates = ["closedAt", "issueDate", "oosDate", "phaseIApprovedAt", "phaseIIIssueDate", "phaseIIIssuedAt", "phaseIIssuedAt"];
const json = ["extraData", "phaseIEvaluation"];
// Technical D03 proposal by analogy with investigation, conclusion and verdict
// fields of the other modules; pending formal QA/DT acceptance.
const critical = ["investigationResult", "phaseIConclusion", "phaseIDisposition", "phaseIInvestigation", "phaseIIConclusion", "phaseIIProductionReview", "phaseIIVerdict", "phaseIVerdict"];
const fieldPaths = ["affectedQuantity", "area", "batchSize", "closedAt", "createdByText", "departmentCodeSnapshot", "departmentId", "departmentNameSnapshot", "detectedBy", "detectionDescription", "extraData", "id", "internalObservations", "investigationResult", "issueDate", "lotNumber", "materialKind", "materialName", "oosDate", "oosTime", "phaseIApprovedAt", "phaseIApprovedBy", "phaseIConclusion", "phaseIDestroyQuantity", "phaseIDisposition", "phaseIEvaluation", "phaseIIAffectedDepartments", "phaseIIConclusion", "phaseIIDestroyQuantity", "phaseIIIssueDate", "phaseIIIssuedAt", "phaseIIIssuedBy", "phaseIIProductionReview", "phaseIIResampling", "phaseIIRetesting", "phaseIIReturnQuantity", "phaseIIVerdict", "phaseIIVerdictOther", "phaseIIVerdictQuantity", "phaseIInvestigation", "phaseIIssuedAt", "phaseIIssuedBy", "phaseIReturnQuantity", "phaseIVerdict", "phaseIVerdictOther", "phaseIVerdictQuantity", "process", "qmsRecordId", "shift", "status", "supplier", "supplierLot"];

export const oosCaptureTable: CaptureTablePolicy = {
  entityType: "OosRecord", primaryKey: ["id"], rootPaths: [{ kind: "QMS_RECORD", field: "qmsRecordId" }], captureMode: "EVENT",
  fields: [...fieldPaths].sort().map(fieldPath => ({ fieldPath, valueType: dates.includes(fieldPath) ? "DATE" : json.includes(fieldPath) ? "JSON" : "STRING", transform: "VALUE", critical: critical.includes(fieldPath) })),
};
export function oosCapturePolicy() {
  return [...stagingCapturePolicy(), oosCaptureTable].sort((a, b) => a.entityType < b.entityType ? -1 : a.entityType > b.entityType ? 1 : 0);
}
export function oosPolicySql() {
  return `INSERT INTO "AuditCaptureTablePolicy" VALUES ('OosRecord',ARRAY['id'],'${JSON.stringify(oosCaptureTable.rootPaths)}'::jsonb,'EVENT');\nINSERT INTO "AuditCaptureFieldPolicy" VALUES\n${oosCaptureTable.fields.map(field => `('OosRecord','${field.fieldPath}','${field.valueType}','${field.transform}',${field.critical})`).join(",\n")};\n`;
}
export function auditOosContract() {
  const sql = readFileSync(oosMigration, "utf8");
  const functions: Record<string, { sha256: string; definer: boolean; arguments?: string }> = { ...previous.functions };
  for (const match of sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION (covex_\w+)\([\s\S]*? AS \$\$([\s\S]*?)\$\$;/g)) functions[match[1]] = { sha256: createHash("sha256").update(match[2]).digest("hex"), definer: match[0].includes("SECURITY DEFINER") };
  const triggers = [...previous.triggers];
  for (const match of sql.matchAll(/CREATE (CONSTRAINT )?TRIGGER (\w+) (BEFORE|AFTER) (INSERT OR UPDATE OR DELETE|UPDATE OR DELETE|TRUNCATE|INSERT) ON "(\w+)" ([\s\S]*?)EXECUTE FUNCTION (\w+)\(\);/g)) {
    const type = match[4] === "TRUNCATE" ? 34 : (match[3] === "BEFORE" ? 2 : 0) + 1 + (match[4].includes("INSERT") ? 4 : 0) + (match[4].includes("UPDATE") ? 16 : 0) + (match[4].includes("DELETE") ? 8 : 0);
    triggers.push({ name: match[2], table: match[5], function: match[7], type, deferred: !!match[1] });
  }
  return { ...previous, contractVersion: "B2_OOS_CAPTURE", guardTables: [...previous.guardTables, "OosRecord"], functions, triggers,
    capturePolicySha256: createHash("sha256").update(canonicalAuditJson(oosCapturePolicy())).digest("hex") };
}
if (basename(process.argv[1] ?? "") === "audit-oos-build.ts") {
  if (process.argv.includes("--policy")) process.stdout.write(oosPolicySql());
  if (process.argv.includes("--contract")) process.stdout.write(JSON.stringify(auditOosContract(), null, 2) + "\n");
}
