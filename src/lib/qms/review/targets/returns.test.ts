import { describe, expect, it } from "vitest";
import { ReviewTargetKind } from "@prisma/client";
import {
  assertUniqueReviewTargetAnchors,
  reviewTargetWithValue,
} from "@/lib/qms/review/targets/catalog";
import {
  returnFollowupReviewTarget,
  returnProductReviewTarget,
  returnReviewTargets,
} from "@/lib/qms/review/targets/returns";

describe("catálogo de revisión de devoluciones", () => {
  it("mantiene anchors únicos y módulo estable", () => {
    const targets = Object.values(returnReviewTargets);
    expect(() => assertUniqueReviewTargetAnchors(targets)).not.toThrow();
    expect(new Set(targets.map((target) => target.anchorId)).size).toBe(
      targets.length,
    );
    expect(targets.every((target) => target.module === "RETURN")).toBe(true);
  });

  it("incluye secciones estables para datos, comprobaciones y relaciones", () => {
    expect(returnReviewTargets.generalData).toMatchObject({
      targetKind: ReviewTargetKind.SECTION,
      tabKey: "summary",
      sectionKey: "general-data",
    });
    expect(returnReviewTargets.checksGeneral).toMatchObject({
      targetKind: ReviewTargetKind.SECTION,
      tabKey: "checks",
      sectionKey: "reintegration-checks",
    });
    expect(returnReviewTargets.complaintOrigin).toMatchObject({
      targetKind: ReviewTargetKind.SECTION,
      tabKey: "relations",
      sectionKey: "complaint-origin",
    });
  });

  it("construye ReturnProduct con UUID real", () => {
    const target = returnProductReviewTarget(
      "75AA8B7D-ED1A-4AB0-A723-5C34A5D4F301",
      { productNameCode: "API-001", lot: "L-01" },
    );
    expect(target).toMatchObject({
      targetKind: ReviewTargetKind.ITEM,
      targetEntityType: "ReturnProduct",
      targetEntityId: "75AA8B7D-ED1A-4AB0-A723-5C34A5D4F301",
      anchorId:
        "review-return-product-75aa8b7d-ed1a-4ab0-a723-5c34a5d4f301",
    });
  });

  it("construye ReturnFollowup con UUID real", () => {
    const target = returnFollowupReviewTarget(
      "75AA8B7D-ED1A-4AB0-A723-5C34A5D4F302",
      { comment: "Seguimiento realizado" },
    );
    expect(target).toMatchObject({
      targetKind: ReviewTargetKind.ITEM,
      targetEntityType: "ReturnFollowup",
      targetEntityId: "75AA8B7D-ED1A-4AB0-A723-5C34A5D4F302",
      anchorId:
        "review-return-followup-75aa8b7d-ed1a-4ab0-a723-5c34a5d4f302",
    });
  });

  it("captura el valor visible sin mutar la definición", () => {
    const target = reviewTargetWithValue(
      returnReviewTargets.finalDestination,
      "Destrucción",
    );
    expect(target.valueSnapshot).toBe("Destrucción");
    expect(target.targetEntityId).toBeNull();
    expect(returnReviewTargets.finalDestination).not.toHaveProperty(
      "valueSnapshot",
    );
  });
});
