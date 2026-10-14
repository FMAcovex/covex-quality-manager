import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import b1 from "../../../ops/backup/audit-contract.json";
import b2 from "../../../ops/backup/audit-contract-b2.json";

describe("durable B2 requirement contract", () => {
  const sql = readFileSync("prisma/migrations/20261013000200_b2_audit_requirement/migration.sql", "utf8");
  it("preserves the B1 function/pilot contract and defines no activation by installation", () => {
    for (const [name, definition] of Object.entries(b1.functions)) expect(b2.functions[name as keyof typeof b2.functions]).toEqual(definition);
    expect(sql).not.toMatch(/^INSERT INTO "AuditPolicyRequirement"/m);
    expect(sql).not.toContain("ALLOW_DEMO_DATA");
    expect(sql).not.toContain("current_setting('covex.audit.enabled");
    expect(sql).toContain("REVOKE ALL ON FUNCTION covex_b2_require_policy(TEXT),covex_b2_required_guard(),covex_b2_required_truncate() FROM PUBLIC");
  });
  it("identifies every foundation function and guard instead of counting service helpers", () => {
    for (const match of sql.matchAll(/CREATE FUNCTION (covex_b2_\w+)\([\s\S]*? AS \$\$([\s\S]*?)\$\$;/g)) {
      expect(createHash("sha256").update(match[2]).digest("hex")).toBe(b2.functions[match[1] as keyof typeof b2.functions].sha256);
    }
    const tables = [...sql.matchAll(/CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "(\w+)"/g)].map(match => match[1]);
    expect(tables).toEqual(b2.guardTables);
    expect(tables).not.toContain("AuthSession"); expect(tables).not.toContain("AuthLoginAttempt");
    expect(tables).toContain("RecordVersionDocument"); expect(tables).toContain("CapaPlannedAction");
    expect(tables).toContain("ControlledDocumentImportRow");
    expect([...sql.matchAll(/CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "(\w+)"/g)].map(match => match[1])).toEqual(tables);
  });
});
