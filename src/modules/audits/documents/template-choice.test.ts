import { describe, expect, it } from "vitest";
import { chooseTemplateInForce } from "./template-choice";

const t = (id: string, effectiveFrom: string, isActive = false) => ({ id, isActive, effectiveFrom: new Date(effectiveFrom), createdAt: new Date(effectiveFrom) });
const v03 = t("v03", "2026-04-10"), v04 = t("v04", "2026-11-15", true), trial = t("v05-prueba", "2027-01-01");

describe("D-134 · plantilla vigente al abrir la auditoría", () => {
  it("una auditoría abierta antes de la vigencia de la activa conserva la anterior", () => {
    expect(chooseTemplateInForce([v03, v04, trial], new Date("2026-10-01"))?.id).toBe("v03");
  });
  it("las abiertas desde la vigencia, los borradores y las de fecha igual usan la activa", () => {
    expect(chooseTemplateInForce([v03, v04], new Date("2026-11-20"))?.id).toBe("v04");
    expect(chooseTemplateInForce([v03, v04], new Date("2026-11-15"))?.id).toBe("v04");
    expect(chooseTemplateInForce([v03, v04], null)?.id).toBe("v04");
  });
  it("no usa una versión instalada sin activar, aunque sea posterior", () => {
    expect(chooseTemplateInForce([v03, v04, trial], new Date("2027-02-01"))?.id).toBe("v04");
  });
  it("sin una anterior vigente a la apertura, usa la activa; sin activa, ninguna", () => {
    expect(chooseTemplateInForce([v04], new Date("2026-01-01"))?.id).toBe("v04");
    expect(chooseTemplateInForce([v03, { ...v04, isActive: false }], new Date("2026-12-01"))).toBeNull();
  });
});
