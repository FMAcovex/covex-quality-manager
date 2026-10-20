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
