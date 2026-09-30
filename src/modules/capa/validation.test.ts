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
  f.set("applicableTo", "Sistema CAPA");
  f.set("defectDescription", "Defecto documentado");
  f.set("rootCause", "Causa raíz sustentada");
  f.set("status", "OPEN");
  f.set("saveIntent", "UPDATE_CURRENT");
  f.set("effectivenessStatus", "PENDING");
  f.set("effectivenessAssessment", "Pendiente de verificar en el próximo seguimiento");
  f.set("operationalStatusDescription", "Acción abierta y en curso");
  f.set("conclusion", "Mantener abierta hasta completar las acciones previstas");
  f.set("nextFollowupDate", "2026-10-30");
  f.set("actionFollowupObservations", "Seguimiento documentado");
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
    for (const field of [
      "departmentId",
      "openedAt",
      "createdByText",
      "originsJson",
      "applicableTo",
      "defectDescription",
      "rootCause",
      "plannedActionsJson",
      "actionFollowupObservations",
      "effectivenessAssessment",
      "operationalStatusDescription",
      "conclusion",
      "nextFollowupDate",
    ]) {
      expect(parsed.fieldIssues[field]).toBeDefined();
    }
  });

  it("allows an open CAPA when sections 1-7 are complete", () => {
    expect(parseCapaForm(base()).errors).toEqual([]);
  });

  it("requires materia material producto sistema equipo", () => {
    const f = base();
    f.set("applicableTo", "");
    expect(parseCapaForm(f).fieldIssues.applicableTo).toBeDefined();
  });

  it("requires a fresh next follow-up date outside draft", () => {
    const f = base();
    f.set("nextFollowupDate", "");
    expect(parseCapaForm(f).fieldIssues.nextFollowupDate).toBeDefined();
  });

  it("allows business code to be empty before server-side assignment", () => {
    const f = base();
    f.set("businessCode", "");
    expect(parseCapaForm(f).values.businessCode).toBeNull();
  });

  it("requires closure date only when operational status is closed", () => {
    const open = base();
    expect(parseCapaForm(open).fieldIssues.operationalClosedAt).toBeUndefined();

    const closed = base();
    closed.set("status", "CLOSED");
    expect(parseCapaForm(closed).fieldIssues.operationalClosedAt).toBeDefined();

    closed.set("operationalClosedAt", "2026-10-30");
    expect(parseCapaForm(closed).fieldIssues.operationalClosedAt).toBeUndefined();
  });

  it("requires final verification date only for conforming efficacy", () => {
    const pending = base();
    expect(parseCapaForm(pending).fieldIssues.effectiveClosedAt).toBeUndefined();

    const nonconforming = base();
    nonconforming.set("effectivenessStatus", "NONCONFORMING");
    expect(parseCapaForm(nonconforming).fieldIssues.effectiveClosedAt).toBeUndefined();

    const conforming = base();
    conforming.set("effectivenessStatus", "CONFORMING");
    expect(parseCapaForm(conforming).fieldIssues.effectiveClosedAt).toBeDefined();

    conforming.set("effectiveClosedAt", "2026-11-10");
    expect(parseCapaForm(conforming).fieldIssues.effectiveClosedAt).toBeUndefined();
  });

  it("validates action follow-up date and description as a pair", () => {
    const invalidDate = base();
    invalidDate.set("actionFollowupsJson", JSON.stringify([
      { followupDate: "2026-99-40", description: "Revisión" },
    ]));
    expect(parseCapaForm(invalidDate).fieldIssues.actionFollowupsJson).toBeDefined();

    const missingDescription = base();
    missingDescription.set("actionFollowupsJson", JSON.stringify([
      { followupDate: "2026-10-20", description: "" },
    ]));
    expect(parseCapaForm(missingDescription).fieldIssues.actionFollowupsJson).toBeDefined();

    const missingDate = base();
    missingDate.set("actionFollowupsJson", JSON.stringify([
      { followupDate: "", description: "Revisión" },
    ]));
    expect(parseCapaForm(missingDate).fieldIssues.actionFollowupsJson).toBeDefined();
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
