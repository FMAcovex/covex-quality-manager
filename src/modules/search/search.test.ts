import { describe, expect, it, vi } from "vitest";
import { normalizeGlobalQuery, rankHits, summarize } from "@/modules/search/ranking";
import type { GlobalSearchHit } from "@/modules/search/types";

vi.mock("server-only", () => ({}));

const hit = (code: string, id = code): GlobalSearchHit => ({ id, code, summary: "", annulled: false, href: `/x/${id}` });

describe("Buscador global — consulta y relevancia", () => {
  it("normaliza la consulta y descarta las demasiado cortas", () => {
    expect(normalizeGlobalQuery(undefined)).toBeNull();
    expect(normalizeGlobalQuery(" a ")).toBeNull();
    expect(normalizeGlobalQuery(["  dv-2026 ", "otro"])).toBe("dv-2026");
    expect(normalizeGlobalQuery("x".repeat(300))).toHaveLength(100);
  });

  it("ordena código exacto, prefijo, contiene y resto, estable en empates y sin acentos", () => {
    const ranked = rankHits("dv-01", [hit("Otro"), hit("XDV-01"), hit("DV-012"), hit("dv-01"), hit("Más", "b")]);
    expect(ranked.map((item) => item.code)).toEqual(["dv-01", "DV-012", "XDV-01", "Otro", "Más"]);
    expect(rankHits("devolucion", [hit("x"), hit("DEVOLUCIÓN")])[0].code).toBe("DEVOLUCIÓN");
  });

  it("resume el texto en una línea acotada", () => {
    expect(summarize("  a  ", null, "b\n c")).toBe("a · b c");
    expect(summarize("x".repeat(200))).toHaveLength(158);
  });
});

describe("Buscador global — cobertura del registro", () => {
  it("cada módulo registrado aporta su búsqueda", async () => {
    const { moduleSearchProviders } = await import("@/modules/search-registry");
    const { qmsModuleKeys } = await import("@/modules/registry");
    expect(Object.keys(moduleSearchProviders).sort()).toEqual([...qmsModuleKeys].sort());
  });
});
