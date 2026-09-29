import { describe, expect, it } from "vitest";
import { parseCapaAnnexVersion } from "@/modules/capa/documents/version-query";

describe("C3: selección de Anexo III CAPA por versión", () => {
  it("identifica V00, V01 y V02 sin convertirlas en la vigente", () => {
    for (const version of [0, 1, 2]) {
      expect(parseCapaAnnexVersion(String(version))).toEqual({
        valid: true,
        sequenceNumber: version,
      });
    }
    expect(parseCapaAnnexVersion(null)).toEqual({
      valid: true,
      sequenceNumber: null,
    });
  });

  it("rechaza valores inválidos y fuera del rango seguro", () => {
    for (const value of ["", "V01", "-1", "1.5", "01", "9007199254740992"]) {
      expect(parseCapaAnnexVersion(value)).toEqual({ valid: false });
    }
  });
});
