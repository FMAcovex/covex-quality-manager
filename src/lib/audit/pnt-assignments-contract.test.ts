import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import contract from "../../../ops/backup/audit-contract-pnt-assignments.json";
import previous from "../../../ops/backup/audit-contract-deviation-shift.json";
import { deviationShiftCapturePolicy } from "../../../scripts/audit-deviation-shift-build";
import { auditPntAssignmentsContract, pntAssignmentFields, pntAssignmentsCapturePolicy, pntAssignmentsMigration, pntAssignmentsPolicySql } from "../../../scripts/audit-pnt-assignments-build";

it("añade los responsables de PNT a la captura sin tocar funciones, triggers ni tablas (D-118)", () => {
  expect(auditPntAssignmentsContract()).toEqual(contract);
  const sql = readFileSync(pntAssignmentsMigration, "utf8");
  expect(sql).toContain(pntAssignmentsPolicySql());
  expect(sql).not.toMatch(/CREATE (OR REPLACE )?FUNCTION|CREATE (CONSTRAINT )?TRIGGER|AuditPolicyRequirement|AuditCaptureTablePolicy/);
  expect({ ...contract, contractVersion: previous.contractVersion, capturePolicySha256: previous.capturePolicySha256 }).toEqual(previous);
  expect(contract.capturePolicySha256).not.toBe(previous.capturePolicySha256);
});

it("registra los responsables y fechas como campos no críticos y solo cambia ControlledDocument y ControlledDocumentRevision", () => {
  const before = deviationShiftCapturePolicy();
  const after = pntAssignmentsCapturePolicy();
  const changed = after.filter((table, index) => JSON.stringify(table) !== JSON.stringify(before[index]));
  expect(changed.map(table => table.entityType).sort()).toEqual(["ControlledDocument", "ControlledDocumentRevision"]);
  for (const [entity, fieldPath, valueType] of pntAssignmentFields) {
    const table = changed.find(item => item.entityType === entity)!;
    expect(table.fields.find(field => field.fieldPath === fieldPath)).toEqual({ fieldPath, valueType, transform: "VALUE", critical: false });
    expect(table.fields.map(field => field.fieldPath)).toEqual([...table.fields.map(field => field.fieldPath)].sort());
  }
});
