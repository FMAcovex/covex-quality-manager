import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import contract from "../../../ops/backup/audit-contract-b2-documents.json";
import { auditDocumentContract, documentPolicySql, documentMigration } from "../../../scripts/audit-document-build";

it("reconciles the additive original custody policy and protection contract without rewriting prior migrations", () => {
  expect(auditDocumentContract()).toEqual(contract);
  expect(readFileSync(documentMigration, "utf8")).toContain(documentPolicySql());
  expect(contract.tables).toContain("SignedDocumentCustody");
  expect(contract.triggers.some(t => t.table === "GeneratedDocument" && t.function === "covex_b2_signed_original_immutable")).toBe(true);
});
