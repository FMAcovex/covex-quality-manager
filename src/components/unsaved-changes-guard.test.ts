import { describe, expect, it } from "vitest";
import { needsExitConfirmation } from "./unsaved-changes-guard";

describe("UX C3: aviso de cambios sin guardar", () => {
  it("no interrumpe la navegación si no existe una modificación del usuario", () => {
    expect(needsExitConfirmation({ interacted: false, changed: true, saveError: false, submitting: false })).toBe(false);
  });
  it("avisa de cambios pendientes", () => {
    expect(needsExitConfirmation({ interacted: true, changed: true, saveError: false, submitting: false })).toBe(true);
    expect(needsExitConfirmation({ interacted: true, changed: false, saveError: false, submitting: false })).toBe(false);
  });
  it("protege los datos tras un error de validación y no bloquea el guardado", () => {
    expect(needsExitConfirmation({ interacted: false, changed: false, saveError: true, submitting: false })).toBe(true);
    expect(needsExitConfirmation({ interacted: true, changed: true, saveError: true, submitting: true })).toBe(false);
  });
});
