import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import contract from "../../../ops/backup/audit-contract-audit-programme-preparer.json";
import previous from "../../../ops/backup/audit-contract-audit-signatories.json";
import { auditSignatoriesCapturePolicy } from "../../../scripts/audit-audit-signatories-build";
import { auditProgrammePreparerCapturePolicy, auditProgrammePreparerContract, auditProgrammePreparerMigration, auditProgrammePreparerPolicySql } from "../../../scripts/audit-programme-preparer-build";

it("añade «Elaborado por» del programa anual a la captura sin tocar funciones, triggers ni tablas (D-135)", () => {
  expect(auditProgrammePreparerContract()).toEqual(contract);
  const sql = readFileSync(auditProgrammePreparerMigration, "utf8");
  expect(sql).toContain(auditProgrammePreparerPolicySql());
  expect(sql).not.toMatch(/CREATE (OR REPLACE )?FUNCTION|CREATE (CONSTRAINT )?TRIGGER|AuditPolicyRequirement|AuditCaptureTablePolicy/);
  expect({ ...contract, contractVersion: previous.contractVersion, capturePolicySha256: previous.capturePolicySha256 }).toEqual(previous);
  expect(contract.capturePolicySha256).not.toBe(previous.capturePolicySha256);
});

it("registra preparedByName como texto no crítico y solo cambia la política de AuditAnnualPlan", () => {
  const before = auditSignatoriesCapturePolicy();
  const after = auditProgrammePreparerCapturePolicy();
  const changed = after.filter((table, index) => JSON.stringify(table) !== JSON.stringify(before[index]));
  expect(changed.map(table => table.entityType)).toEqual(["AuditAnnualPlan"]);
  expect(changed[0].fields.find(field => field.fieldPath === "preparedByName")).toEqual({ fieldPath: "preparedByName", valueType: "STRING", transform: "VALUE", critical: false });
  expect(changed[0].fields.map(field => field.fieldPath)).toEqual([...changed[0].fields.map(field => field.fieldPath)].sort());
});
