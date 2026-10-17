import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import contract from "../../../ops/backup/audit-contract-oos.json";
import previous from "../../../ops/backup/audit-contract-c.json";
import { auditOosContract, oosCapturePolicy, oosCaptureTable, oosMigration, oosPolicySql } from "../../../scripts/audit-oos-build";
import documentsContract from "../../../ops/backup/audit-contract-oos-documents.json";
import { auditOosDocumentsContract, oosDocumentsMigration } from "../../../scripts/audit-oos-documents-build";
import signedContract from "../../../ops/backup/audit-contract-oos-signed.json";
import { auditOosSignedContract, oosSignedMigration } from "../../../scripts/audit-oos-signed-build";

const replaced = ["covex_b2_authorize_root", "covex_b2_before", "covex_b2_begin", "covex_b2_critical_mutation", "covex_b2_observe_maturity"];

it("reconciles additive OosRecord capture without rewriting prior contracts or migrations (D-088, OOS-2b)", () => {
  expect(auditOosContract()).toEqual(contract);
  const sql = readFileSync(oosMigration, "utf8");
  expect(sql).toContain(oosPolicySql());
  expect(sql).not.toMatch(/^INSERT INTO "AuditPolicyRequirement"/m);
  expect(contract.tables).toEqual(previous.tables);
  expect(contract.guardTables).toEqual([...previous.guardTables, "OosRecord"]);
  for (const [name, value] of Object.entries(previous.functions)) {
    if (!replaced.includes(name)) expect(contract.functions[name as keyof typeof contract.functions]).toEqual(value);
  }
  expect(Object.keys(contract.functions).filter(name => contract.functions[name as keyof typeof contract.functions].sha256 !== previous.functions[name as keyof typeof previous.functions]?.sha256).sort()).toEqual(replaced);
  expect(contract.triggers.filter(trigger => trigger.table === "OosRecord").map(trigger => [trigger.name, trigger.type]).sort()).toEqual([["audit_b2_capture", 29], ["audit_b2_required", 31], ["audit_b2_required_truncate", 34], ["audit_b2_witness", 29]]);
});

it("extends only the OO prefix, the OOS module and the OosRecord domain table", () => {
  const sql = readFileSync(oosMigration, "utf8");
  expect(sql).toContain("DE0[1-7]|OO0[1-5]|AU0[1-9]");
  expect(sql).toContain("WHEN 'OO' THEN 'OOS'");
  expect(sql.match(/WHEN 'OOS' THEN 'OosRecord'/g)).toHaveLength(3);
  expect(sql.match(/'ReturnRecord','OosRecord','Audit'/g)).toHaveLength(2);
  expect(oosCaptureTable.fields.filter(field => field.critical).map(field => field.fieldPath)).toEqual(["investigationResult", "phaseIConclusion", "phaseIDisposition", "phaseIInvestigation", "phaseIIConclusion", "phaseIIProductionReview", "phaseIIVerdict", "phaseIVerdict"].sort());
  expect(oosCapturePolicy().filter(table => table.entityType === "OosRecord")).toHaveLength(1);
});

it("admits OO06 OOS annex generation by widening only covex_b2_begin (D-088, OOS-3)", () => {
  expect(auditOosDocumentsContract()).toEqual(documentsContract);
  const sql = readFileSync(oosDocumentsMigration, "utf8");
  expect(sql).toContain("DE0[1-7]|OO0[1-6]|AU0[1-9]");
  expect(sql).not.toContain("OO0[1-5]");
  expect(sql).not.toMatch(/^INSERT INTO "AuditPolicyRequirement"/m);
  expect(Object.keys(documentsContract.functions).filter(name => documentsContract.functions[name as keyof typeof documentsContract.functions].sha256 !== contract.functions[name as keyof typeof contract.functions]?.sha256)).toEqual(["covex_b2_begin"]);
  expect({ ...documentsContract, contractVersion: contract.contractVersion, functions: contract.functions }).toEqual(contract);
});

it("keeps OOS signed Anexo III/IV PDFs by widening only covex_b2_retain_signed_original (D-088, OOS-4)", () => {
  expect(auditOosSignedContract()).toEqual(signedContract);
  const sql = readFileSync(oosSignedMigration, "utf8");
  expect(sql).toContain(`WHEN 'OOS' THEN CASE document_kind WHEN 'OOS_ANNEX_III_SIGNED' THEN 'OOS_ANNEX_III' WHEN 'OOS_ANNEX_IV_SIGNED' THEN 'OOS_ANNEX_IV' END`);
  expect(sql).toContain(`root."recordType"<>'OOS' AND document_kind LIKE 'OOS\\_%'`);
  expect(sql).not.toMatch(/^INSERT INTO "AuditPolicyRequirement"/m);
  expect(Object.keys(signedContract.functions).filter(name => signedContract.functions[name as keyof typeof signedContract.functions].sha256 !== documentsContract.functions[name as keyof typeof documentsContract.functions]?.sha256)).toEqual(["covex_b2_retain_signed_original"]);
  expect({ ...signedContract, contractVersion: documentsContract.contractVersion, functions: documentsContract.functions }).toEqual(documentsContract);
});
