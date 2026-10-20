import { describe, expect, it } from "vitest";
import { sectionAnchorId } from "./section-anchor";

describe("Anclas de los apartados del índice lateral", () => {
  it("crea un id estable a partir del título", () => {
    expect(sectionAnchorId("E. Investigación", new Set())).toBe("apartado-e-investigacion");
    expect(sectionAnchorId("F-G. Causa raíz", new Set())).toBe("apartado-f-g-causa-raiz");
  });
  it("no repite ids", () => {
    const used = new Set<string>();
    expect(sectionAnchorId("E. Investigación", used)).toBe("apartado-e-investigacion");
    expect(sectionAnchorId("E. Investigación", used)).toBe("apartado-e-investigacion-2");
  });
  it("recorta títulos largos y admite títulos vacíos", () => {
    expect(sectionAnchorId("x".repeat(100), new Set()).length).toBeLessThanOrEqual(60);
    expect(sectionAnchorId("", new Set())).toBe("apartado");
  });
});
