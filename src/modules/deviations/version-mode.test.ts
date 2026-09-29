import { describe, expect, it } from "vitest";
import {
  deviationSaveMode,
  deviationVersionKind,
  deviationVersionLabel,
} from "@/modules/deviations/version-mode";

describe("versionado completo de Desviaciones", () => {
  it("distingue guardar la vigente de generar una nueva versión", () => {
    expect(deviationSaveMode("update-current")).toBe("UPDATE_CURRENT");
    expect(deviationSaveMode("new-version")).toBe("CREATE_VERSION");
    expect(deviationSaveMode(null)).toBe("UPDATE_CURRENT");
  });

  it("clasifica la nueva versión como seguimiento o reapertura", () => {
    expect(deviationVersionKind({ saveMode: "CREATE_VERSION", reopening: false })).toBe("FOLLOWUP");
    expect(deviationVersionKind({ saveMode: "CREATE_VERSION", reopening: true })).toBe("REOPENING");
    expect(deviationVersionKind({ saveMode: "UPDATE_CURRENT", reopening: true })).toBeNull();
  });

  it("presenta la secuencia con formato V00, V01 y V12", () => {
    expect(deviationVersionLabel(0)).toBe("V00");
    expect(deviationVersionLabel(1)).toBe("V01");
    expect(deviationVersionLabel(12)).toBe("V12");
  });
});
