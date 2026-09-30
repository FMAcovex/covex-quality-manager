import { describe, expect, it } from "vitest";
import { parseDeviationForm } from "@/modules/deviations/validation";

function baseForm() {
  const form = new FormData();
  form.set("businessCode", "D/GC-00/001/2026");
  form.set("departmentId", "department-1");
  form.set("issueDate", "2026-09-27");
  form.set("eventDateTime", "2026-09-27T10:30");
  form.set("detectedBy", "Usuario detector");
  form.set("materialProcessAffected", "Acondicionamiento secundario");
  form.set("whatHappened", "Se detectó una diferencia documental durante la revisión.");
  form.set("whoInvolved", "Operario de acondicionamiento");
  form.set("whenHappened", "Durante la revisión del lote");
  form.set("whereHappened", "Área de acondicionamiento");
  form.set("howHappened", "Durante una comprobación visual");
  form.set("affectedDocumentation", "PNT y registro afectados");
  form.set("investigation", "Se revisó documentación y trazabilidad del caso.");
  form.set("investigationConclusive", "YES");
  form.append("investigationMethods", "FIVE_WHYS");
  form.set("rootCause", "Instrucción no actualizada.");
  form.set("recurrentRootCause", "NO");
  form.set("recurrenceDetails", "No se identificaron antecedentes equivalentes.");
  form.set("classification", "MINOR");
  form.set("validationImpact", "NO");
  form.set("registrationImpact", "NO");
  form.set("stabilityImpact", "NA");
  form.set("otherProcessesImpact", "NO");
  form.set("affectsFinishedProduct", "NO");
  form.set("otherProcessesImpactDetails", "Sin impacto adicional tras la evaluación.");
  form.set("capaRequired", "false");
  form.set("conclusion", "Desviación evaluada y documentada.");
  form.set("disposition", "No aplica disposición de producto.");
  form.set("dispositionQuantity", "0");
  form.set("clientNotification", "NO");
  form.set("dispositionComments", "Sin disposición adicional.");
  form.set("createdByText", "Usuario demo");
  form.set("status", "OPEN");
  form.set("dataQualityStatus", "COMPLETE");
  return form;
}

describe("parseDeviationForm", () => {
  it("permite guardar una desviación abierta con Identificación, Descripción e Investigación completas", () => {
    const parsed = parseDeviationForm(baseForm());
    expect(parsed.errors).toEqual([]);
  });

  it("asocia los errores a los campos obligatorios de D2.1", () => {
    const form = new FormData();
    form.set("status", "OPEN");
    const parsed = parseDeviationForm(form);
    expect(parsed.fieldIssues.eventDateTime).toBeDefined();
    expect(parsed.fieldIssues.detectedBy).toBeDefined();
    expect(parsed.fieldIssues.materialProcessAffected).toBeDefined();
    expect(parsed.fieldIssues.whatHappened).toBeDefined();
    expect(parsed.fieldIssues.whoInvolved).toBeDefined();
    expect(parsed.fieldIssues.whenHappened).toBeDefined();
    expect(parsed.fieldIssues.whereHappened).toBeDefined();
    expect(parsed.fieldIssues.howHappened).toBeDefined();
    expect(parsed.fieldIssues.affectedDocumentation).toBeDefined();
    expect(parsed.fieldIssues.investigation).toBeDefined();
    expect(parsed.fieldIssues.investigationConclusive).toBeDefined();
    expect(parsed.fieldIssues.investigationMethods).toBeDefined();
    expect(parsed.fieldIssues.rootCause).toBeDefined();
    expect(parsed.fieldIssues.recurrentRootCause).toBeDefined();
    expect(parsed.fieldIssues.recurrenceDetails).toBeDefined();
    expect(parsed.fieldIssues.classification).toBeDefined();
    expect(parsed.fieldIssues.validationImpact).toBeDefined();
    expect(parsed.fieldIssues.registrationImpact).toBeDefined();
    expect(parsed.fieldIssues.stabilityImpact).toBeDefined();
    expect(parsed.fieldIssues.otherProcessesImpact).toBeDefined();
    expect(parsed.fieldIssues.affectsFinishedProduct).toBeDefined();
    expect(parsed.fieldIssues.otherProcessesImpactDetails).toBeDefined();
    expect(parsed.fieldIssues.capaRequired).toBeDefined();
    expect(parsed.fieldIssues.conclusion).toBeDefined();
    expect(parsed.fieldIssues.disposition).toBeDefined();
    expect(parsed.fieldIssues.dispositionQuantity).toBeDefined();
    expect(parsed.fieldIssues.clientNotification).toBeDefined();
    expect(parsed.fieldIssues.dispositionComments).toBeDefined();
    expect(parsed.fieldIssues.dataQualityStatus).toBeDefined();
  });

  it("exige trazabilidad mínima cuando se intenta cerrar", () => {
    const form = baseForm();
    form.set("status", "CLOSED");
    const parsed = parseDeviationForm(form);
    expect(parsed.errors).toContain("Para cerrar la desviación debe informarse la fecha de cierre.");
  });

  it("permite indicar que procede CAPA sin exigir una propuesta en el mismo guardado", () => {
    const form = baseForm();
    form.set("capaRequired", "true");
    const parsed = parseDeviationForm(form);
    expect(parsed.fieldIssues.capaPlansJson).toBeUndefined();
  });

  it("mantiene A. Origen opcional si no se selecciona ninguno", () => {
    const parsed = parseDeviationForm(baseForm());
    expect(parsed.fieldIssues.provenance).toBeUndefined();
    expect(parsed.fieldIssues.finishedProductSystem).toBeUndefined();
  });

  it("exige solo los campos asociados al origen seleccionado", () => {
    const form = baseForm();
    form.set("provenance", "SUPPLIER");
    const parsed = parseDeviationForm(form);
    expect(parsed.fieldIssues.supplier).toBeDefined();
    expect(parsed.fieldIssues.supplierLot).toBeDefined();
    expect(parsed.fieldIssues.client).toBeUndefined();
    expect(parsed.fieldIssues.finishedProductSystem).toBeUndefined();
  });

  it("Otros exige especificar el origen", () => {
    const form = baseForm();
    form.set("provenance", "OTHER");
    const parsed = parseDeviationForm(form);
    expect(parsed.fieldIssues.otherOrigin).toBeDefined();
  });
});
