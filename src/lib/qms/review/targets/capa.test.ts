import { describe, expect, it } from "vitest";
import { ReviewTargetKind } from "@prisma/client";
import {
  assertUniqueReviewTargetAnchors,
  reviewTargetWithValue,
} from "@/lib/qms/review/targets/catalog";
import {
  capaActionFollowupReviewTarget,
  capaPlannedActionReviewTarget,
  capaReviewTargets,
} from "@/lib/qms/review/targets/capa";

describe("catálogo de revisión de CAPA", () => {
  it("mantiene anchors únicos y módulo estable", () => {
    const targets = Object.values(capaReviewTargets);
    expect(() => assertUniqueReviewTargetAnchors(targets)).not.toThrow();
    expect(new Set(targets.map((target) => target.anchorId)).size).toBe(
      targets.length,
    );
    expect(targets.every((target) => target.module === "CAPA")).toBe(true);
  });

  it("incluye objetivos FIELD y SECTION con navegación estable", () => {
    expect(capaReviewTargets.rootCause).toMatchObject({
      targetKind: ReviewTargetKind.FIELD,
      tabKey: "summary",
      sectionKey: "root-cause",
      fieldPath: "rootCause",
      anchorId: "review-capa-root-cause",
    });
    expect(capaReviewTargets.plannedActions).toMatchObject({
      targetKind: ReviewTargetKind.SECTION,
      tabKey: "summary",
      sectionKey: "planned-actions",
      fieldPath: null,
    });
  });

  it("construye acciones propuestas con CapaPlannedAction y UUID real", () => {
    const target = capaPlannedActionReviewTarget(
      "75AA8B7D-ED1A-4AB0-A723-5C34A5D4F201",
      { description: "Actualizar PNT", responsible: "GC" },
    );
    expect(target).toMatchObject({
      targetKind: ReviewTargetKind.ITEM,
      targetEntityType: "CapaPlannedAction",
      targetEntityId: "75AA8B7D-ED1A-4AB0-A723-5C34A5D4F201",
      fieldPath: "description",
      anchorId:
        "review-capa-planned-action-75aa8b7d-ed1a-4ab0-a723-5c34a5d4f201",
    });
  });

  it("construye seguimientos de acción con CapaActionFollowup y UUID real", () => {
    const target = capaActionFollowupReviewTarget(
      "75AA8B7D-ED1A-4AB0-A723-5C34A5D4F202",
      { date: "02/10/2026", description: "Acción ejecutada" },
    );
    expect(target).toMatchObject({
      targetKind: ReviewTargetKind.ITEM,
      targetEntityType: "CapaActionFollowup",
      targetEntityId: "75AA8B7D-ED1A-4AB0-A723-5C34A5D4F202",
      fieldPath: "description",
      anchorId:
        "review-capa-action-followup-75aa8b7d-ed1a-4ab0-a723-5c34a5d4f202",
    });
  });

  it("captura el valor visible sin mutar la definición", () => {
    const target = reviewTargetWithValue(
      capaReviewTargets.effectivenessAssessment,
      "Eficacia conforme",
    );
    expect(target.valueSnapshot).toBe("Eficacia conforme");
    expect(target.targetEntityId).toBeNull();
    expect(capaReviewTargets.effectivenessAssessment).not.toHaveProperty(
      "valueSnapshot",
    );
  });
});
