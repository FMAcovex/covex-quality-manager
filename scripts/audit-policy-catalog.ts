import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { Prisma } from "@prisma/client";
import { auditWriterInventory } from "./audit-writer-inventory";
import { auditManifestJson } from "./audit-manifest-format";

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
  W15: ["src/lib/qms/signed-version-document.ts"],
  W16: ["src/app/api/deviations/[id]/annex-iii/route.ts", "src/app/api/capa/[id]/annex-iii/route.ts", "src/app/api/changes/[id]/annex-iii/route.ts", "src/app/api/changes/[id]/annex-iv/route.ts", "src/app/api/changes/[id]/annex-v/route.ts", "src/app/api/complaints/[id]/annex-iii/route.ts", "src/app/api/complaints/[id]/annex-iv/route.ts", "src/modules/returns/documents/archive.ts", "src/modules/audits/documents/service.ts"],
  W17: ["src/modules/configuration/admin-actions.ts"],
  W18: ["src/lib/auth/administration.ts", "scripts/auth-provision.ts"],
  W19: ["src/lib/auth/oidc.ts", "src/lib/auth/session.ts", "src/app/api/reminders/manual/route.ts"],
  W20: ["src/modules/deviations/import/import-service.ts", "src/modules/capa/import/import-service.ts", "scripts/backfill-record-versions.ts"],
  W21: ["scripts/install-template-bundle.ts", "scripts/install-document-templates.ts", "scripts/install-capa-templates.ts", "scripts/install-change-control-templates.ts", "scripts/install-complaint-template.ts", "scripts/install-return-template.ts", "scripts/install-audit-templates.ts", "scripts/install-annual-audit-programme-templates.ts"],
  W22: ["ops/backup/backup.py", "ops/release.py", "ops/postgres/roles.sql", "ops/postgres/audit-owner.sql", "ops/postgres/audit-grants.sql"],
};
const prefixes: Record<string, string[]> = { DV: ["W01"], CA: ["W02"], CC: ["W03"], RC: ["W04"], DE: ["W05"], AU: ["W06"], PN: ["W08"], TR: [] };
const additional: Record<string,string[]> = {
  DV01: ["W14"], DV06: ["W14"], DV07: ["W12"], DV08: ["W12", "W15", "W16"],
  CA01: ["W12", "W14"], CA06: ["W14"], CA07: ["W12"], CA08: ["W15", "W16"],
  CC01: ["W14"], CC06: ["W12"], CC07: ["W14", "W15", "W16"],
  RC01: ["W14"], RC05: ["W14"], RC06: ["W12"], RC07: ["W15", "W16"],
  DE01: ["W14"], DE05: ["W14"], DE06: ["W12"], DE07: ["W15", "W16"],
  AU05: ["W12"], AU06: ["W14", "W16"], AU07: ["W12", "W14"], AU08: ["W07"], AU09: ["W07"],
  PN02: ["W09"], PN03: ["W09"], PN04: ["W09"], PN05: ["W10"], PN06: ["W11"], PN07: ["W11"], PN08: ["W10"],
  TR01: ["W13"], TR02: ["W17"], TR03: ["W17"], TR04: ["W17", "W21"], TR05: ["W18"], TR06: ["W19"], TR07: ["W20"], TR08: ["W22"], TR09: [],
};
export function auditPolicyCatalogue() {
  const inventory = auditWriterInventory(), source = readFileSync("docs/PHASE_4B3_A.md", "utf8");
  const prohibitedModels = new Set(["AuthSession", "AuthLoginAttempt", "AuditOperation", "AuditEvent", "AuditOperationTarget", "AuditRuntimeContext", "AuditAggregateCursor", "AuditPilotRecord"]);
  const secretFields = new Set(["tokenHash", "csrfHash", "nonce", "verifier", "password", "secret", "accessToken", "refreshToken"]);
  const fieldCandidates = Object.fromEntries(Prisma.dmmf.datamodel.models.filter(model => !prohibitedModels.has(model.name)).map(model => [model.name, model.fields.filter(field => field.kind !== "object" && field.type !== "Bytes" && !secretFields.has(field.name)).map(field => ({ name: field.name, type: field.type }))]));
  const rows = source.split("\n").filter(line => /^\| (DV|CA|CC|RC|DE|AU|PN|TR)\d{2} /.test(line));
  const operations = rows.map(line => {
    const cells = line.split("|").slice(1,-1).map(cell => cell.trim()), id = cells[0].slice(0,4);
    const writerGroups = [...new Set([...prefixes[id.slice(0,2)], ...additional[id] ?? []])].sort();
    const sourceFiles = [...new Set(writerGroups.flatMap(group => groups[group]))].sort();
    const writers = inventory.writers.filter(writer => sourceFiles.includes(writer.file));
    const tables = [...new Set(writers.flatMap(writer => [writer.model, ...writer.nested.map(n => n.model)]))].sort();
    const category = id === "TR09" ? "DEFERRED_C" : id === "PN08" ? "READ_NO_BUSINESS_EVENT" : id === "TR06" || id === "PN07" ? "TECHNICAL_SEPARATE_STREAM" : id === "TR08" ? "CONTROLLED_MAINTENANCE_IT_DEPENDENCY" : "BUSINESS_WRITE";
    return { id, title: cells[0].slice(5), proposedEvents: cells[5], proposedCriticality: cells[6], testReferences: cells[7].split("/").map(test => test.trim()), category, writerGroups, sourceFiles,
      candidateWriterIndexes: writers.map(writer => inventory.writers.indexOf(writer)),
      tables, auditedFields: [], sqlCapture: [], reasonRule: "D03_OPTION_B_OPERATION_LEVEL_NO_BLANKET_REASON", coverage: "NOT_DEMONSTRATED", evidence: [] };
  });
  return { schemaVersion: 1, policyVersion: "QMS_B2_DESIGN_V1", base: "70d6a1348a93a9dd51d9beb75a32e2014f375ed3", functionalDesignConfirmed: true, formalGmpAcceptance: "PENDING_QA_DT_IT", activation: "NOT_IMPLEMENTED_NOT_ACTIVATED", writerInventory: "writer-inventory.json", fieldCandidates, prohibitedModels: [...prohibitedModels], secretFields: [...secretFields], writerGroups: groups, operations };
}
if (basename(process.argv[1] ?? "") === "audit-policy-catalog.ts" && process.argv.includes("--print")) process.stdout.write(auditManifestJson(auditPolicyCatalogue()));
