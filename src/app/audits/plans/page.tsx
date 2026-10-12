import { canPresentRecord } from "@/lib/auth/presentation";
import { ActorField } from "@/components/permissions";
import { PermissionGate } from "@/components/permissions";

import { CsrfField } from "@/components/csrf";
import { authorizedPage } from "@/lib/auth/page-guard";
import Link from "next/link";
import { listAnnualPlans } from "@/modules/audits/plans";
import { createPlanAction } from "@/modules/audits/plan-actions";
export const dynamic="force-dynamic";
async function PlansPageAuthenticatedContent(){
 const plans=await listAnnualPlans();
 return <section className="workspace"><div className="page-heading"><div><p className="eyebrow">Auditorías</p><h1>Planes anuales</h1><p>Planes internos y externos independientes. Las auditorías fuera de plan se gestionan en el listado general.</p></div><Link className="button" href="/audits">Volver a auditorías</Link></div>
 <div className="card"><h2>Crear plan anual</h2><PermissionGate permission="CREATE" allowed={canPresentRecord("AUDIT", "CREATE", {})}><form action={createPlanAction} className="audit-child-form"><CsrfField />
 <label className="field"><span>Año</span><input name="year" type="number" min="2000" max="2100" defaultValue={new Date().getUTCFullYear()} required/></label>
 <label className="field"><span>Tipo de plan</span><select name="auditType"><option value="INTERNAL">Interno</option><option value="EXTERNAL">Externo</option></select></label>
 <label className="field full"><span>Título</span><input name="title" placeholder="Plan anual de auditorías" required maxLength={250}/></label>
 <label className="field full"><span>Observaciones</span><textarea name="notes"/></label>
 <label className="field"><span>Realizado por</span><ActorField name="actor"  required/></label>
 <div className="full"><button className="button primary">Crear plan</button></div></form></PermissionGate></div>
 <div className="card"><h2>Planes registrados</h2><div className="table-wrap"><table className="data-table"><thead><tr><th>Año</th><th>Tipo</th><th>Plan</th><th>Previstas</th><th>Con expediente</th></tr></thead><tbody>{plans.map(p=><tr key={p.id}><td>{p.year}</td><td>{p.auditType==="INTERNAL"?"Interno":"Externo"}</td><td><Link href={`/audits/plans/${p.id}`}>{p.title}</Link></td><td>{p.entries.filter(e=>e.isActive).length}</td><td>{p.entries.filter(e=>e.isActive&&e.audit).length}</td></tr>)}</tbody></table></div>{!plans.length?<p>No hay planes anuales registrados.</p>:null}</div>
 </section>;
}

export default async function PlansPage(...args: Parameters<typeof PlansPageAuthenticatedContent>) {
  return authorizedPage("src/app/audits/plans/page.tsx", () => PlansPageAuthenticatedContent(...args), args);
}
