import { expect, it } from "vitest";
import contract from "../../../ops/backup/audit-contract-b2-staging.json";
import { auditStagingContract } from "../../../scripts/audit-staging-build";

it("reconciles the additive bounded technical staging contract and protects its private lease", () => {
  expect(auditStagingContract()).toEqual(contract);
  expect(contract.privateTables).toContain("AuditTechnicalContext");
  expect(contract.functions).toHaveProperty("covex_b2_expire_staging");
  expect(contract.triggers.some(t => t.table === "AuditTechnicalEvent" && t.function === "covex_audit_immutable")).toBe(true);
});
