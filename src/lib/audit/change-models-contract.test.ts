import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import contract from "../../../ops/backup/audit-contract-change-control-models.json";
import previous from "../../../ops/backup/audit-contract-pnt-assignments.json";
import { pntAssignmentsCapturePolicy } from "../../../scripts/audit-pnt-assignments-build";
import { auditChangeModelsContract, changeModelsCapturePolicy, changeModelsCaptureTable, changeModelsMigration, changeModelsPolicySql } from "../../../scripts/audit-change-models-build";

it("añade la tabla de modelos de Control de cambios a la captura, como AlertRule (D-122)", () => {
  expect(auditChangeModelsContract()).toEqual(contract);
  const sql = readFileSync(changeModelsMigration, "utf8");
  expect(sql).toContain(changeModelsPolicySql());
  expect(sql).not.toMatch(/CREATE (OR REPLACE )?FUNCTION|AuditPolicyRequirement/);
  for (const trigger of ["audit_b2_required", "audit_b2_required_truncate", "audit_b2_capture", "audit_b2_witness"]) expect(sql).toContain(`CREATE TRIGGER ${trigger} `);
  expect(contract.guardTables).toEqual([...previous.guardTables, "ChangeControlModel"]);
  expect(contract.triggers.slice(0, previous.triggers.length)).toEqual(previous.triggers);
  expect(contract.triggers.slice(previous.triggers.length).map(t => t.table)).toEqual(Array(4).fill("ChangeControlModel"));
  expect({ ...contract, contractVersion: previous.contractVersion, capturePolicySha256: previous.capturePolicySha256, guardTables: previous.guardTables, triggers: previous.triggers }).toEqual(previous);
});

it("solo añade ChangeControlModel, con raíz de configuración y campos no críticos, sin fechas técnicas", () => {
  const before = pntAssignmentsCapturePolicy();
  const after = changeModelsCapturePolicy();
  expect(after.filter(table => !before.some(old => JSON.stringify(old) === JSON.stringify(table))).map(table => table.entityType)).toEqual(["ChangeControlModel"]);
  expect(changeModelsCaptureTable.rootPaths).toEqual(after.find(table => table.entityType === "AlertRule")!.rootPaths);
  expect(changeModelsCaptureTable.fields.every(field => !field.critical && field.transform === "VALUE")).toBe(true);
  expect(changeModelsCaptureTable.fields.map(field => field.fieldPath)).not.toContain("createdAt");
});
