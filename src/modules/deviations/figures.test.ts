import { describe, expect, it } from "vitest";
import { DEVIATION_FIGURE_SECTIONS, figureSectionLabel, numberFigures, parseFigureSection } from "./figures";

// D-125: figuras pegadas en los apartados de una desviación.
describe("Figuras de Desviaciones (D-125)", () => {
  it("solo admite los apartados con texto del formulario", () => {
    expect(DEVIATION_FIGURE_SECTIONS.map(([key]) => key)).toEqual(["DESCRIPTION", "IMMEDIATE_ACTIONS", "INVESTIGATION", "ROOT_CAUSE", "IMPACT", "CONCLUSION"]);
    expect(parseFigureSection("INVESTIGATION")).toBe("INVESTIGATION");
    expect(parseFigureSection("")).toBeNull();
    expect(parseFigureSection(null)).toBeNull();
    expect(() => parseFigureSection("ANEXO")).toThrow("Apartado de la figura no válido.");
    expect(figureSectionLabel("ROOT_CAUSE")).toBe("F-G. Causa raíz");
  });

  it("numera las figuras del expediente por orden de alta, en todos los apartados", () => {
    const at = (minute: number) => new Date(Date.UTC(2026, 9, 30, 10, minute));
    const numbered = numberFigures([
      { id: "c", section: "INVESTIGATION", generatedAt: at(3) },
      { id: "a", section: "DESCRIPTION", generatedAt: at(1) },
      { id: "b", section: "INVESTIGATION", generatedAt: at(2) },
    ]);
    expect(numbered.map((figure) => [figure.id, figure.number])).toEqual([["a", 1], ["b", 2], ["c", 3]]);
  });
});
