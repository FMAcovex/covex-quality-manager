import { expect, it } from "vitest";
import contract from "../../../ops/backup/audit-contract-b2-integration.json";
import { auditIntegrationContract } from "../../../scripts/audit-integration-build";

it("reconciles the additive command protection contract with immutable prior releases", () => {
  expect(auditIntegrationContract()).toEqual(contract);
  expect(contract.tables).toContain("AuditCommandResult");
  expect(contract.privateTables).toContain("AuditBusinessContext");
  expect(contract.triggers.filter(t => t.table === "AuditCommandResult")).toHaveLength(2);
});
