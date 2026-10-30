import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import contract from "../../../ops/backup/audit-contract-qms-text-tables.json";
import previous from "../../../ops/backup/audit-contract-capa-change-text-tables.json";
import { capaChangeTextTablesCapturePolicy } from "../../../scripts/audit-capa-change-text-tables-build";
import { auditQmsTextTablesContract, qmsTextTablesCapturePolicy, qmsTextTablesMigration, qmsTextTablesPolicySql } from "../../../scripts/audit-qms-text-tables-build";

it("añade las tablas de los textos de OOS, Reclamaciones y Devoluciones a la captura sin tocar funciones, triggers ni tablas (D-127)", () => {
  expect(auditQmsTextTablesContract()).toEqual(contract);
  const sql = readFileSync(qmsTextTablesMigration, "utf8");
  expect(sql).toContain(qmsTextTablesPolicySql());
  expect(sql).not.toMatch(/CREATE (OR REPLACE )?FUNCTION|CREATE (CONSTRAINT )?TRIGGER|AuditPolicyRequirement|AuditCaptureTablePolicy/);
  expect({ ...contract, contractVersion: previous.contractVersion, capturePolicySha256: previous.capturePolicySha256 }).toEqual(previous);
  expect(contract.capturePolicySha256).not.toBe(previous.capturePolicySha256);
});

it("registra textTables como JSON no crítico y solo cambia las políticas de Complaint, OosRecord y ReturnRecord", () => {
  const before = capaChangeTextTablesCapturePolicy();
  const after = qmsTextTablesCapturePolicy();
  const changed = after.filter((table, index) => JSON.stringify(table) !== JSON.stringify(before[index]));
  expect(changed.map(table => table.entityType).sort()).toEqual(["Complaint", "OosRecord", "ReturnRecord"]);
  for (const table of changed) {
    expect(table.fields.find(field => field.fieldPath === "textTables")).toEqual({ fieldPath: "textTables", valueType: "JSON", transform: "VALUE", critical: false });
    expect(table.fields.map(field => field.fieldPath)).toEqual([...table.fields.map(field => field.fieldPath)].sort());
  }
});
