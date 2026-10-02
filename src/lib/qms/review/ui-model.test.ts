import { describe, expect, it } from "vitest";
import {
  activeReviewCount,
  reviewTabHref,
  reviewTargetHref,
  reviewThreadCapabilities,
} from "@/lib/qms/review/ui-model";
import { reviewTargetWithValue } from "@/lib/qms/review/targets/catalog";
import { complaintReviewTargets } from "@/lib/qms/review/targets/complaints";

describe("modelo visual de revisión", () => {
  it("cuenta PENDING y ACCEPTED, pero excluye RESOLVED", () => {
    expect(activeReviewCount({ PENDING: 2, ACCEPTED: 3, RESOLVED: 9 })).toBe(5);
  });

  it("mantiene el modo de revisión al cambiar de pestaña", () => {
    expect(reviewTabHref("/complaints/abc", "part-ii", true)).toBe(
      "/complaints/abc?tab=part-ii&review=1",
    );
    expect(reviewTabHref("/complaints/abc", "part-ii", false)).toBe(
      "/complaints/abc?tab=part-ii",
    );
  });

  it("crea el href Ir al campo con pestaña, modo, hilo y anchor estable", () => {
    const target = reviewTargetWithValue(
      complaintReviewTargets.rootCause,
      "Causa observada",
    );
    expect(reviewTargetHref("/complaints/abc", target, "thread-1")).toBe(
      "/complaints/abc?tab=part-i&review=1&thread=thread-1#review-complaint-root-cause",
    );
  });

  it("hace los hilos resueltos estrictamente de solo lectura", () => {
    expect(reviewThreadCapabilities("RESOLVED")).toEqual({
      canReply: false,
      canAccept: false,
      canResolve: false,
      readOnly: true,
    });
    expect(reviewThreadCapabilities("ACCEPTED")).toMatchObject({
      canReply: true,
      canAccept: false,
      canResolve: true,
      readOnly: false,
    });
  });
});
