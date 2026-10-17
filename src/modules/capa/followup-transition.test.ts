import { describe, expect, it } from "vitest";
import {
  parseCapaFollowupTransition,
  type CapaFollowupLifecycleState,
} from "@/modules/capa/followup-transition";

const current = (
  patch: Partial<CapaFollowupLifecycleState> = {},
): CapaFollowupLifecycleState => ({
  status: "OPEN",
  operationalClosedAt: null,
  cancellationReason: null,
  conclusion: null,
  effectivenessStatus: "PENDING",
  effectivenessCriteria: null,
  effectivenessAssessment: null,
  effectivenessEvidence: null,
  effectiveClosedAt: null,
  ...patch,
});

function baseForm() {
  const form = new FormData();
  form.set("followupDate", "2099-02-01");
  form.set("completedByText", "QA");
  form.set("description", "Seguimiento documentado.");
  form.set("status", "OPEN");
  form.set("effectivenessStatus", "PENDING");
  return form;
}

describe("Hito 10.8C3-C1: transición de seguimiento CAPA", () => {
  it("exige motivo y próxima fecha si la CAPA permanece abierta", () => {
    const parsed = parseCapaFollowupTransition(baseForm(), {
      current: current(),
      hasExistingExecutionEvidence: false,
    });
    expect(parsed.errors).toContain(
      "Si la CAPA permanece abierta, el seguimiento debe indicar motivo y próxima fecha.",
    );
  });

  it("permite cerrar operativamente usando la evidencia del seguimiento actual", () => {
    const form = baseForm();
    form.set("status", "CLOSED");
    form.set("operationalClosedAt", "2099-02-01");
    form.set("conclusion", "Acción implantada.");
    form.set("evidenceReference", "EV-CAPA-001");
    form.set("nextFollowupDate", "2099-03-01");

    const parsed = parseCapaFollowupTransition(form, {
      current: current(),
      hasExistingExecutionEvidence: false,
    });
    expect(parsed.errors).toEqual([]);
    expect(parsed.values.status).toBe("CLOSED");
    expect(parsed.values.operationalClosedAt).toBe("2099-02-01");
  });

  it("exige fecha de verificación de eficacia al cerrar con la eficacia pendiente", () => {
    const form = baseForm();
    form.set("status", "CLOSED");
    form.set("operationalClosedAt", "2099-02-01");
    form.set("conclusion", "Acción implantada.");
    form.set("evidenceReference", "EV-CAPA-001");

    const parsed = parseCapaFollowupTransition(form, {
      current: current(),
      hasExistingExecutionEvidence: false,
    });
    expect(parsed.errors).toContain(
      "Con la eficacia pendiente, indica la fecha prevista de verificación de eficacia (próximo seguimiento).",
    );
  });

  it("rechaza un cierre operativo sin evidencia en ningún seguimiento", () => {
    const form = baseForm();
    form.set("status", "CLOSED");
    form.set("operationalClosedAt", "2099-02-01");
    form.set("conclusion", "Acción implantada.");

    const parsed = parseCapaFollowupTransition(form, {
      current: current(),
      hasExistingExecutionEvidence: false,
    });
    expect(parsed.errors).toContain(
      "El cierre operativo requiere evidencia de ejecución referenciada en un seguimiento.",
    );
  });

  it("permite un seguimiento de eficacia posterior a un cierre operativo", () => {
    const form = baseForm();
    form.set("status", "CLOSED");
    form.set("operationalClosedAt", "2099-02-01");
    form.set("conclusion", "Acción implantada.");
    form.set("effectivenessStatus", "CONFORMING");
    form.set("effectivenessAssessment", "Sin recurrencia observada.");
    form.set("effectivenessEvidence", "EV-EF-001");
    form.set("effectiveClosedAt", "2099-03-01");

    const parsed = parseCapaFollowupTransition(form, {
      current: current({
        status: "CLOSED",
        operationalClosedAt: "2099-02-01",
        conclusion: "Acción implantada.",
      }),
      hasExistingExecutionEvidence: true,
    });
    expect(parsed.errors).toEqual([]);
    expect(parsed.values.effectivenessStatus).toBe("CONFORMING");
    expect(parsed.values.effectiveClosedAt).toBe("2099-03-01");
  });

  it("impide cierre efectivo sin estado cerrado, eficacia conforme y valoración", () => {
    const form = baseForm();
    form.set("reason", "Continúa seguimiento.");
    form.set("nextFollowupDate", "2099-03-01");
    form.set("effectiveClosedAt", "2099-02-01");

    const parsed = parseCapaFollowupTransition(form, {
      current: current(),
      hasExistingExecutionEvidence: true,
    });
    expect(parsed.errors).toContain(
      "El cierre efectivo requiere que la CAPA esté cerrada operativamente.",
    );
    expect(parsed.errors).toContain("El cierre efectivo requiere eficacia Conforme.");
    expect(parsed.errors).toContain(
      "El cierre efectivo requiere una valoración documentada de la eficacia.",
    );
  });

  it("exige motivo al cancelar", () => {
    const form = baseForm();
    form.set("status", "CANCELLED");

    const parsed = parseCapaFollowupTransition(form, {
      current: current(),
      hasExistingExecutionEvidence: false,
    });
    expect(parsed.errors).toContain(
      "Una CAPA cancelada debe incluir el motivo de cancelación.",
    );
  });
});
