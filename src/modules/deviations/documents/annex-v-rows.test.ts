import { describe, expect, it } from "vitest";
import { annexVOfficialFillId, annexVOfficialRowValues } from "@/modules/deviations/documents/xlsx";

describe("Anexo V oficial de Desviaciones", () => {
  it("combina fecha de apertura y departamento y conserva código CAPA", () => {
    const row = {
      qmsRecord: { businessCode: "D/GC-00/001/2026", year: 2026 },
      departmentCodeSnapshot: "GC-00",
      departmentNameSnapshot: "Garantía de Calidad",
      materialProcessAffected: "Proceso demo",
      provenance: null,
      whatHappened: "Descripción demo",
      classification: "MINOR",
      rootCause: null,
      issueDate: new Date("2026-09-28T00:00:00.000Z"),
      closedAt: null,
      status: "OPEN",
      deadlineStatus: "ON_TIME",
      internalObservations: null,
      signedDocumentAvailable: null,
      immediateActions: [],
      capaPlans: [{ description: "CAPA demo", businessCapaCode: "AC/GC-00/001/2026", linkedCapaRecord: null }],
    };
    const values = annexVOfficialRowValues(row);
    expect(values[0]).toBe("D/GC-00/001/2026");
    expect(values[1]).toContain("GC-00");
    expect(values[1]).toContain("28/9/2026");
    expect(values[4]).toBe("AC/GC-00/001/2026");
    expect(values).toHaveLength(6);
  });

  it("usa los colores oficiales de la leyenda", () => {
    expect(annexVOfficialFillId("OPEN")).toBe(3);
    expect(annexVOfficialFillId("CLOSED")).toBe(4);
  });
});
