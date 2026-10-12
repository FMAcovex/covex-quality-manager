
import { CsrfField } from "@/components/csrf";
import { authorizedPage } from "@/lib/auth/page-guard";
import { SettingsNav } from "@/components/settings-nav";
import { updateParameterAction } from "@/modules/configuration/admin-actions";
import { getAdministrationOverview } from "@/modules/configuration/admin-queries";

export const dynamic="force-dynamic";

function valueText(value:unknown,type:string){
 if(type==="TEXT")return typeof value==="string"?value:String(value??"");
 if(type==="BOOLEAN")return value===true?"true":"false";
 if(type==="INTEGER")return String(value??0);
 return JSON.stringify(value,null,2);
}

async function ParametersPageAuthenticatedContent(){
 const data=await getAdministrationOverview();
 return <section className="workspace">
  <div className="page-heading"><div><p className="eyebrow">Administración</p><h1>Parámetros</h1><p>Valores de comportamiento configurables sin modificar expedientes.</p></div></div>
  <SettingsNav active="/settings/parameters"/>
  <div className="analytics-note"><strong>Límite funcional:</strong> aquí solo se administran parámetros no estructurales. Clasificaciones GMP, estados, lógica de cierre, reglas de eficacia y campos regulados no se convierten en texto configurable.</div>
  <section className="card">
   <div className="table-scroll"><table className="records-table compact-table parameter-table"><thead><tr><th>Ámbito</th><th>Parámetro</th><th>Descripción</th><th>Tipo</th><th>Valor</th><th>Estado</th><th></th></tr></thead><tbody>
    {data.parameters.map(p=><tr key={p.id}><td>{p.scope}</td><td><strong>{p.label}</strong><br/><code>{p.key}</code></td><td className="table-cell-wrap">{p.description??"—"}</td><td>{p.valueType}</td><td colSpan={3}><form action={updateParameterAction.bind(null,p.id)} className="parameter-row-form"><CsrfField />{p.valueType==="BOOLEAN"?<select name="value" defaultValue={valueText(p.value,p.valueType)}><option value="true">Sí</option><option value="false">No</option></select>:p.valueType==="JSON"?<textarea name="value" defaultValue={valueText(p.value,p.valueType)}/>:<input name="value" type={p.valueType==="INTEGER"?"number":"text"} defaultValue={valueText(p.value,p.valueType)}/>}<select name="isActive" defaultValue={String(p.isActive)}><option value="true">Activo</option><option value="false">Inactivo</option></select><input name="reason" placeholder="Motivo del cambio"/><input type="hidden" name="actor" value={process.env.DEFAULT_ACTOR_NAME||"Usuario demo"}/><button className="button small">Guardar</button></form></td></tr>)}
   </tbody></table></div>
  </section>
  <section className="review-note"><div><p className="eyebrow">Producción</p><h2>Identidad y seguridad</h2></div><p>El nombre por defecto solo existe para el piloto. En Hito 11, Entra ID y roles sustituirán la identificación manual y los parámetros sensibles quedarán restringidos a administradores autorizados.</p></section>
 </section>;
}

export default async function ParametersPage(...args: Parameters<typeof ParametersPageAuthenticatedContent>) {
  return authorizedPage("src/app/settings/parameters/page.tsx", () => ParametersPageAuthenticatedContent(...args));
}
