import { describe, expect, it } from "vitest";
import { parseReturnForm } from "@/modules/returns/validation";

const triFields=[
  "withinAcceptedReturnPeriod",
  "roomTemperatureWithinTenDays",
  "coldChainWithinFortyEightHours",
  "uniqueIdentifierActive",
  "tamperEvidenceIntact",
  "packagingIntegrityOk",
  "customerDeclarationAvailable",
  "storageTransportConditionsOk",
  "noUseDamageContamination",
  "noRecallAlertBlock",
  "expiryAcceptable",
  "qcAssessmentCompleted",
  "storageTemperatureRecord",
  "returnTransportTempEvidence",
  "transportPackagingSuitable",
  "receiptTemperatureAcceptable",
  "temperatureExcursionEvaluated",
  "coldChainReturnSystemValidated",
] as const;

function operationalForm(status:"OPEN"|"CLOSED"="OPEN"){
  const form=new FormData();
  form.set("status",status);
  form.set("departmentId","department-lg-10");
  form.set("communicationDate","2026-10-01");
  form.set("receivedAt","2026-10-01");
  form.set("createdByText","Usuario demo");
  form.set("returnType","OTHER");
  form.set("customerEntity","Cliente demo");
  form.set("country","España");
  form.set("address","Dirección demo");
  form.set("conservationConditions","Temperatura ambiente");
  form.set("reasonObservations","Motivo de la devolución");
  form.set("attachedDocumentation","Documentación de recepción");
  form.set("productsJson",JSON.stringify([{
    productType:"API",
    productNameCode:"PRODUCTO-001",
    format:"1 kg",
    lot:"L001",
    expiryReanalysis:"2027-01-01",
    quantity:"1",
  }]));
  triFields.forEach((name)=>form.set(name,"YES"));
  return form;
}

describe("parseReturnForm · R1 Devoluciones", () => {
  it("permite guardar una devolución borrador incompleta", () => {
    const form=new FormData();
    form.set("status","DRAFT");
    form.set("productsJson","[]");

    const parsed=parseReturnForm(form);

    expect(parsed.errors).toEqual([]);
    expect(parsed.values.status).toBe("DRAFT");
    expect(parsed.values.businessCode).toBeNull();
  });

  it("exige los campos operativos al pasar a abierta", () => {
    const form=new FormData();
    form.set("status","OPEN");
    form.set("productsJson","[]");

    const parsed=parseReturnForm(form);

    expect(parsed.errors).toContain("El área/almacén es obligatorio.");
    expect(parsed.errors).toContain("La fecha de comunicación es obligatoria.");
    expect(parsed.errors).toContain("La fecha de recepción es obligatoria.");
    expect(parsed.errors).toContain("Debe indicarse quién cumplimenta el expediente.");
    expect(parsed.errors).toContain("Debe seleccionarse el tipo de devolución.");
    expect(parsed.errors).toContain("Debe indicarse el cliente/entidad.");
    expect(parsed.errors).toContain("El país es obligatorio.");
    expect(parsed.errors).toContain("La dirección es obligatoria.");
    expect(parsed.errors).toContain("Las condiciones de conservación son obligatorias.");
    expect(parsed.errors).toContain("Las observaciones o incidencias son obligatorias.");
    expect(parsed.errors).toContain("La documentación anexada es obligatoria.");
    expect(parsed.errors).toContain("Debe registrarse al menos un producto devuelto.");
  });

  it("mantiene opcionales documento relacionado, albarán, Otra y control interno", () => {
    const form=operationalForm("OPEN");

    const parsed=parseReturnForm(form);

    expect(parsed.errors).toEqual([]);
    expect(parsed.values.otherReturnType).toBeNull();
    expect(parsed.values.relatedDocument).toBeNull();
    expect(parsed.values.deliveryNote).toBeNull();
    expect(parsed.values.internalObservations).toBeNull();
  });

  it("exige los seis campos mínimos de cada producto operativo", () => {
    const form=operationalForm("OPEN");
    form.set("productsJson",JSON.stringify([{
      productType:"API",
      productNameCode:"PRODUCTO-001",
      format:"",
      lot:"",
      expiryReanalysis:"",
      quantity:"",
    }]));

    const parsed=parseReturnForm(form);

    expect(parsed.errors).toContain("Producto 1: formato es obligatorio.");
    expect(parsed.errors).toContain("Producto 1: lote es obligatorio.");
    expect(parsed.errors).toContain("Producto 1: caducidad / reanálisis es obligatorio.");
    expect(parsed.errors).toContain("Producto 1: cantidad es obligatoria.");
  });

  it("mantiene las reglas específicas de cierre", () => {
    const form=operationalForm("CLOSED");
    form.set("decision","PENDING");

    const parsed=parseReturnForm(form);

    expect(parsed.errors).toContain("Una devolución cerrada requiere decisión Aceptada o Rechazada.");
    expect(parsed.errors).toContain("Una devolución cerrada requiere fecha de decisión.");
    expect(parsed.errors).toContain("Una devolución cerrada requiere fecha de cierre.");
    expect(parsed.errors).toContain("Una devolución cerrada requiere destino final.");
  });

  it("acepta el cierre completo", () => {
    const form=operationalForm("CLOSED");
    form.set("decision","ACCEPTED");
    form.set("decisionDate","2026-10-02");
    form.set("closedAt","2026-10-02");
    form.set("finalDestination","Reintegración autorizada");
    form.set("traceabilityUpdated","YES");

    const parsed=parseReturnForm(form);

    expect(parsed.errors).toEqual([]);
  });
});
