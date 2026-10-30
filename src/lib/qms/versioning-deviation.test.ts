import { describe, expect, it } from "vitest";
import { deviationSnapshotToAnnexRecord, serializeDeviationVersion } from "@/lib/qms/versioning";

const record = {
  qmsRecord: { businessCode: "D/GC/001/2026", year: 2026 },
  detectedBy: "Operario ficticio",
  shift: "Turno de noche",
  immediateActions: [],
  followups: [],
  capaPlans: [],
  formVersion: null,
  anexoIIITemplateVersion: null,
};

describe("Desviaciones · turno en la versión (D-116)", () => {
  it("la foto de la versión conserva el turno y el Anexo III de esa versión lo recibe", () => {
    const snapshot = serializeDeviationVersion(record as never);
    expect(snapshot.deviation.shift).toBe("Turno de noche");
    expect((deviationSnapshotToAnnexRecord(snapshot as never) as { shift?: unknown }).shift).toBe("Turno de noche");
  });

  it("una versión anterior sin turno queda sin turno", () => {
    const snapshot = serializeDeviationVersion({ ...record, shift: null } as never);
    expect(snapshot.deviation.shift).toBeNull();
  });
});

describe("Desviaciones · herramientas de investigación en la versión (D-123)", () => {
  it("la foto de la versión conserva las herramientas; sin ellas queda null", () => {
    const tools = { fiveWhys: { problem: "P", whys: ["a"], status: "HYPOTHESIS" }, causes: [] };
    expect(serializeDeviationVersion({ ...record, investigationTools: tools } as never).deviation.investigationTools).toEqual(tools);
    expect(serializeDeviationVersion(record as never).deviation.investigationTools).toBeNull();
  });
});

describe("Desviaciones · tablas de los textos en la versión (D-127)", () => {
  it("la foto de la versión conserva las tablas; sin ellas queda null", () => {
    const tables = { investigation: [{ title: "Lotes", columns: ["Lote"], rows: [["L-1"]] }] };
    expect(serializeDeviationVersion({ ...record, textTables: tables } as never).deviation.textTables).toEqual(tables);
    expect(serializeDeviationVersion(record as never).deviation.textTables).toBeNull();
  });
});
