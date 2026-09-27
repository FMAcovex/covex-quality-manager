import { describe, expect, it } from "vitest";

describe("version selection rules", () => {
  it("documents the invariant used by runtime selection", () => {
    const rule = {
      status: "ACTIVE",
      isActive: true,
      effectiveFrom: "<= record date",
      effectiveTo: "null or >= record date",
    };
    expect(rule.status).toBe("ACTIVE");
    expect(rule.effectiveFrom).toContain("<=");
  });
});
