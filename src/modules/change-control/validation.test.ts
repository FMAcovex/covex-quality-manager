import { describe, expect, it } from "vitest";
import { parseChangeControlForm } from "@/modules/change-control/validation";

function operationalBase() {
  const form = new FormData();
  form.set("finalStatus", "OPEN");
  form.set("departmentId", "department-1");
  form.set("requestDate", "2026-09-30");
  form.set("requesterName", "Usuario demo");
  form.append("scope", "DOCUMENTATION");
  form.set("description", "Cambio documentado");
  form.set("justification", "Justificación documentada");
  form.set("requestDecision", "PENDING");
  form.set("dictamenResult", "PENDING");
  form.set("tasksJson", "[]");
  return form;
}

describe("parseChangeControlForm · D5.4B", () => {
  it("permite guardar un borrador incompleto", () => {
    const form = new FormData();
    form.set("finalStatus", "DRAFT");
    form.set("tasksJson", "[]");

    const parsed = parseChangeControlForm(form);

    expect(parsed.errors).toEqual([]);
    expect(parsed.values.finalStatus).toBe("DRAFT");
    expect(parsed.values.businessCode).toBeNull();
  });

  it("exige los campos de solicitud al pasar a estado abierto", () => {
    const form = new FormData();
    form.set("finalStatus", "OPEN");
    form.set("tasksJson", "[]");

    const parsed = parseChangeControlForm(form);

    expect(parsed.errors).toContain("El departamento/área solicitante es obligatorio.");
    expect(parsed.errors).toContain("La fecha de solicitud es obligatoria.");
    expect(parsed.errors).toContain("Debe identificarse el solicitante.");
    expect(parsed.errors).toContain("Debe seleccionarse al menos un alcance.");
    expect(parsed.errors).toContain("La descripción del cambio es obligatoria.");
    expect(parsed.errors).toContain("La justificación del cambio es obligatoria.");
  });

  it("mantiene la validación del dictamen aprobado en estado operativo", () => {
    const form = operationalBase();
    form.set("dictamenResult", "APPROVED");

    const parsed = parseChangeControlForm(form);

    expect(parsed.errors).toContain(
      "Un dictamen aprobado debe clasificar el cambio como Mayor o Menor.",
    );
    expect(parsed.errors).toContain(
      "Un dictamen aprobado debe tener fecha de aprobación.",
    );
    expect(parsed.errors).toContain(
      "Debe indicarse el responsable de seguimiento.",
    );
    expect(parsed.errors).toContain(
      "Un cambio aprobado debe tener al menos una acción en el plan de ejecución.",
    );
  });
});
