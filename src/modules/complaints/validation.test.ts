import { describe, expect, it } from "vitest";
import { parseComplaintForm } from "@/modules/complaints/validation";

function validOperationalForm(status:"OPEN"|"CLOSED"="OPEN") {
  const form=new FormData();
  form.set("status",status);
  form.set("departmentId","department-1");
  form.set("openedAt","2026-10-01");
  form.set("detectionDate","2026-10-01");
  form.set("receptionDate","2026-10-01");
  form.set("createdByText","Usuario demo");
  form.set("complaintType","CUSTOMER");
  form.set("partyName","Cliente demo");
  form.set("contact","contacto@example.invalid");
  form.append("sourceTypes","CUSTOMER");
  form.append("scopeTypes","MEDICINE");
  form.append("affectedObjectTypes","SERVICE");
  form.set("reference","Servicio demo");
  form.set("description","Reclamación demo");
  form.append("categoryTypes","SERVICE_SUPPLY");
  form.set("recurrent","false");
  form.set("emittedBy","Usuario demo");
  form.set("impactQualityGmp","NO");
  form.set("impactSafetyEfficacy","NO");
  form.set("impactRegulatory","NO");
  form.set("impactEnvironment","NO");
  form.set("impactOtherSimilar","NO");
  form.append("containmentActions","NONE");
  form.set("riskJustification","Sin impacto; no requiere contención adicional.");
  form.set("investigation","Revisión documental completa.");
  form.set("impactAssessment","Sin impacto identificado.");
  form.set("investigationResult","PROCEDENT");
  form.set("rootCause","Causa documentada.");
  form.set("classification","MINOR");
  form.set("potentialRecall","NO");
  form.set("recallProcedureRequired","NO");
  form.set("authorityNotificationRequired","NO");
  form.set("responsiblePartyCommunicationRequired","YES");
  form.set("regulatoryJustification","No requiere notificación a autoridad.");
  form.set("resolutionLines","Comunicar resolución y realizar seguimiento.");
  form.set("hasDerivedActions","false");
  form.set("communicationDate","2026-10-01");
  form.set("communicationMedium","Correo");
  form.set("communicationParties","QA / Cliente");
  form.set("communicationSummary","Comunicación de recepción e investigación.");
  form.set("partIIRequired","pending");
  form.set("conclusion","Pendiente de decidir continuidad en Parte II.");
  if(status==="OPEN")form.set("nextFollowupDate","2026-10-10");
  return form;
}

describe("parseComplaintForm · R1", () => {
  it("permite borrador incompleto después de seleccionar el tipo", () => {
    const form=new FormData();
    form.set("status","DRAFT");
    form.set("complaintType","CUSTOMER");

    const parsed=parseComplaintForm(form);

    expect(parsed.errors).toEqual([]);
    expect(parsed.values.status).toBe("DRAFT");
    expect(parsed.values.businessCode).toBeNull();
  });

  it("exige seleccionar cliente/proveedor incluso antes de codificar", () => {
    const form=new FormData();
    form.set("status","DRAFT");

    const parsed=parseComplaintForm(form);

    expect(parsed.errors).toContain("Debe seleccionarse el tipo de reclamación.");
  });

  it("acepta una reclamación abierta completa y exige próximo seguimiento", () => {
    const form=validOperationalForm("OPEN");
    expect(parseComplaintForm(form).errors).toEqual([]);

    form.delete("nextFollowupDate");
    expect(parseComplaintForm(form).errors).toContain("Una reclamación abierta requiere fecha de próximo seguimiento.");
  });

  it("permite cerrar en Parte I sin exigir eficacia cuando Parte II no procede", () => {
    const form=validOperationalForm("CLOSED");
    form.set("partIIRequired","false");
    form.set("closedAt","2026-10-02");

    const parsed=parseComplaintForm(form);

    expect(parsed.errors).toEqual([]);
    expect(parsed.values.effectivenessStatus).toBe("NOT_REQUIRED");
    expect(parsed.values.nextFollowupDate).toBeNull();
  });

  it("bloquea un cierre mientras la decisión de Parte II está pendiente", () => {
    const form=validOperationalForm("CLOSED");
    form.set("closedAt","2026-10-02");

    const parsed=parseComplaintForm(form);

    expect(parsed.errors).toContain("No puede cerrarse una reclamación con la decisión de Parte II pendiente.");
  });

  it("exige contenido de Parte II cuando se decide continuar", () => {
    const form=validOperationalForm("OPEN");
    form.set("partIIRequired","true");

    const parsed=parseComplaintForm(form);

    expect(parsed.errors).toContain("La Parte II requiere fecha de respuesta.");
    expect(parsed.errors).toContain("La Parte II requiere resumen de la respuesta/compromisos.");
    expect(parsed.errors).toContain("Debe indicarse si la respuesta es suficiente.");
  });
});
