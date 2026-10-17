import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import contract from "../../../ops/backup/audit-contract-oos.json";
import previous from "../../../ops/backup/audit-contract-c.json";
import { auditOosContract, oosCapturePolicy, oosCaptureTable, oosMigration, oosPolicySql } from "../../../scripts/audit-oos-build";

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
