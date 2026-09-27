import { describe,expect,it } from "vitest";
import { parseCapaForm } from "@/modules/capa/validation";

function base(){
  const f=new FormData();
  f.set("businessCode","AC/GC-00/001/2026");
  f.set("actionType","CORRECTIVE");
  f.set("departmentId","department-1");
  f.set("openedAt","2026-09-27");
  f.set("createdByText","Usuario demo");
  f.set("originType","Desviación");
  f.set("originCode","D/GC-00/001/2026");
  f.set("defectDescription","Defecto documentado");
  f.set("rootCause","Causa raíz sustentada");
  f.set("status","OPEN");
  f.set("effectivenessStatus","PENDING");
  f.set("plannedActionsJson",JSON.stringify([{description:"Acción concreta",responsible:"QA",plannedExecutionDate:"2026-10-15",impact:"Sin impacto adicional"}]));
  return f;
}
describe("parseCapaForm",()=>{
  it("allows an open CAPA with planned action",()=>{
    expect(parseCapaForm(base()).errors).toEqual([]);
  });
  it("requires operational closure date and conclusion when closed",()=>{
    const f=base();f.set("status","CLOSED");
    const errors=parseCapaForm(f).errors;
    expect(errors).toContain("Una CAPA cerrada debe tener fecha de cierre operativo.");
    expect(errors).toContain("Una CAPA cerrada debe tener conclusión de cierre.");
  });
  it("requires reason when cancelled",()=>{
    const f=base();f.set("status","CANCELLED");
    expect(parseCapaForm(f).errors).toContain("Una CAPA cancelada debe incluir el motivo de cancelación.");
  });
  it("requires conforming efficacy and assessment for effective closure",()=>{
    const f=base();f.set("status","CLOSED");f.set("operationalClosedAt","2026-10-10");f.set("conclusion","Ejecutada");
    f.set("effectiveClosedAt","2026-11-10");f.set("effectivenessStatus","PENDING");
    const errors=parseCapaForm(f).errors;
    expect(errors).toContain("El cierre efectivo requiere una verificación de eficacia Conforme.");
    expect(errors).toContain("El cierre efectivo requiere una valoración documentada de la eficacia.");
  });
});
