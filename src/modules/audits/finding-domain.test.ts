import { describe, expect, it } from "vitest";
import { auditAnchor, auditFollowupSituation, findingSituation, nextFindingReference, isTerminalAction } from "./finding-domain";
import { dateInput, findingActionInputSchema, findingInputSchema, followupInputSchema } from "./finding-validation";
import { auditDate } from "./domain";
import { auditListWhere } from "./queries";
const base = { actor:"Test", findingType:"FINDING", description:"Hallazgo" };
describe("Auditorías R3B — hallazgos, plan y seguimiento", () => {
  it("reserva OBS entre naturalezas de observación y Rk independiente incluyendo retirados", () => {
    const reserved = ["OBS 01","OBS 03","Rk 01"];
    expect(nextFindingReference("CLIENT_OBSERVATION",reserved)).toBe("OBS 04");
    expect(nextFindingReference("AUTHORITY_OBSERVATION",reserved)).toBe("OBS 04");
    expect(nextFindingReference("RECOMMENDATION",reserved)).toBe("Rk 02");
  });
  it("permite recomendaciones sin criticidad y excepciones explícitas", () => {
    expect(findingInputSchema.parse({...base,findingType:"RECOMMENDATION"}).criticality).toBe("NA");
    expect(findingInputSchema.parse({...base,findingType:"RECOMMENDATION",criticality:"MAJOR"}).criticality).toBe("MAJOR");
  });
  it.each(["CRITICAL","MAJOR","MINOR","NA"])("permite criticidad %s sin imponer plazos", criticality => {
    expect(findingInputSchema.safeParse({...base,criticality}).success).toBe(true);
  });
  it("rechaza naturaleza/criticidad desconocida y descripción vacía", () => {
    expect(findingInputSchema.safeParse({...base,criticality:"URGENT"}).success).toBe(false);
    expect(findingInputSchema.safeParse({...base,findingType:"OTHER"}).success).toBe(false);
    expect(findingInputSchema.safeParse({...base,description:" "}).success).toBe(false);
  });
  it("cierre local requiere fecha y evidencia, no se deriva de fecha", () => {
    expect(findingActionInputSchema.safeParse({actor:"T",description:"Acción",status:"CLOSED"}).success).toBe(false);
    expect(findingActionInputSchema.safeParse({actor:"T",description:"Acción",status:"CLOSED",closedAt:"2026-10-07",verificationComment:"Verificado"}).success).toBe(true);
    expect(findingActionInputSchema.parse({actor:"T",description:"Acción",closedAt:"2026-10-07"}).status).toBe("OPEN");
    expect(findingInputSchema.safeParse({...base,treatmentStatus:"NOT_APPLICABLE"}).success).toBe(false);
    expect(findingInputSchema.safeParse({...base,treatmentStatus:"NOT_APPLICABLE",treatment:"Justificación"}).success).toBe(true);
  });
  it.each(["OPEN","IN_PROGRESS","PENDING_VERIFICATION","CLOSED","NOT_APPLICABLE"])("acepta estado de acción %s", status => {
    expect(findingActionInputSchema.safeParse({actor:"T",description:"Acción",status,closedAt:"2026-10-07",evidence:"Evidencia"}).success).toBe(true);
  });
  it("deriva el estado del hallazgo de acciones activas y tratamiento sin acciones", () => {
    const f = {treatment:null,treatmentStatus:"OPEN" as const,actions:[]};
    expect(findingSituation(f)).toBe("Pendiente de tratamiento");
    expect(findingSituation({...f,treatment:"Justificación",treatmentStatus:"NOT_APPLICABLE"})).toBe("Tratado");
    expect(findingSituation({...f,actions:[{isActive:true,status:"OPEN"}]})).toBe("En curso");
    expect(findingSituation({...f,actions:[{isActive:true,status:"PENDING_VERIFICATION"},{isActive:false,status:"OPEN"}]})).toBe("Pendiente de verificación");
    expect(findingSituation({...f,actions:[{isActive:true,status:"CLOSED"},{isActive:true,status:"NOT_APPLICABLE"}]})).toBe("Tratado");
  });
  it("deriva cierre parcial solo con tratamiento planificado y acciones pendientes", () => {
    const a = {status:"OPEN",performedDate:"2026-10-07",findings:[]};
    expect(auditFollowupSituation(a)).toBe("Realizada · informe pendiente");
    const f = {isActive:true,treatment:null,treatmentStatus:"OPEN" as const,actions:[]};
    expect(auditFollowupSituation({...a,findings:[f]})).toBe("En seguimiento");
    expect(auditFollowupSituation({...a,findings:[{...f,actions:[{isActive:true,status:"OPEN"}]}]})).toBe("Cierre parcial");
    expect(auditFollowupSituation({...a,findings:[{...f,actions:[{isActive:true,status:"CLOSED"}]}]})).toBe("En seguimiento");
    expect(auditFollowupSituation({...a,status:"DRAFT",followups:[{}]})).toBe("Borrador");
  });
  it("valida fechas reales y mantiene DATE en UTC", () => {
    expect(dateInput.safeParse("2026-02-30").success).toBe(false);
    expect(dateInput.safeParse("2028-02-29").success).toBe(true);
    expect(auditDate("2026-10-07T00:00:00Z")).toBe("7/10/2026");
    expect(followupInputSchema.safeParse({actor:"T",completedByText:"T",description:"F",followupDate:"2026-10-07",findingId:"foreign"}).success).toBe(false);
    expect(followupInputSchema.safeParse({actor:"T",completedByText:"T",description:"F",followupDate:"2026-10-07"}).success).toBe(true);
  });
  it("mantiene anchors por UUID sin orden ni descripción", () => {
    expect(auditAnchor("finding","uuid")).toBe("audit-finding-uuid");
    expect(auditAnchor("action","uuid")).toBe("audit-action-uuid");
    expect(isTerminalAction("PENDING_VERIFICATION")).toBe(false);
  });
  it("construye filtros y búsqueda de hijos/relaciones mediante SQL", () => {
    const w = JSON.stringify(auditListWhere({q:"OBS 01",findings:"yes",criticality:["MAJOR"],pendingActions:"yes",relatedCapa:"yes",relatedDeviation:"no"}));
    for (const value of ["reference","description","actions","sourceRelations","MAJOR","none","GENERATES"]) expect(w).toContain(value);
  });
});
