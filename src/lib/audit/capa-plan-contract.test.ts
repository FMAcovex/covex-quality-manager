import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import contract from "../../../ops/backup/audit-contract-capa-plan.json";
import previous from "../../../ops/backup/audit-contract-responsible-users.json";
import { auditCapaPlanContract, capaPlanCaptureTable, capaPlanMigration, capaPlanPolicySql } from "../../../scripts/audit-capa-plan-build";

it("añade AuditCapaPlanVersion a la captura sin tocar funciones ni tablas de auditoría (D-110, R5C1)", () => {
  expect(auditCapaPlanContract()).toEqual(contract);
  const sql = readFileSync(capaPlanMigration, "utf8");
  expect(sql).toContain(capaPlanPolicySql());
  expect(sql).not.toMatch(/CREATE (OR REPLACE )?FUNCTION covex_|AuditPolicyRequirement/);
  expect(contract.functions).toEqual(previous.functions);
  expect(contract.tables).toEqual(previous.tables);
  expect(contract.guardTables).toEqual([...previous.guardTables, "AuditCapaPlanVersion"]);
  expect(contract.triggers.filter(trigger => trigger.table === "AuditCapaPlanVersion").map(trigger => [trigger.name, trigger.type]).sort())
    .toEqual([["audit_b2_capture", 29], ["audit_b2_required", 31], ["audit_b2_required_truncate", 34], ["audit_b2_witness", 29]]);
  expect(sql).toContain('CREATE TRIGGER immutable_audit_capa_plan_version BEFORE UPDATE OR DELETE ON "AuditCapaPlanVersion"');
});

it("captura la versión sin copiar el binario y con la foto resumida por hash", () => {
  const fields = capaPlanCaptureTable.fields.map(field => field.fieldPath);
  expect(fields).not.toContain("fileData");
  expect(fields).toEqual([...fields].sort());
  expect(capaPlanCaptureTable.fields.find(field => field.fieldPath === "snapshot")).toMatchObject({ transform: "SHA256_JSON" });
  expect(capaPlanCaptureTable.fields.every(field => !field.critical)).toBe(true);
  expect(capaPlanCaptureTable.rootPaths).toEqual([{ via: "auditId", table: "Audit" }]);
});
