import { describe, expect, it } from "vitest";
import { auditInputSchema } from "./validation";
import { auditSituation, compatibleAuditScenario, auditScenarioLabels, auditRoleLabels, auditCodeYear } from "./domain";
import { auditListWhere } from "./queries";
import { buildOperationalBusinessCode, extractOperationalBusinessCodeSequence, operationalBusinessCodePrefix } from "@/lib/qms/business-code";

const valid = { actor: "Test", status: "OPEN", auditType: "INTERNAL", scenario: "INTERNAL_COVEX", title: "Objeto", scope: "Alcance", plannedDate: "2026-11-10", codingDepartmentId: "00000000-0000-4000-8000-000000000001", departmentIds: ["00000000-0000-4000-8000-000000000001"], participants: [{ displayName: "Auditor", role: "AUDITOR", sortOrder: 0 }] };
describe("Auditorías R3A", () => {
  it("admite borrador incompleto y apertura planificada válida", () => {
    expect(auditInputSchema.safeParse({actor:"Test"}).success).toBe(true);
    expect(auditInputSchema.safeParse(valid).success).toBe(true);
  });
  it.each([ ["INTERNAL","INTERNAL_COVEX",true], ["INTERNAL","INTERNAL_CONTRACTED",true], ["INTERNAL","CLIENT",false], ["EXTERNAL","SUPPLIER",true], ["EXTERNAL","CLIENT",true], ["EXTERNAL","AUTHORITY",true], ["EXTERNAL","INTERNAL_COVEX",false] ] as const)("valida %s / %s", (type,scenario,expected) => {
    expect(compatibleAuditScenario(type,scenario)).toBe(expected);
    expect(auditInputSchema.safeParse({actor:"Test",auditType:type,scenario}).success).toBe(expected);
  });
  it("exige mínimos al abrir y bloquea cierre final", () => {
    for (const missing of ["title","scope","auditType","scenario","plannedDate"]) expect(auditInputSchema.safeParse({...valid,[missing]:""}).success).toBe(false);
    expect(auditInputSchema.safeParse({...valid,status:"CLOSED"}).success).toBe(false);
    expect(auditInputSchema.safeParse({...valid,departmentIds:[]}).success).toBe(false);
    expect(auditInputSchema.safeParse({...valid,participants:[]}).success).toBe(false);
  });
  it("permite realizada sin fecha prevista; valida fechas imposibles", () => {
    expect(auditInputSchema.safeParse({...valid,plannedDate:"",performedDate:"2026-10-07"}).success).toBe(true);
    expect(auditInputSchema.safeParse({...valid,plannedDate:"2026-02-30"}).success).toBe(false);
  });
  it("permite varias áreas y exige un jefe cuando hay varios auditores", () => {
    const multi = {...valid,departmentIds:[...valid.departmentIds,"00000000-0000-4000-8000-000000000002"],participants:[...valid.participants,{displayName:"Segundo",role:"AUDITOR",sortOrder:10}]};
    expect(auditInputSchema.safeParse(multi).success).toBe(false);
    expect(auditInputSchema.safeParse({...multi,participants:[{...multi.participants[0],role:"LEAD_AUDITOR"},multi.participants[1]]}).success).toBe(true);
  });
  it("valida entidad de proveedor y código manual, sin generarlo desde nombre", () => {
    const supplier = {...valid,auditType:"EXTERNAL",scenario:"SUPPLIER",codingDepartmentId:"",departmentIds:[],auditedEntityName:"Proveedor",entityCode:"ABC1"};
    expect(auditInputSchema.safeParse(supplier).success).toBe(true);
    expect(auditInputSchema.safeParse({...supplier,entityCode:""}).success).toBe(false);
    expect(auditInputSchema.safeParse({...supplier,entityCode:"ABC/1"}).success).toBe(false);
  });
  it("deriva situación y año de referencia", () => {
    expect(auditSituation({status:"OPEN",performedDate:null})).toBe("Planificada");
    expect(auditSituation({status:"OPEN",performedDate:"2026-10-07"})).toBe("Realizada · informe pendiente");
    expect(auditSituation({status:"CLOSED",performedDate:null})).toBe("Cerrada");
    expect(auditCodeYear({plannedDate:"2027-01-02",openedAt:"2026-10-07",performedDate:""})).toBe(2027);
  });
  it("no presenta un plan de tratamiento como cierre parcial antes de emitir el informe", () => {
    expect(auditSituation({status:"OPEN",performedDate:"2026-10-07",reportIssued:false,findings:[{isActive:true,treatment:"Plan",treatmentStatus:"OPEN",actions:[{isActive:true,status:"OPEN"}]}]})).toBe("Realizada · informe pendiente");
  });
  it("distingue informe emitido, seguimiento y hechos de cierre parcial", () => {
    const audit = {status:"OPEN" as const,performedDate:"2026-10-07",reportIssued:true};
    expect(auditSituation(audit)).toBe("Informe emitido");
    expect(auditSituation({...audit,followups:[{}]})).toBe("En seguimiento");
    expect(auditSituation({...audit,scenario:"SUPPLIER",reportSentAt:"2026-10-08"})).toBe("Cierre parcial");
    expect(auditSituation({...audit,scenario:"INTERNAL_COVEX",capaPlanEstablishedAt:"2026-10-08"})).toBe("Cierre parcial");
  });
  it("usa dos dígitos por área/entidad y rechaza desbordamiento y series recibidas", () => {
    const internal = {recordType:"AUDIT" as const,auditType:"INTERNAL" as const,auditScenario:"INTERNAL_COVEX" as const,departmentCode:"LG-00",year:2026};
    const supplier = {recordType:"AUDIT" as const,auditType:"EXTERNAL" as const,auditScenario:"SUPPLIER" as const,entityCode:"ABC1",year:2026};
    expect(buildOperationalBusinessCode(internal,1)).toBe("AI/LG-00/01/2026");
    expect(buildOperationalBusinessCode(supplier,2)).toBe("AE/ABC1/02/2026");
    expect(extractOperationalBusinessCodeSequence("AI/LG-00/01/2026",internal)).toBe(1);
    expect(extractOperationalBusinessCodeSequence("AI/LG-00/001/2026",internal)).toBeNull();
    expect(extractOperationalBusinessCodeSequence("AE/OTHER/02/2026",supplier)).toBeNull();
    expect(() => buildOperationalBusinessCode(internal,100)).toThrow();
    expect(() => operationalBusinessCodePrefix({...supplier,auditScenario:"CLIENT"})).toThrow();
  });
  it("mantiene filtros en SQL y busca hijos activos sin filtrar en memoria", () => {
    const where = auditListWhere({q:"Auditor",type:["INTERNAL","EXTERNAL"],department:valid.departmentIds,administrative:"ANNULLED",plannedFrom:"2026-01-01",quality:["COMPLETE"]});
    expect(where.AND).toEqual(expect.arrayContaining([{qmsRecord:{isActive:false}},{auditType:{in:["INTERNAL","EXTERNAL"]}},{departments:{some:{isActive:true,departmentId:{in:valid.departmentIds}}}}]));
    expect(JSON.stringify(where)).toContain("participants");
    expect(JSON.stringify(where)).toContain("annulledBusinessCode");
  });
  it("clasifica planificación anual sin modificar borradores históricos",()=>{
    expect(auditInputSchema.safeParse({...valid,planningStatus:"UNCLASSIFIED"}).success).toBe(true);
    expect(auditInputSchema.safeParse({...valid,planningStatus:"OUT_OF_PLAN",outsidePlanReason:"Revisión extraordinaria"}).success).toBe(true);
    expect(auditInputSchema.safeParse({...valid,planningStatus:"PLANNED",planEntryId:""}).success).toBe(false);
    expect(auditInputSchema.safeParse({...valid,planningStatus:"PLANNED",planEntryId:"00000000-0000-4000-8000-000000000011"}).success).toBe(true);
    expect(auditInputSchema.safeParse({...valid,planningStatus:"UNCLASSIFIED",planEntryId:"00000000-0000-4000-8000-000000000011"}).success).toBe(false);
    expect(auditInputSchema.safeParse({...valid,planningStatus:"PLANNED",planEntryId:"00000000-0000-4000-8000-000000000011",outsidePlanReason:"No corresponde"}).success).toBe(false);
    expect(JSON.stringify(auditListWhere({planning:"OUT_OF_PLAN"}))).toContain("OUT_OF_PLAN");
    expect(JSON.stringify(auditListWhere({planId:"123"}))).toContain("planId");
  });
  it("presenta escenarios y roles en español", () => {
    expect(auditScenarioLabels.INTERNAL_CONTRACTED).toBe("Interna · auditor externo contratado");
    expect(auditRoleLabels.LEAD_AUDITOR).toBe("Auditor jefe");
  });
});
