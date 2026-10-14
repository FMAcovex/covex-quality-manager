import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import contract from "../../../ops/backup/audit-contract-b2-capture.json";
import { auditCaptureContract, auditCaptureMigration, captureMigration } from "../../../scripts/audit-capture-build";
import { auditCapturePolicy } from "../../../scripts/audit-capture-policy";

describe("B2 SQL capture foundation release", () => {
  it("reconciles compiled policy, SQL functions and every installed hook", () => {
    expect(auditCaptureMigration()).toBe(readFileSync(captureMigration,"utf8"));
    expect(auditCaptureContract()).toEqual(contract);
  });
  it("selects typed business values and hashes snapshots without copying binary/secret payloads", () => {
    const policy = auditCapturePolicy();
    expect(policy.map(t => t.entityType)).toEqual(contract.guardTables);
    expect(policy.every(t => t.primaryKey.length && t.rootPaths.length && t.fields.length)).toBe(true);
    const fields = policy.flatMap(t => t.fields);
    expect(fields.some(f => /fileData|tokenHash|csrfHash|nonce|verifier/.test(f.fieldPath))).toBe(false);
    expect(fields.some(f => f.fieldPath === "snapshot" && f.transform === "VALUE")).toBe(false);
    expect(policy.find(t => t.entityType === "Deviation")?.fields.find(f => f.fieldPath === "issueDate")?.valueType).toBe("DATE");
    expect(policy.find(t => t.entityType === "QmsRelation")?.rootPaths).toHaveLength(2);
    expect(policy.find(t => t.entityType === "HistoricalImportBatch")?.fields.find(f => f.fieldPath === "years")?.valueType).toBe("JSON");
  });
});
