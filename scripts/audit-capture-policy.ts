import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { Prisma } from "@prisma/client";
import foundation from "../ops/backup/audit-contract-b2.json";

type RootPath = { kind: "QMS_RECORD" | "PNT" | "AUDIT_PLAN"; field: string } | { kind: "ADMINISTRATION"; category: string } | { via: string; table: string };
const parents: Record<string, [string, string]> = {
  AuditDepartment: ["auditId", "Audit"], AuditParticipant: ["auditId", "Audit"], AuditFinding: ["auditId", "Audit"],
  AuditFindingAction: ["findingId", "AuditFinding"], AuditFollowup: ["auditId", "Audit"],
  CapaActionFollowup: ["capaId", "Capa"], CapaFollowup: ["capaId", "Capa"], CapaPlannedAction: ["capaId", "Capa"],
  ChangeControlFollowup: ["changeControlId", "ChangeControl"], ChangeControlTask: ["changeControlId", "ChangeControl"], ChangeControlTaskState: ["taskId", "ChangeControlTask"],
  ComplaintCapaPlan: ["complaintId", "Complaint"], ComplaintDerivedAction: ["complaintId", "Complaint"], ComplaintFollowup: ["complaintId", "Complaint"],
  DeviationCapaPlan: ["deviationId", "Deviation"], DeviationFollowup: ["deviationId", "Deviation"], DeviationImmediateAction: ["deviationId", "Deviation"],
  RecordVersionDocument: ["recordVersionId", "QmsRecordVersion"], ReturnFollowup: ["returnRecordId", "ReturnRecord"], ReturnProduct: ["returnRecordId", "ReturnRecord"],
  ReviewMessage: ["reviewThreadId", "ReviewThread"], ControlledDecisionEvidence: ["revisionId", "ControlledDocumentRevision"],
};
// Only established critical content is a correction. First incorporation/drafts
// do not acquire a blanket extra reason; existing service rules still apply.
const critical: Record<string, string[]> = {
  Deviation: ["investigation", "rootCause", "classification", "validationImpact", "registrationImpact", "stabilityImpact", "otherProcessesImpact", "otherProcessesImpactDetails", "capaRequired", "conclusion", "disposition", "dispositionComments"],
  Capa: ["rootCause", "impactAssessment", "effectivenessCriteria", "effectivenessAssessment", "effectivenessEvidence", "effectivenessStatus", "conclusion"],
  ChangeControl: ["evaluation", "classification", "requestDecision", "dictamenResult", "dictamenObservations", "effectivenessStatus", "closureConclusion"],
  Complaint: ["investigation", "rootCause", "classification", "impactAssessment", "resolution", "conclusion"],
  ReturnRecord: ["decision", "decisionObservations", "finalDestination"],
  Audit: ["conclusion", "closureEvidence", "supplierAssessment", "supplierExceptionReason"],
  AuditFinding: ["criticality", "description", "objectiveEvidence", "evidence", "verificationComment"],
  AuditFindingAction: ["evidence", "verificationComment", "verificationResult"],
  RecordVersionDocument: ["checksum"], ControlledRevisionDocument: ["sha256"],
  FormVersion: ["isActive", "status"], TemplateVersion: ["isActive", "checksum"],
  AppParameter: ["value"], FormFieldConfig: ["officialAnnexField", "required", "options", "valueType"],
};
const exclude = new Set(["updatedAt", "createdAt", "oldValue", "newValue", "snapshot", "sourceSnapshot", "sourceMetadata", "data", "resolution", "result", "report", "reportMetadata", "summary", "before", "after", "details", "valueSnapshot", "metadata"]);
const hashes = new Set(["snapshot", "sourceSnapshot", "sourceMetadata", "data", "resolution", "report", "reportMetadata", "summary", "before", "after", "details", "valueSnapshot", "metadata"]);
export function auditCapturePolicy() {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  return foundation.guardTables.map(name => {
    const model = Prisma.dmmf.datamodel.models.find(m => m.name === name)!;
    const scalar = model.fields.filter(f => f.kind !== "object");
    const fields = new Set(scalar.map(f => f.name));
    const paths: RootPath[] = [];
    if (name === "QmsRecord") paths.push({ kind: "QMS_RECORD", field: "id" });
    else if (name === "ControlledDocument") paths.push({ kind: "PNT", field: "id" });
    else if (name === "AuditAnnualPlan") paths.push({ kind: "AUDIT_PLAN", field: "id" });
    else if (name === "QmsRelation") paths.push({ kind: "QMS_RECORD", field: "sourceRecordId" }, { kind: "QMS_RECORD", field: "targetRecordId" });
    else if (name === "AuditFindingRelation") paths.push({ via: "findingId", table: "AuditFinding" }, { via: "qmsRelationId", table: "QmsRelation" });
    else if (parents[name]) paths.push({ via: parents[name][0], table: parents[name][1] });
    else if (fields.has("qmsRecordId")) paths.push({ kind: "QMS_RECORD", field: "qmsRecordId" });
    else if (fields.has("documentId")) paths.push({ kind: "PNT", field: "documentId" });
    else if (fields.has("planId")) paths.push({ kind: "AUDIT_PLAN", field: "planId" });
    if (fields.has("linkedCapaRecordId")) paths.push({ kind: "QMS_RECORD", field: "linkedCapaRecordId" });
    if (name.startsWith("Auth")) paths.push({ kind: "ADMINISTRATION", category: "AUTHORIZATION" });
    else if (name.startsWith("HistoricalImport")) paths.push({ kind: "ADMINISTRATION", category: "HISTORICAL_IMPORT" });
    else if (name.startsWith("ControlledDocumentImport")) paths.push({ kind: "ADMINISTRATION", category: "PNT_IMPORT" });
    if (!paths.length) paths.push({ kind: "ADMINISTRATION", category: "CONFIGURATION" });
    const block = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "";
    const selected = name === "AuthUser" ? scalar.filter(f => ["id", "active", "authorizedAt"].includes(f.name)) : scalar;
    const policyFields = selected.filter(f => f.type !== "Bytes" && !["updatedAt", "createdAt"].includes(f.name) && (f.type !== "Json" || !exclude.has(f.name) || hashes.has(f.name))).map(f => {
      const hash = hashes.has(f.name) && f.type === "Json";
      const date = new RegExp(`^\\s*${f.name}\\s+DateTime\\??[^\\n]*@db\\.Date\\b`, "m").test(block);
      const type = hash ? "STRING" : f.isList ? "JSON" : f.type === "DateTime" ? date ? "DATE" : "INSTANT" : f.type === "Int" || f.type === "BigInt" ? "INTEGER" : f.type === "Decimal" || f.type === "Float" ? "DECIMAL" : f.type === "Boolean" ? "BOOLEAN" : f.type === "Json" ? "JSON" : "STRING";
      return { fieldPath: f.name, valueType: type, transform: hash ? "SHA256_JSON" : "VALUE", critical: critical[name]?.includes(f.name) ?? false };
    });
    const captureMode = ["ChangeHistory", "ConfigurationChange", "AuthAuthorizationChange", "AuditPlanChange", "ControlledDocumentChange"].includes(name) ? "EVIDENCE" : "EVENT";
    return { entityType: name, primaryKey: model.primaryKey?.fields ?? scalar.filter(f => f.isId).map(f => f.name), rootPaths: paths, captureMode, fields: policyFields.sort((a,b) => a.fieldPath < b.fieldPath ? -1 : a.fieldPath > b.fieldPath ? 1 : 0) };
  });
}
export function auditCapturePolicySql() {
  const quote = (s: string) => "'" + s.replaceAll("'", "''") + "'";
  return auditCapturePolicy().map(table => [
    `INSERT INTO "AuditCaptureTablePolicy" VALUES (${quote(table.entityType)},ARRAY[${table.primaryKey.map(quote).join(",")}],${quote(JSON.stringify(table.rootPaths))}::jsonb,${quote(table.captureMode)});`,
    `INSERT INTO "AuditCaptureFieldPolicy" VALUES\n${table.fields.map(f => `(${[table.entityType, f.fieldPath, f.valueType, f.transform].map(quote).join(",")},${f.critical})`).join(",\n")};`,
  ].join("\n")).join("\n");
}
if (basename(process.argv[1] ?? "") === "audit-capture-policy.ts") {
  if (process.argv.includes("--sql")) process.stdout.write(auditCapturePolicySql());
  else if (process.argv.includes("--print")) process.stdout.write(JSON.stringify(auditCapturePolicy(), null, 2) + "\n");
}
