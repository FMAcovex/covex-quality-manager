import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { auditWriterInventory } from "../../../scripts/audit-writer-inventory";

describe("B2 static writer reconnaissance", () => {
  it("detects nested writes, bulk calls, tagged SQL and independent clients without publishing source values", () => {
    const root = mkdtempSync(join(tmpdir(), "covex-b2-inventory-"));
    try {
      mkdirSync(join(root, "src")); mkdirSync(join(root, "scripts"));
      writeFileSync(join(root, "src", "candidate.ts"), [
        "const client = new PrismaClient();",
        "async function save(tx) {",
        "await tx.qmsRecord.create({ data: { recordType: 'DEVIATION', deviation: { create: { whatHappened: 'do-not-publish-source-value' } } } });",
        "await tx.deviation.updateMany({ where: filter, data: changes });",
        "await tx.$executeRaw`SELECT controlled_function()`;",
        "}",
      ].join("\n"));
      const result = auditWriterInventory(root);
      expect(result.writers).toHaveLength(2);
      expect(result.writers[0].nested).toContainEqual({ path: "deviation", model: "Deviation", operation: "create" });
      expect(result.writers[0].function).toBe("save");
      expect(result.rawSql).toHaveLength(1); expect(result.independentClients).toHaveLength(1);
      expect(JSON.stringify(result)).not.toContain("do-not-publish-source-value");
      expect(JSON.stringify(result)).not.toContain("controlled_function");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it("requires reconciliation when a writer, SQL candidate or its source changes", () => {
    const stored = JSON.parse(readFileSync("src/lib/audit/writer-inventory.json", "utf8"));
    expect(auditWriterInventory()).toEqual(stored);
  });
});
