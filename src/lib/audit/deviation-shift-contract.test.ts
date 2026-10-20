import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import contract from "../../../ops/backup/audit-contract-deviation-shift.json";
import previous from "../../../ops/backup/audit-contract-capa-plan.json";
import { capaPlanCapturePolicy } from "../../../scripts/audit-capa-plan-build";
import { auditDeviationShiftContract, deviationShiftCapturePolicy, deviationShiftMigration, deviationShiftPolicySql } from "../../../scripts/audit-deviation-shift-build";

it("añade el turno de Desviaciones a la captura sin tocar funciones, triggers ni tablas (D-116)", () => {
  expect(auditDeviationShiftContract()).toEqual(contract);
  const sql = readFileSync(deviationShiftMigration, "utf8");
  expect(sql).toContain(deviationShiftPolicySql());
  expect(sql).not.toMatch(/CREATE (OR REPLACE )?FUNCTION|CREATE (CONSTRAINT )?TRIGGER|AuditPolicyRequirement|AuditCaptureTablePolicy/);
  expect({ ...contract, contractVersion: previous.contractVersion, capturePolicySha256: previous.capturePolicySha256 }).toEqual(previous);
  expect(contract.capturePolicySha256).not.toBe(previous.capturePolicySha256);
});

it("registra shift como texto no crítico y solo cambia la política de Deviation", () => {
  const before = capaPlanCapturePolicy();
  const after = deviationShiftCapturePolicy();
  const changed = after.filter((table, index) => JSON.stringify(table) !== JSON.stringify(before[index]));
  expect(changed.map(table => table.entityType)).toEqual(["Deviation"]);
  const fields = changed[0].fields;
  expect(fields.find(field => field.fieldPath === "shift")).toEqual({ fieldPath: "shift", valueType: "STRING", transform: "VALUE", critical: false });
  expect(fields.map(field => field.fieldPath)).toEqual([...fields.map(field => field.fieldPath)].sort());
});
