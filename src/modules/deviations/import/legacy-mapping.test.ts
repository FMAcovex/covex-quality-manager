import { describe, expect, it } from "vitest";
import { extractCapaPlans, mapHistoricalRows } from "@/modules/deviations/import/legacy-mapping";
import type { XlsxRow } from "@/modules/deviations/import/xlsx-reader";

describe("historical deviation mapping", () => {
  it("maps 2025 without inventing unavailable Annex III data", () => {
    const catalog: XlsxRow = { rowNumber: 11, cells: { X: "GC-00", Y: "Garantía de Calidad" } };
    const source: XlsxRow = {
      rowNumber: 5,
      cells: {
        B: "GC-00", C: "D/GC-00/001/2025", E: "Auditorías", F: "Error interno detectado",
        G: "Descripción histórica", H: "Mayor", I: "Causa histórica", J: "07/01/2025",
        K: "07/01/2025", L: "Cerrada", M: "Sí", N: "CAPA", O: "AC/GC-00/001/2025",
        P: "si", S: "No", T: "No",
      },
    };
    const [row] = mapHistoricalRows([catalog, source], []);
    expect(row.departmentName).toBe("Garantía de Calidad");
    expect(row.classification).toBe("MAJOR");
    expect(row.deadlineStatus).toBe("IN_TIME");
    expect(row.capaPlans[0].businessCapaCode).toBe("AC/GC-00/001/2025");
    expect(row.issues).toContain("HISTORICAL_LIST_ONLY");
  });

  it("keeps missing 2026 optional control fields as review issues", () => {
    const catalog: XlsxRow = { rowNumber: 11, cells: { X: "GC-00", Y: "Garantía de Calidad" } };
    const source: XlsxRow = {
      rowNumber: 5,
      cells: {
        B: "GC-00", C: "D/GC-00/001/2026", D: "Proceso", E: "Auditoría interna",
        F: "Descripción", G: "Menor", H: "Causa", I: 46000, J: 46001, K: "Cerrada",
        L: "Ninguna",
      },
    };
    const [row] = mapHistoricalRows([catalog], [source]);
    expect(row.deadlineStatus).toBe("NOT_EVALUATED");
    expect(row.recurrentRootCause).toBeNull();
    expect(row.issues).toContain("RECURRENCE_NOT_RECORDED");
    expect(row.issues).toContain("SIGNED_DOCUMENT_STATUS_NOT_AVAILABLE_IN_2026_SOURCE");
  });
});

describe("extractCapaPlans", () => {
  it("extracts multiple AC/AP codes without duplicates", () => {
    expect(extractCapaPlans("AC/GC-00/001/2025\nAP/GC-00/002/2025\nAC/GC-00/001/2025")).toEqual([
      { actionType: "CORRECTIVE", description: "AC/GC-00/001/2025", businessCapaCode: "AC/GC-00/001/2025" },
      { actionType: "PREVENTIVE", description: "AP/GC-00/002/2025", businessCapaCode: "AP/GC-00/002/2025" },
    ]);
  });
});
