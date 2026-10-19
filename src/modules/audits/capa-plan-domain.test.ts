import { describe, expect, it } from "vitest";
import { capaPlanDefaultDate, capaPlanFileName, capaPlanFingerprint, capaPlanSequenceLabel, establishCapaPlanSchema } from "./capa-plan-domain";
import type { AuditReportSnapshot } from "./report-service";

const snapshot = (actionStatus = "OPEN", updatedAt = "2026-10-19T10:00:00.000Z") => ({
  schemaVersion: 1, templates: [],
  audit: { id: "a", capaPlanDate: "2026-10-19T00:00:00.000Z", updatedAt, findings: [
    { id: "f1", isActive: true, reference: "OBS 01", findingType: "FINDING", criticality: "MAJOR", description: "Hallazgo", treatment: null, treatmentStatus: "OPEN", closedAt: null, evidence: null, evidenceReference: null, verificationComment: null, updatedAt,
      actions: [{ id: "x1", isActive: true, description: "Acción", responsible: "Ana", targetDate: null, status: actionStatus, closedAt: null, evidence: null, evidenceReference: null, verificationComment: null, updatedAt }],
      relations: [] },
    { id: "f2", isActive: false, reference: "OBS 02", findingType: "FINDING", criticality: "MINOR", description: "Retirado", treatmentStatus: "OPEN", actions: [], relations: [], updatedAt },
  ] },
}) as unknown as AuditReportSnapshot;

describe("CAPA plan con versiones (D-110, R5C1)", () => {
  it("muestra la secuencia con dos dígitos", () => {
    expect(capaPlanSequenceLabel(0)).toBe("00");
    expect(capaPlanSequenceLabel(12)).toBe("12");
  });
  it("nombra el archivo con el código o, en borrador, sin código", () => {
    expect(capaPlanFileName(null, 0)).toBe("Auditoria_sin_codigo_CAPA_PLAN_00.xlsx");
    expect(capaPlanFileName("AI/GC-00/001/2026", 3)).toMatch(/_CAPA_PLAN_03\.xlsx$/);
    expect(capaPlanFileName("AI/GC-00/001/2026", 3)).not.toContain("/");
  });
  it("la huella ignora metadatos de edición y refleja cambios del contenido", () => {
    expect(capaPlanFingerprint(snapshot("OPEN", "2026-10-20T00:00:00.000Z"))).toBe(capaPlanFingerprint(snapshot()));
    expect(capaPlanFingerprint(snapshot("CLOSED"))).not.toBe(capaPlanFingerprint(snapshot()));
    expect(capaPlanFingerprint(snapshot())).toMatch(/^[a-f0-9]{64}$/);
  });
  it("propone la fecha del CAPA plan ya registrada y, si no hay, la de hoy", () => {
    expect(capaPlanDefaultDate(new Date("2026-03-10T00:00:00.000Z"), "2026-10-19")).toBe("2026-03-10");
    expect(capaPlanDefaultDate(null, "2026-10-19")).toBe("2026-10-19");
  });
  it("valida la solicitud de establecimiento", () => {
    expect(establishCapaPlanSchema.safeParse({ requestId: "x", capaPlanDate: "2026-10-19", actor: "Ana" }).success).toBe(false);
    expect(establishCapaPlanSchema.safeParse({ requestId: crypto.randomUUID(), capaPlanDate: "", actor: "Ana" }).success).toBe(false);
    expect(establishCapaPlanSchema.safeParse({ requestId: crypto.randomUUID(), capaPlanDate: "2026-10-19", actor: "Ana" }).success).toBe(true);
  });
});
