import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import contract from "../../../ops/backup/audit-contract-root-cause.json";
import previous from "../../../ops/backup/audit-contract-oos-signed.json";
import { auditRootCauseContract, rootCauseCapturePolicy, rootCauseEntities, rootCauseMigration, rootCausePolicySql } from "../../../scripts/audit-root-cause-build";

it("añade rootCauseCategories a la captura sin tocar funciones, triggers ni tablas", () => {
  expect(auditRootCauseContract()).toEqual(contract);
  const sql = readFileSync(rootCauseMigration, "utf8");
  expect(sql).toContain(rootCausePolicySql());
  expect(sql).not.toMatch(/CREATE (OR REPLACE )?FUNCTION|CREATE (CONSTRAINT )?TRIGGER|AuditPolicyRequirement|AuditCaptureTablePolicy/);
  expect({ ...contract, contractVersion: previous.contractVersion, capturePolicySha256: previous.capturePolicySha256 }).toEqual(previous);
  expect(contract.capturePolicySha256).not.toBe(previous.capturePolicySha256);
});

it("registra el campo como JSON no crítico solo en los cuatro módulos con causa raíz", () => {
  const withField = rootCauseCapturePolicy().filter(table => table.fields.some(field => field.fieldPath === "rootCauseCategories"));
  expect(withField.map(table => table.entityType).sort()).toEqual([...rootCauseEntities].sort());
  for (const table of withField) {
    expect(table.fields.find(field => field.fieldPath === "rootCauseCategories")).toEqual({ fieldPath: "rootCauseCategories", valueType: "JSON", transform: "VALUE", critical: false });
    expect(table.fields.map(field => field.fieldPath)).toEqual([...table.fields.map(field => field.fieldPath)].sort());
  }
});
