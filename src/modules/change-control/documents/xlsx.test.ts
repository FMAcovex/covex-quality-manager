import { describe, expect, it } from "vitest";
import { buildChangeAnnexVIISheet } from "@/modules/change-control/documents/xlsx";

describe("Control de Cambios Anexo VII", () => {
  it("genera la hoja oficial actual B:I con leyenda y ajuste de impresión", () => {
    const styles = new Map<string, number>([
      ["5:22", 30], ["5:23", 31], ["5:24", 32],
      ["6:22", 33], ["6:23", 34], ["6:24", 35],
    ]);
    const rows = [{
      qmsRecord: { businessCode: "DEMO-CC-001-2026" },
      departmentCodeSnapshot: "GC-00",
      description: "Cambio ficticio de demostración.",
      requestDate: new Date("2026-09-20T00:00:00.000Z"),
      dictamenDate: new Date("2026-09-22T00:00:00.000Z"),
      classification: "MINOR",
      plannedImplementationDate: new Date("2026-10-20T00:00:00.000Z"),
      executionStatus: "NOT_EXECUTED",
      executionDate: null,
      effectivenessStatus: "PENDING",
      effectiveClosedAt: null,
      finalStatus: "OPEN",
      internalObservations: null,
      tasks: [{ plannedDate: new Date("2026-10-10T00:00:00.000Z"), origin: "DICTAMEN" }],
      followups: [],
    }];
    const sheet = buildChangeAnnexVIISheet(2026, rows, styles);
    expect(sheet).toContain('<dimension ref="B1:I8"');
    expect(sheet).toContain("DEMO-CC-001-2026");
    expect(sheet).toContain('s="30"');
    expect(sheet).toContain("ABIERTA");
    expect(sheet).toContain("CERRADA");
    expect(sheet).toContain('fitToWidth="1"');
    expect(sheet).not.toContain("sheet7");
  });
});
