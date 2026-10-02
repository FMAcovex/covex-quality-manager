import { describe, expect, it } from "vitest";
import { parseChangeControlForm } from "@/modules/change-control/validation";

function operationalBase() {
  const form = new FormData();
  form.set("finalStatus", "OPEN");
  form.set("departmentId", "department-1");
  form.set("requestDate", "2026-09-30");
  form.set("requesterName", "Usuario demo");
  form.set("requesterPosition", "Garantía de Calidad");
  form.append("scope", "DOCUMENTATION");
  form.set("description", "Cambio documentado");
  form.set("justification", "Justificación documentada");
  form.set("providedDocuments", "No aplica");
  form.set("requestDecision", "PENDING");
  form.set("evaluation", "Evaluación documentada");
  form.set("classification", "MINOR");
  form.set("plannedImplementationDate", "2026-10-30");
  form.set("committeeRequired", "false");
  form.set("clientNotificationRequired", "false");
  form.set("authorityRequired", "false");
  form.set("pqrRequired", "NA");
  form.set("stabilityRequired", "NA");
  form.set("additionalAnalysisRequired", "NO");
  form.set("additionalValidationRequired", "NO");
  form.set("otherImplicationRequired", "false");
  form.set("dictamenResult", "PENDING");
  form.set("tasksJson", "[]");
  return form;
}

describe("parseChangeControlForm · CC1", () => {
  it("permite guardar un borrador incompleto y mantiene Control interno opcional", () => {
    const form = new FormData();
    form.set("finalStatus", "DRAFT");
    form.set("tasksJson", "[]");

    const parsed = parseChangeControlForm(form);

    expect(parsed.errors).toEqual([]);
    expect(parsed.values.finalStatus).toBe("DRAFT");
    expect(parsed.values.businessCode).toBeNull();
    expect(parsed.values.internalObservations).toBeNull();
    expect(parsed.values.signedDocumentAvailable).toBeNull();
  });

  it("exige todos los campos funcionales al pasar a estado abierto", () => {
    const form = new FormData();
    form.set("finalStatus", "OPEN");
    form.set("tasksJson", "[]");

    const parsed = parseChangeControlForm(form);

    expect(parsed.errors).toContain("El departamento/área solicitante es obligatorio.");
    expect(parsed.errors).toContain("El puesto del solicitante es obligatorio.");
    expect(parsed.errors).toContain("La relación de documentos aportados es obligatoria; indique No aplica cuando corresponda.");
    expect(parsed.errors).toContain("La evaluación del cambio es obligatoria.");
    expect(parsed.errors).toContain("La clasificación Mayor/Menor es obligatoria.");
    expect(parsed.errors).toContain("Debe responderse la implicación en PQR.");
  });

  it("acepta un expediente operativo pendiente completo sin exigir Control interno", () => {
    const parsed = parseChangeControlForm(operationalBase());

    expect(parsed.errors).toEqual([]);
    expect(parsed.values.classification).toBe("MINOR");
  });

  it("exige responsable de dictamen, cargo y fecha al aceptar o denegar", () => {
    const form = operationalBase();
    form.set("requestDecision", "ACCEPTED");

    const parsed = parseChangeControlForm(form);

    expect(parsed.errors).toContain("El responsable de dictamen es obligatorio cuando la solicitud se acepta o deniega.");
    expect(parsed.errors).toContain("El cargo/función del responsable de dictamen es obligatorio.");
    expect(parsed.errors).toContain("Una solicitud aceptada o denegada debe tener fecha de decisión.");
  });

  it("valida el resultado aprobado y los cuatro datos de cada acción", () => {
    const form = operationalBase();
    form.set("requestDecision", "ACCEPTED");
    form.set("requestDecisionResponsible", "Responsable QA");
    form.set("requestDecisionRole", "Director técnico");
    form.set("requestDecisionDate", "2026-10-01");
    form.set("dictamenResult", "APPROVED");
    form.set("dictamenDate", "2026-10-02");
    form.set("dictamenObservations", "Dictamen favorable");
    form.set("followupResponsible", "Responsable seguimiento");
    form.set("nextFollowupDate", "2026-11-15");
    form.set("tasksJson", JSON.stringify([{ departmentId: "department-1", description: "Implantar", responsible: "Técnico", plannedDate: "2026-10-30" }]));

    const parsed = parseChangeControlForm(form);

    expect(parsed.errors).toEqual([]);
    expect(parsed.values.dictamenResult).toBe("APPROVED");
    expect(parsed.values.tasks).toHaveLength(1);
  });

  it("permite estabilidad Sí sin obligar tipo de estabilidad", () => {
    const form = operationalBase();
    form.set("stabilityRequired", "YES");

    const parsed = parseChangeControlForm(form);

    expect(parsed.errors).not.toContain("Debe seleccionarse al menos un tipo de estabilidad.");
  });

  it("rechaza acciones incompletas sin descartarlas silenciosamente", () => {
    const form = operationalBase();
    form.set("tasksJson", JSON.stringify([{ departmentId: "department-1", description: "Implantar", responsible: "", plannedDate: "" }]));

    expect(parseChangeControlForm(form).errors).toContain(
      "Cada acción del Plan de ejecución debe indicar departamento, acción, responsable y fecha prevista.",
    );
  });
});
