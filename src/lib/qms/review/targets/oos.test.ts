import { describe, expect, it } from "vitest";
import { ReviewTargetKind } from "@prisma/client";
import {
  assertUniqueReviewTargetAnchors,
  reviewTargetWithValue,
} from "@/lib/qms/review/targets/catalog";
import { oosReviewTargets } from "@/lib/qms/review/targets/oos";

describe("catálogo de revisión de OOS", () => {
  it("mantiene anchors y claves únicos y módulo estable", () => {
    const targets = Object.values(oosReviewTargets);
    expect(() => assertUniqueReviewTargetAnchors(targets)).not.toThrow();
    expect(new Set(targets.map((target) => target.key)).size).toBe(targets.length);
    expect(targets.every((target) => target.module === "OOS")).toBe(true);
  });

  it("separa datos iniciales, Fase I, Fase II y relaciones en pestañas propias", () => {
    const tabs = new Set(Object.values(oosReviewTargets).map((target) => target.tabKey));
    expect([...tabs].sort()).toEqual(["phase-i", "phase-ii", "relations", "summary"]);
    expect(oosReviewTargets.detection).toMatchObject({
      targetKind: ReviewTargetKind.FIELD,
      fieldPath: "detectionDescription",
    });
    expect(oosReviewTargets.phaseIIConclusion.tabKey).toBe("phase-ii");
  });

  it("captura el valor visible sin mutar la definición", () => {
    const target = reviewTargetWithValue(oosReviewTargets.detection, "Valoración fuera de especificación");
    expect(target.valueSnapshot).toBe("Valoración fuera de especificación");
    expect(oosReviewTargets.detection).not.toHaveProperty("valueSnapshot");
  });
});
