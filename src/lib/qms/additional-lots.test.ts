import { describe, expect, it } from "vitest";
import { lotColumn, parseAdditionalLots, storedAdditionalLots } from "@/lib/qms/additional-lots";

describe("otros lotes afectados", () => {
  it("lee la lista del formulario, descarta filas vacías y exige número de lote", () => {
    expect(parseAdditionalLots(JSON.stringify([{ name: "Producto B", lot: "L-2", quantity: "10" }, { name: "", lot: "", kind: "PRODUCT" }]))).toEqual({
      lots: [{ name: "Producto B", lot: "L-2", size: "", quantity: "10" }],
    });
    expect(parseAdditionalLots(JSON.stringify([{ name: "Sin lote" }])).error).toBe("Cada lote adicional necesita número de lote.");
    expect(parseAdditionalLots("no-json").error).toBe("La lista de otros lotes no es válida.");
    expect(parseAdditionalLots(null)).toEqual({ lots: [] });
  });

  it("imprime cada columna con un valor por línea, alineado con su lote", () => {
    const lots = storedAdditionalLots([{ name: "B", lot: "L-2", quantity: "" }, { name: "C", lot: "L-3", quantity: "5" }]);
    expect(lotColumn("L-1", lots, "lot")).toBe("L-1\nL-2\nL-3");
    expect(lotColumn("100", lots, "quantity")).toBe("100\n—\n5");
    expect(lotColumn("L-1", [], "lot")).toBe("L-1");
    expect(storedAdditionalLots("x")).toEqual([]);
  });
});
