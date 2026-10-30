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

  it("exige el bloque correspondiente para cada acción derivada seleccionada", () => {
    const form=validOperationalForm("OPEN");
    form.set("hasDerivedActions","true");
    form.append("resolutionActions","RECALL");
    form.append("resolutionActions","CREDIT");

    const parsed=parseComplaintForm(form);

    expect(parsed.errors).toContain("La retirada del mercado debe especificarse.");
    expect(parsed.errors).toContain("El abono debe especificarse.");

    form.set("recallActionDetails","Retirada lote A");
    form.set("creditActionDetails","Abono de material");
    expect(parseComplaintForm(form).errors).toEqual([]);
  });

  it("exige una fila CAPA o devolución cuando se selecciona una acción vinculable", () => {
    const form=validOperationalForm("OPEN");
    form.set("hasDerivedActions","true");
    form.append("resolutionActions","CORRECTIVE_ACTION");
    form.append("resolutionActions","RETURN");

    const parsed=parseComplaintForm(form);

    expect(parsed.errors).toContain("La acción correctora requiere al menos una CAPA propuesta o vinculada.");
    expect(parsed.errors).toContain("La devolución requiere al menos una devolución propuesta o vinculada.");
  });

  it("exige contenido de Parte II cuando se decide continuar", () => {
    const form=validOperationalForm("OPEN");
    form.set("partIIRequired","true");

    const parsed=parseComplaintForm(form);

    expect(parsed.errors).toContain("La Parte II requiere fecha de respuesta.");
    expect(parsed.errors).toContain("La Parte II requiere medio de respuesta.");
    expect(parsed.errors).toContain("La Parte II requiere resumen de la respuesta/compromisos.");
    expect(parsed.errors).toContain("Debe indicarse si la respuesta es suficiente.");
  });
});

describe("R4A · condiciones",()=>{
 it("conserva propuestas incompletas en Draft",()=>{const f=new FormData();f.set("complaintType","PROVIDER");f.set("status","DRAFT");f.set("capaPlansJson",JSON.stringify([{description:"Pendiente de completar"}]));expect(parseComplaintForm(f).errors).toEqual([]);});
 it("rechaza fechas imposibles en backend",()=>{const f=validOperationalForm();f.set("openedAt","2026-02-30");expect(parseComplaintForm(f).errors).toContain("La fecha openedAt no es válida.");});
 it("acepta acciones CAPA y devolución con UUID canónico, sin exigir textos paralelos",()=>{const f=validOperationalForm();f.set("hasDerivedActions","true");f.append("resolutionActions","CORRECTIVE_ACTION");f.append("resolutionActions","RETURN");expect(parseComplaintForm(f,{capa:true,returns:true}).errors).toEqual([]);});
 it("exige datos de producto solo cuando aplica",()=>{const f=validOperationalForm();expect(parseComplaintForm(f).errors).toEqual([]);f.set("affectedObjectTypes","PRODUCT_MATERIAL");expect(parseComplaintForm(f).errors).toContain("Para producto/material debe indicarse el lote.");});
});

describe("R4A · registro simplificado GC-00/027/03 §5.2",()=>{
 function form(){const f=new FormData();for(const [k,v] of Object.entries({status:"CLOSED",complaintType:"CUSTOMER",departmentId:"department-1",openedAt:"2026-10-01",createdByText:"QA",emittedBy:"Evaluador QA",classification:"NO_GMP_IMPACT",description:"Incidencia comercial",impactQualityGmp:"NO",impactEnvironment:"NO",impactAssessment:"Ausencia de impacto GMP y ambiental evaluada",conclusion:"Resolución comercial sin seguimiento adicional",partIIRequired:"false",closedAt:"2026-10-02"}))f.set(k,v);return f;}
 it("no exige apertura completa del Anexo III para una incidencia sin impacto evaluada",()=>{expect(parseComplaintForm(form()).errors).toEqual([]);});
 it("obliga al informe completo si se identifica impacto",()=>{const f=form();f.set("impactQualityGmp","YES");expect(parseComplaintForm(f).errors).toContain("El registro simplificado requiere evaluación de ausencia de impacto GMP y ambiental; si hay impacto debe abrirse el informe completo.");});
});

describe("errores por campo (D-117)", () => {
  it("asocia cada error de servidor con su campo", () => {
    const form=validOperationalForm();
    form.delete("nextFollowupDate");form.set("partyName","");
    const parsed=parseComplaintForm(form);
    expect(parsed.fieldIssues.nextFollowupDate).toEqual(["Una reclamación abierta requiere fecha de próximo seguimiento."]);
    expect(parsed.fieldIssues.partyName).toEqual(["Debe indicarse el cliente/proveedor."]);
    expect(Object.values(parsed.fieldIssues).flat()).toEqual(expect.arrayContaining(parsed.errors));
  });
});

describe("Reclamaciones · tablas de los textos (D-127)", () => {
  it("lee las tablas y un error de tabla bloquea en su campo, con el apartado en el resumen", () => {
    const form = validOperationalForm();
    form.set("textTables:investigation", JSON.stringify([{ title: "Lotes revisados", columns: ["Lote"], rows: [["L-1"]] }]));
    expect(parseComplaintForm(form).values.textTables).toEqual({ investigation: [{ title: "Lotes revisados", columns: ["Lote"], rows: [["L-1"]] }] });
    form.set("textTables:rootCause", JSON.stringify([{ title: "", columns: ["a"], rows: [["b"]] }]));
    const parsed = parseComplaintForm(form);
    expect(parsed.fieldIssues.rootCause).toEqual(["1.ª tabla: falta el título."]);
    expect(parsed.errors).toContain("Causa raíz · 1.ª tabla: falta el título.");
  });
});
