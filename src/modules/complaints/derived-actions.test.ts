import { describe, expect, it } from "vitest";
import { derivedActionBusinessCode, reservedProposalProblem } from "./derived-actions";

// RET1: el código de una devolución propuesta lo pone la devolución al abrirse; guardar la reclamación con un
// formulario abierto antes (campo de solo lectura vacío) no lo borra ni lo cambia.
describe("código de la acción derivada al guardar la reclamación", () => {
  it("devolución: conserva el código ya registrado aunque el formulario lo envíe vacío o distinto", () => {
    expect(derivedActionBusinessCode("RETURN", "DEV/LG-10/001/2026", "")).toBe("DEV/LG-10/001/2026");
    expect(derivedActionBusinessCode("RETURN", "DEV/LG-10/001/2026", null)).toBe("DEV/LG-10/001/2026");
    expect(derivedActionBusinessCode("RETURN", "DEV/LG-10/001/2026", "DEV/LG-10/099/2026")).toBe("DEV/LG-10/001/2026");
  });
  it("devolución sin código previo: el del formulario (referencia histórica) o ninguno", () => {
    expect(derivedActionBusinessCode("RETURN", null, "DEV/LG-10/007/2024")).toBe("DEV/LG-10/007/2024");
    expect(derivedActionBusinessCode("RETURN", null, "")).toBeNull();
    expect(derivedActionBusinessCode("RETURN", undefined, undefined)).toBeNull();
  });
  it("otros tipos: se puede corregir o vaciar la referencia", () => {
    expect(derivedActionBusinessCode("OTRA", "REF-1", "REF-2")).toBe("REF-2");
    expect(derivedActionBusinessCode("OTRA", "REF-1", "")).toBeNull();
  });
});

// RET1: una devolución propuesta reservada por un borrador de devolución no se quita ni cambia de tipo.
describe("propuestas de devolución reservadas por un borrador", () => {
  const existing = [{ id: "p1", actionType: "RETURN" }, { id: "p2", actionType: "RETURN" }];
  it("sin reservas, se puede quitar o cambiar cualquiera", () => {
    expect(reservedProposalProblem(existing, [], new Set())).toBeNull();
  });
  it("no se puede quitar una propuesta reservada", () => {
    expect(reservedProposalProblem(existing, [{ id: "p2", actionType: "RETURN" }], new Set(["p1"]))).toMatch(/borrador de devolución/);
  });
  it("no se puede cambiar de tipo una propuesta reservada", () => {
    expect(reservedProposalProblem(existing, [{ id: "p1", actionType: "OTRA" }, { id: "p2", actionType: "RETURN" }], new Set(["p1"]))).toMatch(/borrador de devolución/);
  });
  it("los demás cambios se permiten", () => {
    expect(reservedProposalProblem(existing, [{ id: "p1", actionType: "RETURN" }], new Set(["p1"]))).toBeNull();
  });
});
