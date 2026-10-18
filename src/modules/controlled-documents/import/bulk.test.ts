import { describe, expect, it } from "vitest";
import { bulkCounts, bulkEligibility, bulkResolution } from "./bulk";
import type { PreviewRow } from "../preview/types";

type Row = Pick<PreviewRow, "classification" | "issues" | "normalized" | "source">;
const row = (patch: Partial<PreviewRow["normalized"]> = {}, issues: PreviewRow["issues"] = ["FORMULA_CACHE"], sheet = "MC-10"): Row => ({
  classification: "PNT",
  issues,
  source: { fileName: "indice.xlsx", sha256: "x", sheet, row: 5, originalCode: "MC-10/001", values: [] },
  normalized: { baseCode: "MC-10/001", revisionCode: "02", title: "Limpieza de equipos", departmentCode: "MC-10", effectiveFrom: "2024-01-10", reviewDueAt: "2029-01-09", declaredState: "IN_FORCE", stateBasis: "EXPLICIT", reviewOverdue: false, ...patch },
});

describe("inclusión en bloque del índice de PNT", () => {
  it("admite vigentes completas con solo el aviso de fórmula", () => {
    expect(bulkEligibility(row())).toBe("IN_FORCE");
    expect(bulkEligibility(row({}, []))).toBe("IN_FORCE");
  });

  it("deja para revisión manual las vigentes con cualquier otra incidencia o sin revisión o fecha", () => {
    expect(bulkEligibility(row({}, ["FORMULA_CACHE", "DUPLICATE"]))).toBeNull();
    expect(bulkEligibility(row({ revisionCode: null }))).toBeNull();
    expect(bulkEligibility(row({ effectiveFrom: null }))).toBeNull();
    expect(bulkEligibility(row({ declaredState: "UNDETERMINED" }))).toBeNull();
    expect(bulkEligibility(row({ declaredState: "IN_PREPARATION" }))).toBeNull();
  });

  it("admite anulados aunque no tengan fechas ni revisión, pero no duplicados ni errores de celda", () => {
    expect(bulkEligibility(row({ declaredState: "ANNULLED", revisionCode: null, effectiveFrom: null, reviewDueAt: null }, ["MISSING_DATES", "MISSING_REVISION"]))).toBe("ANNULLED");
    expect(bulkEligibility(row({ declaredState: "ANNULLED" }, ["DUPLICATE"]))).toBeNull();
    expect(bulkEligibility(row({ declaredState: "ANNULLED" }, ["CELL_ERROR"]))).toBeNull();
  });

  it("respeta las reglas de GC-00 y de familias no PNT", () => {
    expect(bulkEligibility({ ...row({ baseCode: "GC-00/001" }), source: { ...row().source, sheet: "GC-00" } })).toBeNull();
    expect(bulkEligibility({ ...row({ baseCode: "GC-00/001" }), source: { ...row().source, sheet: "GC-00(" } })).toBe("IN_FORCE");
    expect(bulkEligibility({ ...row(), classification: "OTHER" })).toBeNull();
  });

  it("usa los datos del índice y vacía fechas incoherentes", () => {
    expect(bulkResolution(row(), "dep-1", "Carga inicial")).toEqual({ title: "Limpieza de equipos", revisionCode: "02", effectiveFrom: "2024-01-10", reviewDueAt: "2029-01-09", declaredState: "IN_FORCE", departmentId: "dep-1", reviewed: true, reason: "Carga inicial" });
    expect(bulkResolution(row({ reviewDueAt: "2023-01-01" }), "dep-1", "r").reviewDueAt).toBe("");
    expect(bulkResolution(row({ revisionCode: "1A", effectiveFrom: null }), "dep-1", "r")).toMatchObject({ revisionCode: "", effectiveFrom: "" });
  });

  it("cuenta solo las filas pendientes sin resultado", () => {
    const annulled = row({ declaredState: "ANNULLED" }, ["MISSING_DATES"]);
    expect(bulkCounts([
      { decision: "PENDING", result: null, data: row() },
      { decision: "PENDING", result: null, data: annulled },
      { decision: "INCLUDE", result: null, data: row() },
      { decision: "PENDING", result: { outcome: "CREATED" }, data: row() },
    ])).toEqual({ inForce: 1, annulled: 1 });
  });
});
