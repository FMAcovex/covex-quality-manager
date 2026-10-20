import { describe, expect, it } from "vitest";
import { qmsDetailTab, qmsListingReturnTo, qmsListingUrl, qmsWithReturnTo, qmsListRoots } from "./list-return-navigation";

describe("UX C1: retorno seguro a los listados", () => {
  it.each(qmsListRoots)("preserva filtros repetidos, texto y página en %s", (root) => {
    const source = qmsListingUrl(root, { q: "calidad & test", year: ["2025", "2026"], status: ["OPEN", "DRAFT"], page: "3" });
    const expected = root + "?q=calidad+%26+test&year=2025&year=2026&status=OPEN&status=DRAFT&page=3";
    expect(source).toBe(expected);
    const detail = qmsWithReturnTo(root + "/uuid?tab=documents&review=1#document", root, source);
    const parsed = new URL(detail, "https://qms.invalid");
    expect(parsed.searchParams.get("returnTo")).toBe(source);
    expect(parsed.searchParams.get("tab")).toBe("documents");
    expect(parsed.searchParams.get("review")).toBe("1");
    expect(parsed.hash).toBe("#document");
    expect(qmsListingReturnTo(root, source)).toBe(source);
  });

  it.each(qmsListRoots)("rechaza redirecciones ajenas o malformadas en %s", (root) => {
    for (const attempted of ["https://evil.example", "//evil.example", root + "/uuid", root + "?q=1#bad", root + "?q=1\\\\bad", root + "?q=1\nnext"]) {
      expect(qmsListingReturnTo(root, attempted)).toBe(root);
    }
    expect(qmsWithReturnTo("/audits/id", root, root + "?page=2")).toBe("/audits/id");
    expect(qmsWithReturnTo(root + "/id", root, "//evil.example")).toBe(root + "/id");
  });

  it("Desviaciones: las pestañas antiguas vuelven a la pestaña «Desviación» (D-111, V3)", () => {
    expect(qmsDetailTab("/deviations", "deviation")).toBe("deviation");
    expect(qmsDetailTab("/deviations", "actions")).toBe("deviation");
    expect(qmsDetailTab("/deviations", "relations")).toBe("relations");
  });

  it("excluye returnTo anidados y no genera contexto para el listado sin filtros", () => {
    expect(qmsListingUrl("/capa", {})).toBe("/capa");
    expect(qmsListingUrl("/capa", { returnTo: "/capa?page=2", page: "1" })).toBe("/capa?page=1");
  });
});
