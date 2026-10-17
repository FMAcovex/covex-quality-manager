import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import contract from "../../../ops/backup/audit-contract-additional-lots.json";
import previous from "../../../ops/backup/audit-contract-root-cause.json";
import { additionalLotsCapturePolicy, additionalLotsEntities, additionalLotsMigration, additionalLotsPolicySql, auditAdditionalLotsContract } from "../../../scripts/audit-additional-lots-build";

it("añade additionalLots a la captura sin tocar funciones, triggers ni tablas (D-094)", () => {
  expect(auditAdditionalLotsContract()).toEqual(contract);
  const sql = readFileSync(additionalLotsMigration, "utf8");
  expect(sql).toContain(additionalLotsPolicySql());
  expect(sql).not.toMatch(/CREATE (OR REPLACE )?FUNCTION|CREATE (CONSTRAINT )?TRIGGER|AuditPolicyRequirement|AuditCaptureTablePolicy/);
  expect({ ...contract, contractVersion: previous.contractVersion, capturePolicySha256: previous.capturePolicySha256 }).toEqual(previous);
  expect(contract.capturePolicySha256).not.toBe(previous.capturePolicySha256);
});

it("registra la lista como JSON no crítico solo en los módulos con lote", () => {
  const withField = additionalLotsCapturePolicy().filter(table => table.fields.some(field => field.fieldPath === "additionalLots"));
  expect(withField.map(table => table.entityType).sort()).toEqual([...additionalLotsEntities].sort());
  for (const table of withField) expect(table.fields.map(field => field.fieldPath)).toEqual([...table.fields.map(field => field.fieldPath)].sort());
});
