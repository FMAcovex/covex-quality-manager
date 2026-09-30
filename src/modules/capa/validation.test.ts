import { describe, expect, it } from "vitest";
import { parseCapaForm } from "@/modules/capa/validation";

function base() {
  const f = new FormData();
  f.set("businessCode", "AC/GC-00/001/2026");
  f.set("actionType", "CORRECTIVE");
  f.set("departmentId", "department-1");
  f.set("openedAt", "2026-09-27");
  f.set("createdByText", "Usuario demo");
  f.set("originsJson", JSON.stringify([{
    id: "deviation-record-1",
    recordType: "DEVIATION",
    businessCode: "D/GC-00/001/2026",
    year: 2026,
  }]));
  f.set("defectDescription", "Defecto documentado");
  f.set("rootCause", "Causa raíz sustentada");
  f.set("status", "OPEN");
  f.set("saveIntent", "UPDATE_CURRENT");
  f.set("effectivenessStatus", "PENDING");
  f.set("plannedActionsJson", JSON.stringify([{
    description: "Acción concreta",
    responsible: "QA",
    plannedExecutionDate: "2026-10-15",
    impact: "Sin impacto adicional",
  }]));
  f.set("actionFollowupsJson", "[]");
  return f;
}

describe("parseCapaForm R1", () => {
  it("allows a minimal incomplete CAPA draft", () => {
    const f = new FormData();
    f.set("status", "OPEN");
    f.set("saveIntent", "SAVE_DRAFT");
    f.set("actionType", "CORRECTIVE");
    f.set("plannedActionsJson", "[]");
    f.set("actionFollowupsJson", "[]");
    f.set("originsJson", "[]");
    const parsed = parseCapaForm(f);
    expect(parsed.errors).toEqual([]);
    expect(parsed.values.status).toBe("DRAFT");
    expect(parsed.values.businessCode).toBeNull();
  });

  it("requires operational fields when a draft is opened", () => {
    const f = new FormData();
    f.set("status", "DRAFT");
    f.set("saveIntent", "UPDATE_CURRENT");
    f.set("actionType", "CORRECTIVE");
    f.set("plannedActionsJson", "[]");
    f.set("actionFollowupsJson", "[]");
    f.set("originsJson", "[]");
    const parsed = parseCapaForm(f);
    expect(parsed.values.status).toBe("OPEN");
    expect(parsed.fieldIssues.departmentId).toBeDefined();
    expect(parsed.fieldIssues.openedAt).toBeDefined();
    expect(parsed.fieldIssues.createdByText).toBeDefined();
    expect(parsed.fieldIssues.originsJson).toBeDefined();
    expect(parsed.fieldIssues.defectDescription).toBeDefined();
    expect(parsed.fieldIssues.rootCause).toBeDefined();
    expect(parsed.fieldIssues.plannedActionsJson).toBeDefined();
  });

  it("allows an open CAPA with a real origin and planned action", () => {
    expect(parseCapaForm(base()).errors).toEqual([]);
  });

  it("allows business code to be empty before server-side assignment", () => {
    const f = base();
    f.set("businessCode", "");
    expect(parseCapaForm(f).values.businessCode).toBeNull();
  });

  it("requires closure date and conclusion when closed", () => {
    const f = base();
    f.set("status", "CLOSED");
    const errors = parseCapaForm(f).errors;
    expect(errors).toContain("Una CAPA cerrada debe tener fecha de cierre y ejecución.");
    expect(errors).toContain("Una CAPA cerrada debe tener conclusión de cierre.");
  });

  it("requires reason when cancelled", () => {
    const f = base();
    f.set("status", "CANCELLED");
    expect(parseCapaForm(f).errors).toContain("Una CAPA cancelada debe incluir el motivo de cancelación.");
  });

  it("allows historical incomplete closed records to remain editable", () => {
    const f = base();
    f.set("status", "CLOSED");
    f.set("rootCause", "");
    f.set("operationalClosedAt", "2025-01-10");
    const parsed = parseCapaForm(f, { allowHistoricalIncomplete: true });
    expect(parsed.errors).not.toContain("La causa raíz es obligatoria.");
    expect(parsed.errors).not.toContain("Una CAPA cerrada debe tener conclusión de cierre.");
  });

  it("requires final verification date when efficacy leaves pending", () => {
    const f = base();
    f.set("status", "CLOSED");
    f.set("operationalClosedAt", "2026-10-10");
    f.set("conclusion", "Ejecutada");
    f.set("effectivenessStatus", "CONFORMING");
    f.set("effectivenessAssessment", "Conforme");
    expect(parseCapaForm(f).errors).toContain("La fecha de verificación final es obligatoria cuando la eficacia deja de estar Pendiente.");
  });

  it("requires assessment for conforming final verification", () => {
    const f = base();
    f.set("status", "CLOSED");
    f.set("operationalClosedAt", "2026-10-10");
    f.set("conclusion", "Ejecutada");
    f.set("effectivenessStatus", "CONFORMING");
    f.set("effectiveClosedAt", "2026-11-10");
    const errors = parseCapaForm(f).errors;
    expect(errors).toContain("La eficacia Conforme requiere una evaluación documentada.");
  });

  it("validates optional action-followup dates", () => {
    const f = base();
    f.set("actionFollowupsJson", JSON.stringify([{ followupDate: "2026-99-40", description: "Revisión" }]));
    expect(parseCapaForm(f).fieldIssues.actionFollowupsJson).toBeDefined();
  });

  it("requires a reason only when a new functional follow-up is created", () => {
    const ordinary = base();
    expect(parseCapaForm(ordinary).fieldIssues.changeReason).toBeUndefined();

    const versioned = base();
    versioned.set("saveIntent", "CREATE_FOLLOWUP_VERSION");
    expect(parseCapaForm(versioned).fieldIssues.changeReason).toBeDefined();

    versioned.set("changeReason", "Actualización de seguimiento");
    expect(parseCapaForm(versioned).fieldIssues.changeReason).toBeUndefined();
  });
});
