type Values = Record<string, string | string[] | undefined>;
const text = (values: Values, key: string) => String(values[key] ?? "");
/** Campos del programa anual (PMAI / PMAE) de una entrada del plan; los valores llegan ya preservados. */
export function ProgrammeEntryFields({ internal, values }: { internal: boolean; values: Values }) {
  return <>
    <label className="field"><span>Período previsto (alternativa a la fecha exacta)</span><input name="plannedPeriodText" defaultValue={text(values, "plannedPeriodText")} placeholder="Por ejemplo: primer trimestre" maxLength={250}/></label>
    <label className="field full"><span>Auditores previstos para el programa</span><textarea name="plannedAuditorsText" defaultValue={text(values, "plannedAuditorsText")} maxLength={2000}/></label>
    {!internal ? <>
      <label className="field"><span>Ámbito del programa externo</span><input name="programmeArea" defaultValue={text(values, "programmeArea")} maxLength={250}/></label>
      <label className="field"><span>Producto / servicio</span><textarea name="productService" defaultValue={text(values, "productService")} maxLength={2000}/></label>
      <label className="field full"><span>Alcance previsto</span><textarea name="plannedScope" defaultValue={text(values, "plannedScope")} maxLength={2000}/></label>
      <label className="field"><span>Modalidad prevista</span><select name="plannedModality" defaultValue={text(values, "plannedModality")}><option value="">Sin especificar</option><option value="ONSITE">Presencial</option><option value="REMOTE">Remota</option><option value="HYBRID">Mixta</option></select></label>
    </> : null}
  </>;
}
