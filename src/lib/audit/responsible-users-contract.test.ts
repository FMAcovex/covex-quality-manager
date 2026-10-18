import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import contract from "../../../ops/backup/audit-contract-responsible-users.json";
import previous from "../../../ops/backup/audit-contract-additional-lots.json";
import { auditResponsibleUsersContract, responsibleUserFields, responsibleUsersCapturePolicy, responsibleUsersMigration, responsibleUsersPolicySql } from "../../../scripts/audit-responsible-users-build";

it("añade el usuario responsable a la captura sin tocar funciones, triggers ni tablas (D-101)", () => {
  expect(auditResponsibleUsersContract()).toEqual(contract);
  const sql = readFileSync(responsibleUsersMigration, "utf8");
  expect(sql).toContain(responsibleUsersPolicySql());
  expect(sql).not.toMatch(/CREATE (OR REPLACE )?FUNCTION|CREATE (CONSTRAINT )?TRIGGER|AuditPolicyRequirement|AuditCaptureTablePolicy/);
  expect({ ...contract, contractVersion: previous.contractVersion, capturePolicySha256: previous.capturePolicySha256 }).toEqual(previous);
  expect(contract.capturePolicySha256).not.toBe(previous.capturePolicySha256);
});

it("registra cada usuario responsable como texto no crítico junto a su campo de texto", () => {
  const policy = responsibleUsersCapturePolicy();
  for (const [entity, field] of responsibleUserFields) {
    const table = policy.find((item) => item.entityType === entity)!;
    expect(table.fields.find((item) => item.fieldPath === field)).toEqual({ fieldPath: field, valueType: "STRING", transform: "VALUE", critical: false });
    expect(table.fields.map((item) => item.fieldPath)).toEqual([...table.fields.map((item) => item.fieldPath)].sort());
  }
});
