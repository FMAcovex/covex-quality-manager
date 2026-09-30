import { describe, expect, it } from "vitest";
import { queryList, firstQueryValue, validValues, validYears } from "@/lib/qms/list-filters";

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
});
