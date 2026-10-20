import { describe, expect, it } from "vitest";
import { deviationPartAnchors, legacyDeviationTab } from "./detail-tabs";

describe("Pestaña única «Desviación» (D-111, V3)", () => {
  it("lleva las pestañas antiguas al apartado de la nueva", () => {
    expect(legacyDeviationTab("investigation")).toEqual({ tab: "deviation", anchor: "desviacion-investigacion" });
    expect(legacyDeviationTab("description")).toEqual({ tab: "deviation", anchor: deviationPartAnchors.description });
    expect(legacyDeviationTab("actions")?.anchor).toBe("desviacion-acciones");
    expect(legacyDeviationTab("conclusion")?.anchor).toBe("desviacion-conclusion");
  });
  it("no toca el resto de pestañas", () => {
    expect(legacyDeviationTab("relations")).toBeNull();
    expect(legacyDeviationTab(undefined)).toBeNull();
  });
});
