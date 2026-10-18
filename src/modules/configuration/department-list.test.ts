import { describe, expect, it } from "vitest";
import { parseDepartmentList } from "./department-list";

describe("alta de departamentos desde el índice (D-097)", () => {
  it("normaliza código y nombre", () => {
    expect(parseDepartmentList(JSON.stringify([{ code: " gc-11 ", name: "  Control de Calidad: Área de Análisis " }]))).toEqual({
      departments: [{ code: "GC-11", name: "Control de Calidad: Área de Análisis" }],
    });
  });
  it("rechaza listas vacías, JSON inválido, códigos mal formados, nombres vacíos y repetidos", () => {
    expect(parseDepartmentList("[]").error).toMatch(/al menos un departamento/);
    expect(parseDepartmentList("{").error).toMatch(/no válida/);
    expect(parseDepartmentList(JSON.stringify([{ code: "GC11", name: "X" }])).error).toMatch(/formato XX-00/);
    expect(parseDepartmentList(JSON.stringify([{ code: "GC-11", name: " " }])).error).toMatch(/necesita nombre/);
    expect(parseDepartmentList(JSON.stringify([{ code: "GC-11", name: "A" }, { code: "gc-11", name: "B" }])).error).toMatch(/repetidos/);
  });
});
