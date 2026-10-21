import { describe, expect, it } from "vitest";
import { fieldIssuesFromErrors, generalErrors } from "./field-issues";

describe("fieldIssuesFromErrors (D-117)", () => {
  const rules = [
    ["El departamento es obligatorio.", "departmentId"],
    [/^La fecha (\w+) no es válida\.$/, (match: RegExpMatchArray) => match[1]],
    [/^Producto \d+:/, "productsJson"],
  ] as const;
  it("asocia cada mensaje con su campo y deja fuera los que no tienen campo", () => {
    expect(fieldIssuesFromErrors(["El departamento es obligatorio.", "La fecha receivedAt no es válida.", "Producto 2: lote es obligatorio.", "Producto 3: formato es obligatorio.", "Mensaje general."], rules)).toEqual({
      departmentId: ["El departamento es obligatorio."],
      receivedAt: ["La fecha receivedAt no es válida."],
      productsJson: ["Producto 2: lote es obligatorio.", "Producto 3: formato es obligatorio."],
    });
  });
  it("sin errores no devuelve campos", () => {
    expect(fieldIssuesFromErrors([], rules)).toEqual({});
  });
});

describe("generalErrors (D-117)", () => {
  it("deja en el aviso general solo los mensajes sin campo", () => {
    expect(generalErrors(["A.", "B.", "C."], { x: ["B."] })).toEqual(["A.", "C."]);
    expect(generalErrors(undefined, undefined)).toEqual([]);
  });
});
