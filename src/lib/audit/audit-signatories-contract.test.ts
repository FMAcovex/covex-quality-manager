import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import contract from "../../../ops/backup/audit-contract-audit-signatories.json";
import previous from "../../../ops/backup/audit-contract-qms-text-tables.json";
import { qmsTextTablesCapturePolicy } from "../../../scripts/audit-qms-text-tables-build";
import { auditSignatoriesCapturePolicy, auditSignatoriesContract, auditSignatoriesMigration, auditSignatoriesPolicySql } from "../../../scripts/audit-audit-signatories-build";

it("añade los firmantes de la auditoría a la captura sin tocar funciones, triggers ni tablas (D-134)", () => {
  expect(auditSignatoriesContract()).toEqual(contract);
  const sql = readFileSync(auditSignatoriesMigration, "utf8");
  expect(sql).toContain(auditSignatoriesPolicySql());
  expect(sql).not.toMatch(/CREATE (OR REPLACE )?FUNCTION|CREATE (CONSTRAINT )?TRIGGER|AuditPolicyRequirement|AuditCaptureTablePolicy/);
  expect({ ...contract, contractVersion: previous.contractVersion, capturePolicySha256: previous.capturePolicySha256 }).toEqual(previous);
  expect(contract.capturePolicySha256).not.toBe(previous.capturePolicySha256);
});

it("registra signatories como JSON no crítico y solo cambia la política de Audit", () => {
  const before = qmsTextTablesCapturePolicy();
  const after = auditSignatoriesCapturePolicy();
  const changed = after.filter((table, index) => JSON.stringify(table) !== JSON.stringify(before[index]));
  expect(changed.map(table => table.entityType)).toEqual(["Audit"]);
  expect(changed[0].fields.find(field => field.fieldPath === "signatories")).toEqual({ fieldPath: "signatories", valueType: "JSON", transform: "VALUE", critical: false });
  expect(changed[0].fields.map(field => field.fieldPath)).toEqual([...changed[0].fields.map(field => field.fieldPath)].sort());
});
