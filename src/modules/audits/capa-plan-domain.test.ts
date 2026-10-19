import { describe, expect, it } from "vitest";
import { capaPlanDefaultDate, capaPlanFileName, capaPlanFingerprint, capaPlanRowProblem, capaPlanSequenceLabel, establishCapaPlanSchema, isCriticalRowChange, parseCapaPlanFollowupForm } from "./capa-plan-domain";
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
  it("interpreta el formulario de seguimiento por filas de acción y de hallazgo (R5C2)", () => {
    const parsed = parseCapaPlanFollowupForm({ followupDate: "2026-10-20", nextReviewDate: "", observations: " Revisado ", changeReason: "", actor: "Ana", requestId: "r",
      "a.x1.status": "CLOSED", "a.x1.closedAt": "2026-10-20", "a.x1.targetDate": "", "a.x1.evidenceReference": "REG-1", "a.x1.evidence": "", "a.x1.updatedAt": "t1",
      "f.f2.treatmentStatus": "NOT_APPLICABLE", "f.f2.treatment": "No procede", "f.f2.closedAt": "", "f.f2.evidenceReference": "", "f.f2.evidence": "Justificado", "f.f2.updatedAt": "t2" });
    expect(parsed.observations).toBe("Revisado");
    expect(parsed.actions).toEqual([{ id: "x1", status: "CLOSED", closedAt: "2026-10-20", targetDate: "", evidenceReference: "REG-1", evidence: "", updatedAt: "t1" }]);
    expect(parsed.findings).toEqual([{ id: "f2", treatmentStatus: "NOT_APPLICABLE", treatment: "No procede", closedAt: "", evidenceReference: "", evidence: "Justificado", updatedAt: "t2" }]);
  });
  it("aplica las validaciones de cierre de siempre a cada fila", () => {
    expect(capaPlanRowProblem({ status: "CLOSED", closedAt: "", evidence: "x", evidenceReference: "", verificationComment: "" })).toMatch(/fecha/);
    expect(capaPlanRowProblem({ status: "CLOSED", closedAt: "2026-10-20", evidence: "", evidenceReference: "", verificationComment: "" })).toMatch(/evidencia/);
    expect(capaPlanRowProblem({ status: "NOT_APPLICABLE", closedAt: "", evidence: "", evidenceReference: "", verificationComment: "" })).toMatch(/evidencia/);
    expect(capaPlanRowProblem({ status: "NOT_APPLICABLE", closedAt: "", evidence: "", evidenceReference: "", verificationComment: "", treatment: "" })).toMatch(/tratamiento|evidencia/);
    expect(capaPlanRowProblem({ status: "OPEN", closedAt: "", evidence: "", evidenceReference: "", verificationComment: "" })).toBeNull();
    expect(capaPlanRowProblem({ status: "CLOSED", closedAt: "2026-10-20", evidence: "", evidenceReference: "REG", verificationComment: "" })).toBeNull();
  });
  it("considera crítico cerrar, dar por no aplicable, reabrir o cambiar una fecha de cierre ya registrada", () => {
    expect(isCriticalRowChange({ status: "OPEN", closedAt: null }, { status: "CLOSED", closedAt: "2026-10-20" })).toBe(true);
    expect(isCriticalRowChange({ status: "CLOSED", closedAt: "2026-10-01" }, { status: "OPEN", closedAt: null })).toBe(true);
    expect(isCriticalRowChange({ status: "CLOSED", closedAt: "2026-10-01" }, { status: "CLOSED", closedAt: "2026-10-02" })).toBe(true);
    expect(isCriticalRowChange({ status: "OPEN", closedAt: null }, { status: "IN_PROGRESS", closedAt: null })).toBe(false);
    expect(isCriticalRowChange({ status: "CLOSED", closedAt: "2026-10-01" }, { status: "CLOSED", closedAt: "2026-10-01" })).toBe(false);
  });
});
