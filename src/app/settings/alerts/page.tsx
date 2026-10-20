import { randomUUID } from "node:crypto";
import { ActorField } from "@/components/permissions";
import { PermissionGate } from "@/components/permissions";
import { currentActor } from "@/lib/auth/presentation";

import { CsrfField } from "@/components/csrf";
import { authorizedPage } from "@/lib/auth/page-guard";
import Link from "next/link";
import { SettingsNav } from "@/components/settings-nav";
import { updateAlertRuleAction } from "@/modules/configuration/admin-actions";
import { getAlertPreview,moduleLabel } from "@/modules/configuration/admin-queries";

export const dynamic="force-dynamic";
const fmt=(d:Date)=>d.toLocaleDateString("es-ES");

async function AlertsPageAuthenticatedContent(){
 const data=await getAlertPreview();
 const overdue=data.items.filter(x=>x.state==="OVERDUE");
 const upcoming=data.items.filter(x=>x.state==="UPCOMING");
 return <section className="workspace">
  <div className="page-heading"><div><p className="eyebrow">Administración</p><h1>Vencimientos y preparación de alertas</h1><p>Bandeja transversal basada en fechas estructuradas de los expedientes.</p></div><span className="badge warning">Envío automático desactivado</span></div>
  <SettingsNav active="/settings/alerts"/>
  <div className="analytics-note"><strong>Alcance:</strong> esta pantalla identifica qué debería alertarse y cuándo. No envía correos, Teams ni notificaciones. El parámetro <code>ENABLE_ALERT_DELIVERY</code> permanece desactivado hasta que se defina el canal, los roles y la validación correspondiente.</div>
  <div className="summary-strip admin-summary"><div><strong>{overdue.length}</strong><span>Vencidos</span></div><div><strong>{upcoming.length}</strong><span>Próximos</span></div><div><strong>{data.rules.filter(x=>x.isActive).length}</strong><span>Reglas activas</span></div><div><strong>{data.items.length}</strong><span>Total en bandeja</span></div></div>

  <section className="card"><div className="section-title-row"><div><p className="eyebrow">Reglas</p><h2>Configuración de preaviso</h2></div></div>
   <div className="table-scroll"><table className="records-table compact-table alert-rule-table"><thead><tr><th>Módulo</th><th>Regla</th><th>Tipo</th><th>Preaviso</th><th>Severidad</th><th>Estado</th><th></th></tr></thead><tbody>
    {data.rules.map(r=><tr key={r.id}><td>{moduleLabel(r.module)}</td><td><strong>{r.label}</strong><br/><small>{r.description??r.key}</small></td><td>{r.kind}</td><td colSpan={4}><PermissionGate permission="MANAGE_CONFIGURATION" module={r.module} fallback={<span>{r.leadDays} días · {r.severity} · {r.isActive?"Activa":"Inactiva"}</span>}><form action={updateAlertRuleAction.bind(null,r.id)} className="alert-rule-form"><CsrfField requestId={randomUUID()} /><input type="hidden" name="kind" value={r.kind}/><label><input name="leadDays" type="number" min="0" max="365" defaultValue={r.leadDays}/> días</label><select name="severity" defaultValue={r.severity}><option value="INFO">Informativa</option><option value="WARNING">Aviso</option><option value="CRITICAL">Crítica</option></select><select name="isActive" defaultValue={String(r.isActive)}><option value="true">Activa</option><option value="false">Inactiva</option></select><input name="reason" placeholder="Motivo"/><ActorField type="hidden" name="actor" value={currentActor()}/><button className="button small">Guardar</button></form></PermissionGate></td></tr>)}
   </tbody></table></div>
  </section>

  <section className="card"><div className="section-title-row"><div><p className="eyebrow">Bandeja</p><h2>Próximos y vencidos</h2></div><span className="badge neutral">{data.items.length} elementos</span></div>
   {data.items.length?<div className="table-scroll"><table className="records-table compact-table due-table"><thead><tr><th>Situación</th><th>Fecha</th><th>Módulo</th><th>Expediente</th><th>Motivo</th><th>Detalle</th></tr></thead><tbody>
    {data.items.map(i=><tr key={i.key} className={i.state==="OVERDUE"?"due-overdue":undefined}><td><span className={`badge ${i.state==="OVERDUE"?"critical":"warning"}`}>{i.state==="OVERDUE"?"Vencido":"Próximo"}</span></td><td><strong>{fmt(i.dueDate)}</strong></td><td>{moduleLabel(i.module)}</td><td><Link className="summary-link" href={i.href}>{i.businessCode}</Link></td><td>{i.label}</td><td className="table-cell-wrap">{i.detail}</td></tr>)}
   </tbody></table></div>:<div className="empty-panel">No hay elementos dentro de las ventanas de preaviso configuradas.</div>}
  </section>
 </section>;
}

export default async function AlertsPage(...args: Parameters<typeof AlertsPageAuthenticatedContent>) {
  return authorizedPage("src/app/settings/alerts/page.tsx", () => AlertsPageAuthenticatedContent(...args), args);
}
