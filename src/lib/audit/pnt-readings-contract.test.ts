import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import contract from "../../../ops/backup/audit-contract-pnt-readings.json";
import previous from "../../../ops/backup/audit-contract-audit-finding-root-cause.json";
import { auditFindingRootCauseCapturePolicy } from "../../../scripts/audit-finding-root-cause-build";
import { auditPntReadingsContract, pntReadingsCapturePolicy, pntReadingsCaptureTable, pntReadingsMigration, pntReadingsPolicySql } from "../../../scripts/audit-pnt-readings-build";

it("añade la tabla de lecturas de PNT a la captura, con raíz en el PNT (D-141)", () => {
  expect(auditPntReadingsContract()).toEqual(contract);
  const sql = readFileSync(pntReadingsMigration, "utf8");
  expect(sql).toContain(pntReadingsPolicySql());
  expect(sql).not.toMatch(/CREATE (OR REPLACE )?FUNCTION|AuditPolicyRequirement/);
  for (const trigger of ["audit_b2_required", "audit_b2_required_truncate", "audit_b2_capture", "audit_b2_witness"]) expect(sql).toContain(`CREATE TRIGGER ${trigger} `);
  expect(contract.guardTables).toEqual([...previous.guardTables, "ControlledReadingAssignment"]);
  expect(contract.triggers.slice(0, previous.triggers.length)).toEqual(previous.triggers);
  expect(contract.triggers.slice(previous.triggers.length).map(t => t.table)).toEqual(Array(4).fill("ControlledReadingAssignment"));
  expect({ ...contract, contractVersion: previous.contractVersion, capturePolicySha256: previous.capturePolicySha256, guardTables: previous.guardTables, triggers: previous.triggers }).toEqual(previous);
});

it("solo añade ControlledReadingAssignment, con la raíz de las revisiones del PNT, campos no críticos y sin fechas técnicas", () => {
  const before = auditFindingRootCauseCapturePolicy();
  const after = pntReadingsCapturePolicy();
  expect(after.filter(table => !before.some(old => JSON.stringify(old) === JSON.stringify(table))).map(table => table.entityType)).toEqual(["ControlledReadingAssignment"]);
  expect(pntReadingsCaptureTable.rootPaths).toEqual(after.find(table => table.entityType === "ControlledDocumentRevision")!.rootPaths);
  expect(pntReadingsCaptureTable.fields.every(field => !field.critical && field.transform === "VALUE")).toBe(true);
  expect(pntReadingsCaptureTable.fields.map(field => field.fieldPath)).not.toContain("createdAt");
  expect(pntReadingsCaptureTable.fields.map(field => field.fieldPath)).not.toContain("updatedAt");
});
