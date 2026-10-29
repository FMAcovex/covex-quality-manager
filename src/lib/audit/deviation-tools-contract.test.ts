import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import contract from "../../../ops/backup/audit-contract-deviation-investigation-tools.json";
import previous from "../../../ops/backup/audit-contract-change-control-models.json";
import { changeModelsCapturePolicy } from "../../../scripts/audit-change-models-build";
import { auditDeviationToolsContract, deviationToolsCapturePolicy, deviationToolsMigration, deviationToolsPolicySql } from "../../../scripts/audit-deviation-tools-build";

it("añade las herramientas de investigación de Desviaciones a la captura sin tocar funciones, triggers ni tablas (D-123)", () => {
  expect(auditDeviationToolsContract()).toEqual(contract);
  const sql = readFileSync(deviationToolsMigration, "utf8");
  expect(sql).toContain(deviationToolsPolicySql());
  expect(sql).not.toMatch(/CREATE (OR REPLACE )?FUNCTION|CREATE (CONSTRAINT )?TRIGGER|AuditPolicyRequirement|AuditCaptureTablePolicy/);
  expect({ ...contract, contractVersion: previous.contractVersion, capturePolicySha256: previous.capturePolicySha256 }).toEqual(previous);
  expect(contract.capturePolicySha256).not.toBe(previous.capturePolicySha256);
});

it("registra investigationTools como JSON no crítico y solo cambia la política de Deviation", () => {
  const before = changeModelsCapturePolicy();
  const after = deviationToolsCapturePolicy();
  const changed = after.filter((table, index) => JSON.stringify(table) !== JSON.stringify(before[index]));
  expect(changed.map(table => table.entityType)).toEqual(["Deviation"]);
  const fields = changed[0].fields;
  expect(fields.find(field => field.fieldPath === "investigationTools")).toEqual({ fieldPath: "investigationTools", valueType: "JSON", transform: "VALUE", critical: false });
  expect(fields.map(field => field.fieldPath)).toEqual([...fields.map(field => field.fieldPath)].sort());
});
