import { describe, expect, it } from "vitest";
import { getZipEntryText, readZip } from "@/lib/ooxml/zip";
import { generateSimpleList } from "@/modules/deviations/documents/xlsx";

describe("listado simple", () => {
  it("genera un XLSX válido con las columnas operativas", () => {
    const buffer = generateSimpleList([{
      qmsRecord: { businessCode: "D/GC-00/001/2026", year: 2026 },
      departmentCodeSnapshot: "GC-00",
      departmentNameSnapshot: "Garantía de Calidad",
      materialProcessAffected: "Proceso de prueba",
      provenance: "Auditoría",
      whatHappened: "Descripción ficticia",
      classification: "MAJOR",
      rootCause: "Causa ficticia",
      issueDate: new Date("2026-01-02"),
      closedAt: null,
      status: "OPEN",
      deadlineStatus: "NOT_EVALUATED",
      internalObservations: "Observación",
      signedDocumentAvailable: null,
      immediateActions: [],
      capaPlans: [],
    }]);
    const entries = readZip(buffer);
    const sheet = getZipEntryText(entries, "xl/worksheets/sheet1.xml");
    expect(sheet).toContain("CÓDIGO DEPARTAMENTO");
    expect(sheet).toContain("D/GC-00/001/2026");
    expect(sheet).toContain("Descripción ficticia");
  });
});
