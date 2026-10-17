import { describe, expect, it } from "vitest";
import { activeFilterChips, queryList, firstQueryValue, validValues, validYears } from "@/lib/qms/list-filters";

describe("list filters · D5.5", () => {
  it("normaliza parámetros simples y repetidos", () => {
    expect(queryList(undefined)).toEqual([]);
    expect(queryList("OPEN")).toEqual(["OPEN"]);
    expect(queryList(["OPEN", "DRAFT"])).toEqual(["OPEN", "DRAFT"]);
    expect(firstQueryValue(["2026", "2025"])).toBe("2026");
  });

  it("descarta valores no admitidos", () => {
    expect(validValues(["OPEN", "INVALID", "DRAFT"], ["DRAFT", "OPEN", "CLOSED"])).toEqual([
      "OPEN",
      "DRAFT",
    ]);
  });

  it("convierte únicamente años válidos", () => {
    expect(validYears(["2026", "x", "2025"])).toEqual([2026, 2025]);
  });

  it("muestra cada filtro aplicado como etiqueta con el enlace que lo quita", () => {
    const status = { name: "status", label: "Estado", options: [{ value: "OPEN", label: "Abierta" }, { value: "CLOSED", label: "Cerrada" }] };
    const capa = { name: "capa", label: "CAPA", options: [{ value: "yes", label: "Con CAPA" }] };
    const chips = activeFilterChips("/deviations", { status: ["OPEN", "CLOSED"], capa: "yes", q: "lote 7", page: "3", review: "" }, [status, capa]);
    expect(chips.map((chip) => chip.label)).toEqual(["Estado: Abierta", "Estado: Cerrada", "CAPA: Con CAPA"]);
    expect(chips[0].href).toBe("/deviations?status=CLOSED&capa=yes&q=lote+7");
    expect(chips[2].href).toBe("/deviations?status=OPEN&status=CLOSED&q=lote+7");
    expect(activeFilterChips("/deviations", { capa: "yes" }, [capa])[0].href).toBe("/deviations");
    expect(activeFilterChips("/deviations", { year: "2031" }, [{ name: "year", label: "Año", options: [] }])[0].label).toBe("Año: 2031");
  });
});
