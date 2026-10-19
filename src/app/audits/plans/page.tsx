import { canPresentRecord } from "@/lib/auth/presentation";
import { PermissionGate } from "@/components/permissions";

import { authorizedPage } from "@/lib/auth/page-guard";
import Link from "next/link";
import { listAnnualPlans } from "@/modules/audits/plans";
import { CreatePlanForm } from "@/modules/audits/plan-forms";
export const dynamic="force-dynamic";
async function PlansPageAuthenticatedContent(){
 const plans=await listAnnualPlans();
 return <section className="workspace"><div className="page-heading"><div><p className="eyebrow">Auditorías</p><h1>Planes anuales</h1><p>Planes internos y externos independientes. Las auditorías fuera de plan se gestionan en el listado general.</p></div><Link className="button" href="/audits">Volver a auditorías</Link></div>
 <div className="card"><h2>Crear plan anual</h2><PermissionGate permission="CREATE" allowed={canPresentRecord("AUDIT", "CREATE", {})}><CreatePlanForm year={new Date().getUTCFullYear()}/></PermissionGate></div>
 <div className="card"><h2>Planes registrados</h2><div className="table-wrap"><table className="data-table"><thead><tr><th>Año</th><th>Tipo</th><th>Plan</th><th>Previstas</th><th>Con expediente</th></tr></thead><tbody>{plans.map(p=><tr key={p.id}><td>{p.year}</td><td>{p.auditType==="INTERNAL"?"Interno":"Externo"}</td><td><Link href={`/audits/plans/${p.id}`}>{p.title}</Link></td><td>{p.entries.filter(e=>e.isActive).length}</td><td>{p.entries.filter(e=>e.isActive&&e.audit).length}</td></tr>)}</tbody></table></div>{!plans.length?<p>No hay planes anuales registrados.</p>:null}</div>
 </section>;
}

export default async function PlansPage(...args: Parameters<typeof PlansPageAuthenticatedContent>) {
  return authorizedPage("src/app/audits/plans/page.tsx", () => PlansPageAuthenticatedContent(...args), args);
}
