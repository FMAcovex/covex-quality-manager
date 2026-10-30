import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import contract from "../../../ops/backup/audit-contract-deviation-text-tables.json";
import previous from "../../../ops/backup/audit-contract-deviation-investigation-tools.json";
import { deviationToolsCapturePolicy } from "../../../scripts/audit-deviation-tools-build";
import { auditDeviationTextTablesContract, deviationTextTablesCapturePolicy, deviationTextTablesMigration, deviationTextTablesPolicySql } from "../../../scripts/audit-deviation-text-tables-build";

it("añade las tablas de los textos de Desviaciones a la captura sin tocar funciones, triggers ni tablas (D-127)", () => {
  expect(auditDeviationTextTablesContract()).toEqual(contract);
  const sql = readFileSync(deviationTextTablesMigration, "utf8");
  expect(sql).toContain(deviationTextTablesPolicySql());
  expect(sql).not.toMatch(/CREATE (OR REPLACE )?FUNCTION|CREATE (CONSTRAINT )?TRIGGER|AuditPolicyRequirement|AuditCaptureTablePolicy/);
  expect({ ...contract, contractVersion: previous.contractVersion, capturePolicySha256: previous.capturePolicySha256 }).toEqual(previous);
  expect(contract.capturePolicySha256).not.toBe(previous.capturePolicySha256);
});

it("registra textTables como JSON no crítico y solo cambia la política de Deviation", () => {
  const before = deviationToolsCapturePolicy();
  const after = deviationTextTablesCapturePolicy();
  const changed = after.filter((table, index) => JSON.stringify(table) !== JSON.stringify(before[index]));
  expect(changed.map(table => table.entityType)).toEqual(["Deviation"]);
  const fields = changed[0].fields;
  expect(fields.find(field => field.fieldPath === "textTables")).toEqual({ fieldPath: "textTables", valueType: "JSON", transform: "VALUE", critical: false });
  expect(fields.map(field => field.fieldPath)).toEqual([...fields.map(field => field.fieldPath)].sort());
});
