import { describe, expect, it } from "vitest";
import { ReviewTargetKind } from "@prisma/client";
import {
  assertUniqueReviewTargetAnchors,
  reviewTargetWithValue,
} from "@/lib/qms/review/targets/catalog";
import {
  deviationCapaPlanReviewTarget,
  deviationImmediateActionReviewTarget,
  deviationReviewTargets,
} from "@/lib/qms/review/targets/deviations";

describe("catálogo de revisión de Desviaciones", () => {
  it("mantiene anchors únicos y módulo estable", () => {
    const targets = Object.values(deviationReviewTargets);
    expect(() => assertUniqueReviewTargetAnchors(targets)).not.toThrow();
    expect(new Set(targets.map((target) => target.anchorId)).size).toBe(
      targets.length,
    );
    expect(targets.every((target) => target.module === "DEVIATION")).toBe(true);
  });

  it("incluye objetivos FIELD y SECTION con navegación estable", () => {
    expect(deviationReviewTargets.rootCause).toMatchObject({
      targetKind: ReviewTargetKind.FIELD,
      tabKey: "investigation",
      sectionKey: "root-cause",
      fieldPath: "rootCause",
      anchorId: "review-deviation-root-cause",
    });
    expect(deviationReviewTargets.impactAssessment).toMatchObject({
      targetKind: ReviewTargetKind.SECTION,
      tabKey: "investigation",
      sectionKey: "impact",
      fieldPath: null,
    });
  });

  it("construye acciones inmediatas con su UUID real", () => {
    const target = deviationImmediateActionReviewTarget(
      "75AA8B7D-ED1A-4AB0-A723-5C34A5D4F101",
      "Contención inmediata",
    );
    expect(target).toMatchObject({
      targetKind: ReviewTargetKind.ITEM,
      targetEntityType: "DeviationImmediateAction",
      targetEntityId: "75AA8B7D-ED1A-4AB0-A723-5C34A5D4F101",
      fieldPath: "description",
      anchorId:
        "review-deviation-immediate-action-75aa8b7d-ed1a-4ab0-a723-5c34a5d4f101",
    });
  });

  it("construye propuestas CAPA con su UUID real", () => {
    const target = deviationCapaPlanReviewTarget(
      "75AA8B7D-ED1A-4AB0-A723-5C34A5D4F102",
      "Actualizar el procedimiento",
    );
    expect(target).toMatchObject({
      targetKind: ReviewTargetKind.ITEM,
      targetEntityType: "DeviationCapaPlan",
      targetEntityId: "75AA8B7D-ED1A-4AB0-A723-5C34A5D4F102",
      fieldPath: "description",
      anchorId:
        "review-deviation-capa-plan-75aa8b7d-ed1a-4ab0-a723-5c34a5d4f102",
    });
  });

  it("captura el valor visible sin mutar la definición", () => {
    const target = reviewTargetWithValue(
      deviationReviewTargets.rootCause,
      "Causa observada",
    );
    expect(target.valueSnapshot).toBe("Causa observada");
    expect(target.targetEntityId).toBeNull();
    expect(deviationReviewTargets.rootCause).not.toHaveProperty("valueSnapshot");
  });
});
