import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { Prisma } from "@prisma/client";
import { auditWriterInventory } from "./audit-writer-inventory";
import { auditManifestJson } from "./audit-manifest-format";
import { auditCapturePolicy } from "./audit-capture-policy";
import { oosCaptureTable } from "./audit-oos-build";

// Design catalogue and reconciliation, NOT an activated or approved GMP policy.
const groups: Record<string, string[]> = {
  W01: ["src/modules/deviations/actions.ts"],
  W02: ["src/modules/capa/actions.ts", "src/modules/capa/followup-service.ts", "src/modules/capa/deviation-origin.ts", "src/modules/capa/complaint-origin.ts", "src/modules/capa/relation-version-service.ts"],
  W03: ["src/modules/change-control/actions.ts"],
  W04: ["src/modules/complaints/actions.ts", "src/modules/complaints/version-service.ts"],
  W05: ["src/modules/returns/actions.ts", "src/modules/returns/product-service.ts", "src/modules/returns/snapshot-service.ts"],
  W06: ["src/modules/audits/service.ts", "src/modules/audits/finding-service.ts", "src/modules/audits/report-service.ts"],
  W07: ["src/modules/audits/plans.ts", "src/modules/audits/annual-programme/service.ts"],
  W08: ["src/modules/controlled-documents/service.ts"],
  W09: ["src/modules/controlled-documents/lifecycle/service.ts", "src/modules/controlled-documents/manual-state/service.ts"],
  W10: ["src/modules/controlled-documents/documents/service.ts"],
  W11: ["src/modules/controlled-documents/import/service.ts", "src/modules/controlled-documents/import/database.ts"],
  W12: ["src/lib/qms/relation-service.ts", "src/lib/qms/administrative-status.ts"],
  W13: ["src/lib/qms/review/service.ts"],
  W14: ["src/lib/qms/versioning.ts", "src/modules/complaints/version-service.ts", "src/modules/returns/snapshot-service.ts"],
  W15: ["src/lib/qms/signed-version-document.ts", "src/lib/qms/signed-custody-service.ts", "src/lib/qms/record-evidence.ts"],
  W16: ["src/lib/qms/working-document.ts", "src/app/api/deviations/[id]/annex-iii/route.ts", "src/app/api/capa/[id]/annex-iii/route.ts", "src/app/api/changes/[id]/annex-iii/route.ts", "src/app/api/changes/[id]/annex-iv/route.ts", "src/app/api/changes/[id]/annex-v/route.ts", "src/app/api/complaints/[id]/annex-iii/route.ts", "src/app/api/complaints/[id]/annex-iv/route.ts", "src/modules/returns/documents/archive.ts", "src/modules/audits/documents/service.ts", "src/modules/oos/documents/route-helpers.ts"],
  W17: ["src/modules/configuration/admin-actions.ts"],
  W18: ["src/lib/auth/administration.ts", "scripts/auth-provision.ts"],
  W19: ["src/lib/auth/oidc.ts", "src/lib/auth/session.ts", "src/app/api/reminders/manual/route.ts"],
  W20: ["src/modules/deviations/import/import-service.ts", "src/modules/capa/import/import-service.ts", "scripts/backfill-record-versions.ts"],
  W21: ["scripts/install-template-bundle.ts", "scripts/install-document-templates.ts", "scripts/install-capa-templates.ts", "scripts/install-change-control-templates.ts", "scripts/install-complaint-template.ts", "scripts/install-return-template.ts", "scripts/install-audit-templates.ts", "scripts/install-annual-audit-programme-templates.ts", "scripts/install-oos-templates.ts"],
  W22: ["ops/backup/backup.py", "ops/release.py", "ops/postgres/roles.sql", "ops/postgres/audit-owner.sql", "ops/postgres/audit-grants.sql"],
  W23: ["src/modules/oos/actions.ts", "src/modules/oos/signed-document-actions.ts"],
};
const prefixes: Record<string, string[]> = { DV: ["W01"], CA: ["W02"], CC: ["W03"], RC: ["W04"], DE: ["W05"], AU: ["W06"], PN: ["W08"], TR: [], OO: ["W23"] };
const additional: Record<string,string[]> = {
  DV01: ["W14"], DV06: ["W14"], DV07: ["W12"], DV08: ["W12", "W15", "W16"],
  CA01: ["W12", "W14"], CA06: ["W14"], CA07: ["W12"], CA08: ["W15", "W16"],
  CC01: ["W14"], CC06: ["W12"], CC07: ["W14", "W15", "W16"],
  RC01: ["W14"], RC05: ["W14"], RC06: ["W12"], RC07: ["W15", "W16"],
  DE01: ["W14"], DE05: ["W14"], DE06: ["W12"], DE07: ["W15", "W16"],
  OO05: ["W12"], OO06: ["W14", "W15", "W16"],
  AU05: ["W12"], AU06: ["W14", "W16"], AU07: ["W12", "W14"], AU08: ["W07"], AU09: ["W07"],
  PN02: ["W09"], PN03: ["W09"], PN04: ["W09"], PN05: ["W10"], PN06: ["W11"], PN07: ["W11"], PN08: ["W10"],
  TR01: ["W13"], TR02: ["W17"], TR03: ["W17"], TR04: ["W17", "W21"], TR05: ["W18"], TR06: ["W19"], TR07: ["W20"], TR08: ["W22"], TR09: [],
};
const moduleEvidence = "scripts/audit-fixtures/operational-actions-capture.test.ts";
function coverage(id:string, category:string) {
  if (id === "PN07") return { coverage:"DEMONSTRATED_TECHNICAL_STREAM", evidence:["scripts/audit-fixtures/module-actions-capture.test.ts: private expiry lease, rollback and immutability"] };
  if (id === "PN08") return { coverage:"JUSTIFIED_READ_ONLY_NO_BUSINESS_EVENT", evidence:["scripts/audit-fixtures/module-actions-capture.test.ts: historical original download authorization and checksum"] };
  if (id === "TR06") return { coverage:"DEMONSTRATED_TECHNICAL_AUTH_STREAM", evidence:["scripts/smoke-phase4b3-b2-auth.ts: OIDC, session expiry/revocation and denied access"] };
  if (id === "TR07") return { coverage:"JUSTIFIED_EXCLUSION_BLOCKED", evidence:[`${moduleEvidence}: historical imports and backfill blocked atomically pending controlled identity/provenance`] };
  if (id === "TR08") return { coverage:"DEMONSTRATED_CONTROLLED_RECOVERY", evidence:["scripts/smoke-phase4b2-recovery.ts: protected backup/restore, replay, sequence and immutable journal"] };
  if (id === "TR09") return { coverage:"DEMONSTRATED_CONTROLLED_REVIEW_EXPORT", evidence:["scripts/audit-fixtures/trail-c.test.ts: exact microsecond cut, explicit permissions, immutable review/export, replay, conflicts and protection", "scripts/audit-fixtures/trail-c-ui.ts: seven modules, ordinary/sensitive consultation and controlled review/export", "scripts/smoke-phase4b2-recovery.ts: exact review/export receipts, bytes, manifests and protected replay after recovery"] };
  if (id.startsWith("PN")) return { coverage:"DEMONSTRATED_ISOLATED", evidence:[id === "PN06" ? "scripts/audit-fixtures/pnt-import-capture.test.ts: original proposal/confirmation, rollback and concurrency" : "scripts/audit-fixtures/module-actions-capture.test.ts: original PNT master/document/lifecycle actions"] };
  if (id === "TR01") return { coverage:"DEMONSTRATED_ISOLATED", evidence:["scripts/audit-fixtures/module-actions-capture.test.ts: original Review append-only lifecycle"] };
  if (["TR02","TR03","TR04"].includes(id)) return { coverage:"DEMONSTRATED_ISOLATED", evidence:["scripts/audit-fixtures/configuration-capture.test.ts: original configuration writers, activation reason and rollback"] };
  if (id === "TR05") return { coverage:"DEMONSTRATED_ISOLATED", evidence:["scripts/audit-fixtures/module-actions-capture.test.ts: admission and role-policy proposal with authorization evidence"] };
  if (id.startsWith("AU")) return { coverage:"DEMONSTRATED_ISOLATED", evidence:[id === "AU08" || id === "AU09" ? `${moduleEvidence}: annual plan/entry/approvers/immutable programme issuance` : id === "AU06" || id === "AU07" ? "scripts/audit-fixtures/audit-report-capture.test.ts: report issue, retained documents, rollback and closure" : `${moduleEvidence}: audit record/findings/actions/followups/relations and withdrawal`] };
  if (id.startsWith("OO")) return { coverage:"DEMONSTRATED_ISOLATED", evidence:[id === "OO06" ? "scripts/audit-fixtures/oos-capture.test.ts: OOS Anexo III/IV working documents and received signed PDFs with custody, replacement reason and replay (D-088, OOS-3/OOS-4); record evidence uploads, content rejection and replay (D-096)" : "scripts/audit-fixtures/oos-capture.test.ts: original OOS opening, Phase I/II edits, critical reason, closure, relations and annulment (D-088, OOS-2b)"] };
  if (/^(DV|CA|CC|RC|DE)/.test(id)) return { coverage:"DEMONSTRATED_ISOLATED", evidence:[`${moduleEvidence}: original operational create/edit/children/followup/closure/relations/documents`, "scripts/audit-fixtures/module-actions-capture.test.ts: signed custody, administrative state and rollback"] };
  return { coverage:category === "BUSINESS_WRITE" ? "NOT_DEMONSTRATED" : "JUSTIFIED_SEPARATE_STREAM", evidence:[] };
}
export function auditPolicyCatalogue() {
  const inventory = auditWriterInventory(), source = readFileSync("docs/PHASE_4B3_A.md", "utf8"), capture = [...auditCapturePolicy(), oosCaptureTable];
  const prohibitedModels = new Set(["AuthSession", "AuthLoginAttempt", "AuditOperation", "AuditEvent", "AuditOperationTarget", "AuditRuntimeContext", "AuditAggregateCursor", "AuditPilotRecord", "AuditPolicyRequirement", "AuditAdministrationRoot", "AuditEventAdditionalTarget", "AuditBusinessContext", "AuditMutationWitness", "AuditRootBinding", "AuditCaptureTablePolicy", "AuditCaptureFieldPolicy", "AuditOperationEvidence", "AuditCommandResult", "AuditTechnicalContext", "AuditTechnicalEvent", "AuditRootMaturity", "AuditOperationAssessment", "AuditTrailReview", "AuditTrailReviewOperation", "AuditTrailReviewEvent", "AuditTrailExport", "AuditTrailExportEvent"]);
  const secretFields = new Set(["tokenHash", "csrfHash", "nonce", "verifier", "password", "secret", "accessToken", "refreshToken"]);
  const fieldCandidates = Object.fromEntries(Prisma.dmmf.datamodel.models.filter(model => !prohibitedModels.has(model.name)).map(model => [model.name, model.fields.filter(field => field.kind !== "object" && field.type !== "Bytes" && !secretFields.has(field.name)).map(field => ({ name: field.name, type: field.type }))]));
  const rows = source.split("\n").filter(line => /^\| (DV|CA|CC|RC|DE|AU|PN|TR|OO)\d{2} /.test(line));
  const operations = rows.map(line => {
    const cells = line.split("|").slice(1,-1).map(cell => cell.trim()), id = cells[0].slice(0,4);
    const writerGroups = [...new Set([...prefixes[id.slice(0,2)], ...additional[id] ?? []])].sort();
    const sourceFiles = [...new Set([...writerGroups.flatMap(group => groups[group]),...(id==="TR09"?["src/lib/audit/trail.ts","src/lib/audit/trail-actions.ts","src/app/api/audit-trail/exports/[id]/route.ts"]:[])])].sort();
    const writers = inventory.writers.filter(writer => sourceFiles.includes(writer.file));
    const tables = id==="TR09"?["AuditTrailReview","AuditTrailReviewOperation","AuditTrailReviewEvent","AuditTrailExport","AuditTrailExportEvent"]:[...new Set(writers.flatMap(writer => [writer.model, ...writer.nested.map(n => n.model)]))].sort();
    const category = id === "TR09" ? "CONTROLLED_REVIEW_EXPORT" : id === "PN08" ? "READ_NO_BUSINESS_EVENT" : id === "TR06" || id === "PN07" ? "TECHNICAL_SEPARATE_STREAM" : id === "TR08" ? "CONTROLLED_MAINTENANCE_IT_DEPENDENCY" : "BUSINESS_WRITE";
    const captured = capture.filter(policy=>tables.includes(policy.entityType));
    return { id, title: cells[0].slice(5), proposedEvents: cells[5], proposedCriticality: cells[6], testReferences: cells[7].split("/").map(test => test.trim()), category, writerGroups, sourceFiles,
      candidateWriterIndexes: writers.map(writer => inventory.writers.indexOf(writer)),
      tables, auditedFields: captured.flatMap(policy=>policy.fields.map(field=>`${policy.entityType}.${field.fieldPath}`)),
      sqlCapture: captured.map(policy=>({entityType:policy.entityType,captureMode:policy.captureMode,fieldCount:policy.fields.length})),
      reasonRule: "D03_OPTION_B_OPERATION_LEVEL_NO_BLANKET_REASON", ...coverage(id,category) };
  });
  return { schemaVersion: 1, policyVersion: "QMS_B2_DESIGN_V1", base: "70d6a1348a93a9dd51d9beb75a32e2014f375ed3", functionalDesignConfirmed: true, formalGmpAcceptance: "PENDING_QA_DT_IT", activation: "NOT_IMPLEMENTED_NOT_ACTIVATED", writerInventory: "writer-inventory.json", fieldCandidates, prohibitedModels: [...prohibitedModels], secretFields: [...secretFields], writerGroups: groups, operations };
}
if (basename(process.argv[1] ?? "") === "audit-policy-catalog.ts" && process.argv.includes("--print")) process.stdout.write(auditManifestJson(auditPolicyCatalogue()));
