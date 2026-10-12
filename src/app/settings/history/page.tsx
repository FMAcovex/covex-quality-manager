import { authorizedPage } from "@/lib/auth/page-guard";
import { SettingsNav } from "@/components/settings-nav";
import { getAdministrationOverview } from "@/modules/configuration/admin-queries";
export const dynamic="force-dynamic";
const fmt=(d:Date)=>new Intl.DateTimeFormat("es-ES",{dateStyle:"short",timeStyle:"short"}).format(d);

async function SettingsHistoryPageAuthenticatedContent(){
 const data=await getAdministrationOverview();
 return <section className="workspace"><div className="page-heading"><div><p className="eyebrow">Administración</p><h1>Historial de configuración</h1><p>Trazabilidad operativa de cambios administrativos del piloto.</p></div></div><SettingsNav active="/settings/history"/>
 <div className="analytics-note"><strong>Alcance:</strong> este historial no se presenta como audit trail GMP validado. Conserva quién, qué y por qué se modificó durante el piloto y servirá de base para el endurecimiento posterior.</div>
 <section className="card">{data.history.length?<div className="table-scroll"><table className="records-table compact-table"><thead><tr><th>Fecha</th><th>Entidad</th><th>Clave</th><th>Acción</th><th>Usuario</th><th>Motivo</th></tr></thead><tbody>{data.history.map(h=><tr key={h.id}><td>{fmt(h.createdAt)}</td><td>{h.entityType}</td><td><code>{h.entityKey}</code></td><td>{h.action}</td><td>{h.changedByText??"—"}</td><td className="table-cell-wrap">{h.reason??"—"}</td></tr>)}</tbody></table></div>:<div className="empty-panel">Todavía no se han realizado cambios administrativos desde la interfaz.</div>}</section>
 </section>;
}

export default async function SettingsHistoryPage(...args: Parameters<typeof SettingsHistoryPageAuthenticatedContent>) {
  return authorizedPage("src/app/settings/history/page.tsx", () => SettingsHistoryPageAuthenticatedContent(...args), args);
}
