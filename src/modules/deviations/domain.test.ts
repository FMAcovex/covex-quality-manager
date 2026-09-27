import { describe, expect, it } from "vitest";
import { deadlineLabel, measuresLabel } from "@/modules/deviations/domain";

describe("measuresLabel", () => {
  it("derives the operational measure without duplicating capture", () => {
    expect(measuresLabel({ immediateActions: [], capaPlans: [] })).toBe("Ninguna");
    expect(measuresLabel({ immediateActions: [{}], capaPlans: [] })).toBe("Correctiva inmediata");
    expect(measuresLabel({ immediateActions: [], capaPlans: [{}] })).toBe("CAPA");
    expect(measuresLabel({ immediateActions: [{}], capaPlans: [{}] })).toBe("Correctiva inmediata + CAPA");
  });
});

describe("deadlineLabel", () => {
  it("does not invent a compliance result when deadlines are not configured", () => {
    expect(deadlineLabel("NOT_EVALUATED")).toBe("No evaluado");
  });
});
