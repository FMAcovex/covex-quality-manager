import { describe, expect, it } from "vitest";
import { ReviewTargetKind } from "@prisma/client";
import {
  assertUniqueReviewTargetAnchors,
  reviewTargetWithValue,
} from "@/lib/qms/review/targets/catalog";
import {
  complaintCapaPlanReviewTarget,
  complaintReviewTargets,
} from "@/lib/qms/review/targets/complaints";

describe("catálogo de revisión de Reclamaciones", () => {
  it("mantiene anchors únicos e identidades estructurales", () => {
    const targets = Object.values(complaintReviewTargets);
    expect(() => assertUniqueReviewTargetAnchors(targets)).not.toThrow();
    expect(new Set(targets.map((target) => target.anchorId)).size).toBe(
      targets.length,
    );
    expect(targets.every((target) => target.module === "COMPLAINT")).toBe(true);
    expect(targets.every((target) => !target.key.includes(target.label))).toBe(
      true,
    );
  });

  it("incluye objetivos FIELD y SECTION con sus claves de navegación", () => {
    expect(complaintReviewTargets.rootCause).toMatchObject({
      targetKind: ReviewTargetKind.FIELD,
      tabKey: "part-i",
      sectionKey: "root-cause",
      fieldPath: "rootCause",
      anchorId: "review-complaint-root-cause",
    });
    expect(complaintReviewTargets.derivedActions).toMatchObject({
      targetKind: ReviewTargetKind.SECTION,
      tabKey: "part-i",
      sectionKey: "derived-actions",
    });
  });

  it("construye objetivos ITEM con el identificador real", () => {
    const target = complaintCapaPlanReviewTarget(
      "75AA8B7D-ED1A-4AB0-A723-5C34A5D4F001",
      "Acción visible",
    );
    expect(target).toMatchObject({
      targetKind: ReviewTargetKind.ITEM,
      targetEntityType: "ComplaintCapaPlan",
      targetEntityId: "75AA8B7D-ED1A-4AB0-A723-5C34A5D4F001",
      fieldPath: "description",
      valueSnapshot: "Acción visible",
      anchorId:
        "review-complaint-capa-plan-75aa8b7d-ed1a-4ab0-a723-5c34a5d4f001",
    });
  });

  it("captura el valor visible sin alterar la definición estable", () => {
    const target = reviewTargetWithValue(
      complaintReviewTargets.rootCause,
      "Causa observada",
    );
    expect(target.valueSnapshot).toBe("Causa observada");
    expect(target.targetEntityId).toBeNull();
    expect(complaintReviewTargets.rootCause).not.toHaveProperty("valueSnapshot");
  });
});
