import { expect, it } from "vitest";
import { derivedActionBusinessCode } from "./derived-actions";

// RET1: el código de una devolución propuesta lo pone la devolución al abrirse; guardar la reclamación con un
// formulario abierto antes (campo de solo lectura vacío) no lo borra.
it("conserva el código ya registrado aunque el formulario lo envíe vacío", () => {
  expect(derivedActionBusinessCode("DEV/LG-10/001/2026", "")).toBe("DEV/LG-10/001/2026");
  expect(derivedActionBusinessCode("DEV/LG-10/001/2026", null)).toBe("DEV/LG-10/001/2026");
});
it("sin código previo usa el del formulario (referencias históricas) o ninguno", () => {
  expect(derivedActionBusinessCode(null, "DEV/LG-10/007/2024")).toBe("DEV/LG-10/007/2024");
  expect(derivedActionBusinessCode(null, "")).toBeNull();
  expect(derivedActionBusinessCode(undefined, undefined)).toBeNull();
});
