import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeViewQuery, parseListPath, parseViewName, SAVED_VIEW_QUERY_MAX, savedViewListPaths } from "@/lib/saved-views/domain";

describe("Vistas guardadas — validación", () => {
  it("admite solo los listados de los módulos registrados", () => {
    expect(savedViewListPaths).toEqual(["/deviations", "/capa", "/changes", "/complaints", "/returns", "/audits", "/controlled-documents"]);
    expect(parseListPath("/capa")).toBe("/capa");
    expect(() => parseListPath("/settings")).toThrow(/no admitido/);
    expect(() => parseListPath(undefined)).toThrow();
  });

  it("normaliza el nombre y exige que no esté vacío ni sea excesivo", () => {
    expect(parseViewName("  Abiertas   de  QC ")).toBe("Abiertas de QC");
    expect(() => parseViewName("   ")).toThrow(/nombre/);
    expect(() => parseViewName("x".repeat(61))).toThrow(/60/);
  });

  it("guarda solo filtros, en orden estable, sin paginación ni parámetros técnicos", () => {
    expect(normalizeViewQuery("?status=OPEN&page=3&department=QC&q=&returnTo=%2Fx&_covexCsrf=t&status=DRAFT"))
      .toBe("department=QC&status=OPEN&status=DRAFT");
    expect(normalizeViewQuery("")).toBe("");
    expect(() => normalizeViewQuery("q=" + "x".repeat(SAVED_VIEW_QUERY_MAX))).toThrow(/demasiado larga/);
  });
});

describe("Vistas guardadas — exclusión del audit trail (D-084)", () => {
  it("las acciones no tienen operación de audit trail y la tabla no lleva captura obligatoria", () => {
    const boundary = readFileSync("src/lib/audit/action-boundary.ts", "utf8");
    expect(boundary).not.toMatch(/saveListViewAction|deleteListViewAction/);
    const migrations = readdirSync("prisma/migrations", { withFileTypes: true }).filter((entry) => entry.isDirectory());
    for (const entry of migrations) {
      const sql = readFileSync(`prisma/migrations/${entry.name}/migration.sql`, "utf8");
      expect(sql, entry.name).not.toMatch(/CREATE TRIGGER\s+audit_b2_required[^;]*ON\s+"SavedListView"/);
    }
  });
});
