import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import contract from "../../../ops/backup/audit-contract-audit-finding-root-cause.json";
import previous from "../../../ops/backup/audit-contract-audit-programme-preparer.json";
import { auditProgrammePreparerCapturePolicy } from "../../../scripts/audit-programme-preparer-build";
import { auditFindingRootCauseCapturePolicy, auditFindingRootCauseContract, auditFindingRootCauseMigration, auditFindingRootCausePolicySql } from "../../../scripts/audit-finding-root-cause-build";

it("añade la causa raíz del hallazgo a la captura sin tocar funciones, triggers ni tablas (D-136)", () => {
  expect(auditFindingRootCauseContract()).toEqual(contract);
  const sql = readFileSync(auditFindingRootCauseMigration, "utf8");
  expect(sql).toContain(auditFindingRootCausePolicySql());
  expect(sql).not.toMatch(/CREATE (OR REPLACE )?FUNCTION|CREATE (CONSTRAINT )?TRIGGER|AuditPolicyRequirement|AuditCaptureTablePolicy/);
  expect({ ...contract, contractVersion: previous.contractVersion, capturePolicySha256: previous.capturePolicySha256 }).toEqual(previous);
  expect(contract.capturePolicySha256).not.toBe(previous.capturePolicySha256);
});

it("registra rootCause como texto no crítico y solo cambia la política de AuditFinding", () => {
  const before = auditProgrammePreparerCapturePolicy();
  const after = auditFindingRootCauseCapturePolicy();
  const changed = after.filter((table, index) => JSON.stringify(table) !== JSON.stringify(before[index]));
  expect(changed.map(table => table.entityType)).toEqual(["AuditFinding"]);
  expect(changed[0].fields.find(field => field.fieldPath === "rootCause")).toEqual({ fieldPath: "rootCause", valueType: "STRING", transform: "VALUE", critical: false });
  expect(changed[0].fields.map(field => field.fieldPath)).toEqual([...changed[0].fields.map(field => field.fieldPath)].sort());
});
