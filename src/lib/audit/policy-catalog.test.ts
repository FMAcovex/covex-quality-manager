import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { auditPolicyCatalogue } from "../../../scripts/audit-policy-catalog";

describe("B2 operation matrix honesty and reconciliation", () => {
  it("accounts for all 63 IDs and W01-W22 with executable evidence or an explicit tested exclusion", () => {
    const catalogue = auditPolicyCatalogue();
    expect(catalogue.operations).toHaveLength(63);
    expect(new Set(catalogue.operations.map(op => op.id)).size).toBe(63);
    expect(Object.keys(catalogue.writerGroups)).toHaveLength(22);
    for (const paths of Object.values(catalogue.writerGroups)) for (const path of paths) expect(existsSync(path), path).toBe(true);
    for (const operation of catalogue.operations) {
      expect(operation.coverage).not.toBe("NOT_DEMONSTRATED");
      expect(operation.evidence.length).toBeGreaterThan(0);
      if (operation.coverage === "DEMONSTRATED_ISOLATED") {
        expect(operation.auditedFields.length).toBeGreaterThan(0);
        expect(operation.sqlCapture.length).toBeGreaterThan(0);
      }
    }
    expect(catalogue.operations.find(op => op.id === "TR09")?.category).toBe("CONTROLLED_REVIEW_EXPORT");
    expect(catalogue.operations.find(op => op.id === "TR09")?.tables).toContain("AuditTrailExportEvent");
    expect(catalogue.operations.find(op => op.id === "PN08")?.category).toBe("READ_NO_BUSINESS_EVENT");
    expect(catalogue.operations.find(op => op.id === "TR07")?.coverage).toBe("JUSTIFIED_EXCLUSION_BLOCKED");
    expect(catalogue.formalGmpAcceptance).toBe("PENDING_QA_DT_IT");
  });
  it("keeps the published matrix aligned with real source writers", () => {
    expect(auditPolicyCatalogue()).toEqual(JSON.parse(readFileSync("src/lib/audit/policy-catalog.json", "utf8")));
  });
});
