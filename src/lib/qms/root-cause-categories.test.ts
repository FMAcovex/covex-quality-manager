import { describe, expect, it } from "vitest";
import { rootCauseCategoriesFrom, rootCauseCategoryLabel, rootCauseCategoryMentions } from "@/lib/qms/root-cause-categories";

describe("categoría de causa raíz (6M)", () => {
  it("lee solo valores válidos, sin duplicados y en el orden del catálogo", () => {
    const form = new FormData();
    for (const value of ["MATERIAL", "OTRO", "PEOPLE", "MATERIAL"]) form.append("rootCauseCategories", value);
    expect(rootCauseCategoriesFrom(form)).toEqual(["PEOPLE", "MATERIAL"]);
    expect(rootCauseCategoriesFrom(new FormData())).toEqual([]);
  });

  it("da la etiqueta completa o la corta para gráficos", () => {
    expect(rootCauseCategoryLabel("MACHINE")).toBe("Máquina (equipos, instalaciones, sistemas)");
    expect(rootCauseCategoryLabel("MACHINE", true)).toBe("Máquina");
    expect(rootCauseCategoryLabel("UNDETERMINED", true)).toBe("No determinada");
  });

  it("cuenta menciones con etiqueta corta y agrupa los expedientes sin categoría", () => {
    const items = rootCauseCategoryMentions([
      { rootCauseCategories: ["METHOD", "PEOPLE"] },
      { rootCauseCategories: ["METHOD"] },
      { rootCauseCategories: [] },
      {},
    ]);
    expect(items.map((item) => [item.label, item.count])).toEqual([["Método", 2], ["Sin categoría", 2], ["Mano de obra", 1]]);
  });
});
