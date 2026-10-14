import { expect,it } from "vitest";
import contract from "../../../ops/backup/audit-contract-b2-critical.json";
import { auditCriticalContract } from "../../../scripts/audit-critical-build";

it("reconciles additive criticality/frozen-version protection without rewriting prior contracts",()=>{
  expect(auditCriticalContract()).toEqual(contract);
  expect(contract.privateTables).toContain("AuditRootMaturity");
  expect(contract.tables).toContain("AuditOperationAssessment");
  expect(contract.triggers.some(t=>t.table==="QmsRecordVersion"&&t.function==="covex_b2_frozen_version_guard")).toBe(true);
});
