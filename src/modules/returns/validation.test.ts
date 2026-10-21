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


describe("R4B · aplicabilidad y coherencia del PNT real",()=>{
 it("permite investigar un API sin exigir frío ni serialización",()=>{
  const f=operationalForm();triFields.forEach(name=>f.delete(name));
  expect(parseReturnForm(f).errors).toEqual([]);
 });
 it("no permite liberar stock API con evaluación QC negativa",()=>{
  const f=operationalForm();f.set("decision","ACCEPTED");f.set("destinationKind","CONFORMING_STOCK");f.set("decisionDate","2026-10-02");f.set("qcAssessmentCompleted","NO");
  expect(parseReturnForm(f).errors).toContain("Reincorporación incompatible con «Evaluación Control de Calidad»: debe ser Sí.");
 });
 it("no permite que Aceptada omita las comprobaciones de stock",()=>{
  const f=operationalForm();triFields.forEach(name=>f.delete(name));f.set("decision","ACCEPTED");f.set("finalDestination","Reincorporación a stock vendible");
  expect(parseReturnForm(f).errors.some(x=>x.includes("Reincorporación incompatible"))).toBe(true);
 });
 it("no permite eludir frío indicado en las condiciones",()=>{
  const f=operationalForm();f.set("conservationConditions","Cadena de frío +2/+8 ºC");f.set("finalDestination","Reintegración autorizada");f.set("decision","ACCEPTED");f.set("decisionDate","2026-10-02");f.set("temperatureControlled","false");f.set("storageTemperatureRecord","NA");
  expect(parseReturnForm(f).errors).toContain("Reincorporación incompatible con «Registro temperatura almacenamiento»: debe ser Sí.");
 });
 it("serialización solo se aplica a medicamentos",()=>{
  const f=operationalForm();f.set("serializedMedicine","on");f.set("finalDestination","Reintegración autorizada");f.set("decision","ACCEPTED");f.set("decisionDate","2026-10-02");f.set("uniqueIdentifierActive","NA");
  expect(parseReturnForm(f).errors).toEqual([]);
  f.set("productsJson",JSON.stringify([{productType:"MEDICINE",productNameCode:"Medicamento",format:"Caja",lot:"L",expiryReanalysis:"2027",quantity:"1"}]));
  expect(parseReturnForm(f).errors.some(x=>x.includes("Identificador único / Data Matrix activo"))).toBe(true);
 });
 it("el cierre requiere trazabilidad positiva y evidencia de destrucción",()=>{
  const f=operationalForm("CLOSED");f.set("decision","REJECTED");f.set("decisionDate","2026-10-02");f.set("closedAt","2026-10-02");f.set("finalDestination","Destrucción");f.set("traceabilityUpdated","NA");
  expect(parseReturnForm(f).errors).toContain("Una devolución cerrada requiere trazabilidad y reconciliación de cantidades confirmadas (Sí).");
  expect(parseReturnForm(f).errors.some(x=>x.includes("certificado"))).toBe(true);
 });
 it("conserva planificación vigente sin exigir un comentario nuevo",()=>{
  const f=operationalForm();f.set("requiresFollowup","on");f.set("nextFollowupDate","2026-10-15");
  expect(parseReturnForm(f,"2026-10-15").errors).toEqual([]);
  expect(parseReturnForm(f).errors.some(x=>x.includes("planificación"))).toBe(true);
 });
 it("rechaza fechas normalizadas inválidas incluso en borrador",()=>{
  const f=new FormData();f.set("status","DRAFT");f.set("communicationDate","2026-02-30");expect(parseReturnForm(f).errors).toContain("La fecha communicationDate no es válida.");
 });
});


describe("R4B · frío de API sin plazo de medicamento",()=>{
 it("no impone 48 h/EMVO a un API controlado",()=>{
  const f=operationalForm();f.set("conservationConditions","Cadena de frío +2/+8 ºC");f.set("finalDestination","Stock conforme");f.set("decision","ACCEPTED");f.set("decisionDate","2026-10-02");f.set("coldChainWithinFortyEightHours","NA");f.set("uniqueIdentifierActive","NA");
  expect(parseReturnForm(f).errors).toEqual([]);
 });
});


describe("R4B · plazo de medicamento según procedencia y PNT §5.6",()=>{
 const medicine=()=>{const f=operationalForm();f.set("productsJson",JSON.stringify([{productType:"MEDICINE",productNameCode:"M",format:"Caja",lot:"L",expiryReanalysis:"2027",quantity:"1"}]));f.set("decision","ACCEPTED");f.set("decisionDate","2026-10-02");f.set("finalDestination","Stock vendible");f.set("roomTemperatureWithinTenDays","NO");return f;};
 it("permite excepción de diez días solo con evaluación de riesgos documentada",()=>{
  const f=medicine();expect(parseReturnForm(f).errors.some(x=>x.includes("+15/+25 ºC dentro de 10 días"))).toBe(true);f.set("ambientPeriodRiskJustification","Evaluación de riesgos aprobada: integridad demostrada documentalmente");expect(parseReturnForm(f).errors).toEqual([]);
  f.set("packagingIntegrityOk","NO");expect(parseReturnForm(f).errors.some(x=>x.includes("Envases íntegros"))).toBe(true);
 });
 it("no aplica diez días a devolución desde mayorista autorizado",()=>{const f=medicine();f.set("medicineFromWholesale","on");f.set("roomTemperatureWithinTenDays","NA");expect(parseReturnForm(f).errors).toEqual([]);});
});


describe("R4B · N/A expresamente soportado en evaluación de frío",()=>{
 it("admite ausencia de excursiones/sistema no aplicable, conservando bloqueo de NO y registros ausentes",()=>{
  const f=operationalForm();f.set("conservationConditions","Cadena de frío +2/+8 ºC");f.set("decision","ACCEPTED");f.set("decisionDate","2026-10-02");f.set("finalDestination","Stock conforme");f.set("temperatureExcursionEvaluated","NA");f.set("coldChainReturnSystemValidated","NA");expect(parseReturnForm(f).errors).toEqual([]);
  f.set("coldChainReturnSystemValidated","NO");expect(parseReturnForm(f).errors.some(x=>x.includes("Sistema devolución termolábiles validado"))).toBe(true);
  f.set("coldChainReturnSystemValidated","NA");f.set("storageTemperatureRecord","NA");expect(parseReturnForm(f).errors.some(x=>x.includes("Registro temperatura almacenamiento"))).toBe(true);
 });
});

describe("próximo seguimiento borrado (D-117)", () => {
  it("rechaza vaciar la fecha aunque el expediente ya tenga una guardada", () => {
    const form=operationalForm();
    form.set("requiresFollowup","on");
    form.set("nextFollowupDate","");
    expect(parseReturnForm(form,"2026-11-01").errors).toContain("Una devolución abierta que requiere seguimiento necesita próxima fecha.");
  });
  it("mantiene la fecha guardada cuando el formulario no envía el campo", () => {
    const form=operationalForm();
    form.set("requiresFollowup","on");
    form.delete("nextFollowupDate");
    expect(parseReturnForm(form,"2026-11-01").errors).not.toContain("Una devolución abierta que requiere seguimiento necesita próxima fecha.");
  });
});

describe("errores por campo y etiquetas legibles (D-117)", () => {
  it("asocia cada error con su campo y usa la etiqueta del formulario", () => {
    const form=operationalForm("CLOSED");
    form.delete("packagingIntegrityOk");form.set("country","");
    const parsed=parseReturnForm(form);
    expect(parsed.fieldIssues.packagingIntegrityOk).toEqual(["Envases íntegros es obligatorio."]);
    expect(parsed.fieldIssues.country).toEqual(["El país es obligatorio."]);
    expect(parsed.errors.some((message)=>/[a-z][A-Z]/.test(message.split(" ")[0]))).toBe(false);
  });
});
