import type { AuditPlanEntry } from "@prisma/client";
export function ProgrammeEntryFields({ internal, entry }: { internal: boolean; entry?: AuditPlanEntry }) {
  return <>
    <label className="field"><span>Período previsto (alternativa a la fecha exacta)</span><input name="plannedPeriodText" defaultValue={entry?.plannedPeriodText || ""} placeholder="Por ejemplo: primer trimestre" maxLength={250}/></label>
    <label className="field full"><span>Auditores previstos para el programa</span><textarea name="plannedAuditorsText" defaultValue={entry?.plannedAuditorsText || ""} maxLength={2000}/></label>
    {!internal ? <>
      <label className="field"><span>Ámbito del programa externo</span><input name="programmeArea" defaultValue={entry?.programmeArea || ""} maxLength={250}/></label>
      <label className="field"><span>Producto / servicio</span><textarea name="productService" defaultValue={entry?.productService || ""} maxLength={2000}/></label>
      <label className="field full"><span>Alcance previsto</span><textarea name="plannedScope" defaultValue={entry?.plannedScope || ""} maxLength={2000}/></label>
      <label className="field"><span>Modalidad prevista</span><select name="plannedModality" defaultValue={entry?.plannedModality || ""}><option value="">Sin especificar</option><option value="ONSITE">Presencial</option><option value="REMOTE">Remota</option><option value="HYBRID">Mixta</option></select></label>
    </> : null}
  </>;
}
