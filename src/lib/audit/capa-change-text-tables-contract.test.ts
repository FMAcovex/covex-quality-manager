import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import contract from "../../../ops/backup/audit-contract-capa-change-text-tables.json";
import previous from "../../../ops/backup/audit-contract-deviation-text-tables.json";
import { deviationTextTablesCapturePolicy } from "../../../scripts/audit-deviation-text-tables-build";
import { auditCapaChangeTextTablesContract, capaChangeTextTablesCapturePolicy, capaChangeTextTablesMigration, capaChangeTextTablesPolicySql } from "../../../scripts/audit-capa-change-text-tables-build";

it("añade las tablas de los textos de CAPA y Controles de cambios a la captura sin tocar funciones, triggers ni tablas (D-127)", () => {
  expect(auditCapaChangeTextTablesContract()).toEqual(contract);
  const sql = readFileSync(capaChangeTextTablesMigration, "utf8");
  expect(sql).toContain(capaChangeTextTablesPolicySql());
  expect(sql).not.toMatch(/CREATE (OR REPLACE )?FUNCTION|CREATE (CONSTRAINT )?TRIGGER|AuditPolicyRequirement|AuditCaptureTablePolicy/);
  expect({ ...contract, contractVersion: previous.contractVersion, capturePolicySha256: previous.capturePolicySha256 }).toEqual(previous);
  expect(contract.capturePolicySha256).not.toBe(previous.capturePolicySha256);
});

it("registra textTables como JSON no crítico y solo cambia las políticas de Capa y ChangeControl", () => {
  const before = deviationTextTablesCapturePolicy();
  const after = capaChangeTextTablesCapturePolicy();
  const changed = after.filter((table, index) => JSON.stringify(table) !== JSON.stringify(before[index]));
  expect(changed.map(table => table.entityType).sort()).toEqual(["Capa", "ChangeControl"]);
  for (const table of changed) {
    expect(table.fields.find(field => field.fieldPath === "textTables")).toEqual({ fieldPath: "textTables", valueType: "JSON", transform: "VALUE", critical: false });
    expect(table.fields.map(field => field.fieldPath)).toEqual([...table.fields.map(field => field.fieldPath)].sort());
  }
});
