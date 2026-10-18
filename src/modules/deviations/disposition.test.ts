import { describe, expect, it } from "vitest";
import { dispositionAnnexMarks, dispositionChoice } from "./disposition";

describe("disposición final de la desviación (opción A)", () => {
  it("reconoce las opciones del anexo sin depender de mayúsculas, tildes ni guiones", () => {
    expect(dispositionChoice("aprobado")).toEqual({ option: "Aprobado", legacyText: null });
    expect(dispositionChoice("RECHAZADO - DESTRUIR")).toEqual({ option: "Rechazado – Destruir", legacyText: null });
    expect(dispositionChoice(" ")).toEqual({ option: null, legacyText: null });
  });
  it("conserva un texto libre anterior como «Otro» en lugar de adivinar la casilla", () => {
    expect(dispositionChoice("No aprobado, pendiente de QA")).toEqual({ option: "Otro", legacyText: "No aprobado, pendiente de QA" });
  });
  it("marca solo las casillas de la opción y la línea de cantidad que le corresponde", () => {
    expect(dispositionAnnexMarks("Aprobado")).toEqual({ checkboxes: [true, false, false, false, false], quantityLine: 0 });
    expect(dispositionAnnexMarks("Rechazado – Devolver")).toEqual({ checkboxes: [false, true, false, true, false], quantityLine: 2 });
    expect(dispositionAnnexMarks("Rechazado")).toEqual({ checkboxes: [false, true, false, false, false], quantityLine: null });
    expect(dispositionAnnexMarks("Otro")).toEqual({ checkboxes: [false, false, false, false, true], quantityLine: null });
  });
});
