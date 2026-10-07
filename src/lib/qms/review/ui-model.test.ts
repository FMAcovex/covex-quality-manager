import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activeReviewCount,
  formatReviewDateTime,
  reviewTabHref,
  reviewTargetHref,
  reviewThreadCapabilities,
  reviewThreadContextLabel,
  reviewVersionLabel,
} from "@/lib/qms/review/ui-model";
import { reviewTargetWithValue } from "@/lib/qms/review/targets/catalog";
import { complaintReviewTargets } from "@/lib/qms/review/targets/complaints";

afterEach(() => vi.unstubAllEnvs());

describe("fechas Review e hidratación", () => {
  it("renders the reported CAPA instant identically in server and browser time zones", () => {
    const value = "2026-10-07T09:21:00.000Z";
    const labels = ["UTC", "Europe/Madrid", "America/New_York", "Asia/Tokyo"].map((zone) => {
      vi.stubEnv("TZ", zone);
      return formatReviewDateTime(value);
    });
    expect(labels).toEqual(Array(4).fill("7 oct 2026, 9:21 UTC"));
  });

  it("keeps the date stable across midnight and daylight-saving transitions", () => {
    for (const value of ["2026-10-07T23:21:00Z", "2026-10-25T00:30:00Z", "2026-10-25T01:30:00Z"]) {
      vi.stubEnv("TZ", "UTC");
      const server = formatReviewDateTime(value);
      vi.stubEnv("TZ", "Europe/Madrid");
      expect(formatReviewDateTime(value)).toBe(server);
    }
  });

  it("degrades absent or invalid historical dates without throwing", () => {
    for (const value of [null, "", "fecha histórica inválida"]) expect(formatReviewDateTime(value)).toBe("—");
  });
});

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

  it("adapta la etiqueta de versión al vocabulario del módulo", () => {
    expect(reviewVersionLabel(0)).toBe("V00");
    expect(reviewVersionLabel(2, "FOLLOWUP")).toBe("Seguimiento 02");
    expect(reviewVersionLabel(null, "FOLLOWUP")).toBe("Sin versión");
  });

  it("oculta completamente el contexto de versión cuando el módulo no tiene versiones funcionales", () => {
    expect(
      reviewThreadContextLabel({
        tabKey: "summary",
        sectionKey: "general-data",
        sequence: null,
        showVersionContext: false,
      }),
    ).toBe("summary · general-data");
    expect(
      reviewThreadContextLabel({
        tabKey: "summary",
        sectionKey: "general-data",
        sequence: 0,
        showVersionContext: false,
      }),
    ).not.toContain("V00");
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
