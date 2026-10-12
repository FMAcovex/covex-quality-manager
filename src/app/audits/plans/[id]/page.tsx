
import { CsrfField } from "@/components/csrf";
import { authorizedPage } from "@/lib/auth/page-guard";
import { AnnualProgrammePanel } from "@/modules/audits/annual-programme/panel";
import { ProgrammeEntryFields } from "@/modules/audits/annual-programme/entry-fields";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAnnualPlan } from "@/modules/audits/plans";
import { getAuditDepartments } from "@/modules/audits/queries";
import { retirePlanEntryAction } from "@/modules/audits/plan-actions";
import { PlanEntryForm } from "@/modules/audits/plan-entry-form";
export const dynamic="force-dynamic";
const format=(d:Date|null)=>d?.toISOString().slice(0,10)??"";
async function PlanDetailPageAuthenticatedContent({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const [plan,departments]=await Promise.all([getAnnualPlan(id),getAuditDepartments()]);if(!plan)notFound();
 const intern=plan.auditType==="INTERNAL";
 return <section className="workspace"><div className="page-heading"><div><Link href="/audits/plans">← Planes anuales</Link><p className="eyebrow">Plan {intern?"interno":"externo"} · {plan.year}</p><h1>{plan.title}</h1><p>{plan.entries.filter(e=>e.isActive).length} auditorías previstas · {plan.entries.filter(e=>e.isActive&&e.audit).length} con expediente</p></div><Link className="button" href="/audits">Ver auditorías</Link></div>
 <section className="card"><h2>Incorporar auditoría prevista</h2><PlanEntryForm planId={id}>
 <label className="field full"><span>Objeto de la auditoría</span><input name="subject" required/></label>
 <label className="field"><span>{intern?"Área / referencia":"Empresa / organismo"}</span><input name="targetName"/></label>
 <label className="field"><span>Fecha prevista</span><input type="date" name="plannedDate"/></label>
 {intern?<label className="field"><span>Departamento principal</span><select name="departmentId"><option value="">Sin especificar</option>{departments.filter(d=>d.isActive).map(d=><option value={d.id} key={d.id}>{d.code} · {d.name}</option>)}</select></label>:<input type="hidden" name="departmentId" value=""/>}
 <ProgrammeEntryFields internal={intern}/><label className="field full"><span>Observaciones</span><textarea name="notes"/></label>
 <label className="field"><span>Realizado por</span><input name="actor" defaultValue="Usuario demo" required/></label>
 </PlanEntryForm></section>
 <section className="card"><h2>Auditorías del plan</h2><div className="audit-work-panel">{plan.entries.map(e=><article key={e.id} className="audit-action-card"><h3>{e.subject} {!e.isActive?"· Retirada":null}</h3><p>{e.targetName||e.department?.name||"Sin entidad indicada"} · {e.plannedPeriodText||format(e.plannedDate)||"Fecha por determinar"}</p>
 {e.audit?<p><Link href={`/audits/${e.audit.id}`}>Expediente: {e.audit.qmsRecord.businessCode||"Sin código"}</Link> · {e.audit.status==="CLOSED"?"Cerrada":e.audit.status==="OPEN"?"Abierta":"Borrador"}</p>:e.isActive?<Link className="button small" href={`/audits/new?planEntryId=${e.id}`}>Crear expediente para esta entrada</Link>:null}
 {e.isActive?<details className="audit-editor"><summary>Editar planificación</summary><PlanEntryForm planId={id} entryId={e.id}>
 <label className="field full"><span>Objeto</span><input name="subject" defaultValue={e.subject} required/></label>
 <label className="field"><span>Entidad / área</span><input name="targetName" defaultValue={e.targetName??""}/></label>
 <label className="field"><span>Fecha prevista</span><input type="date" name="plannedDate" defaultValue={format(e.plannedDate)}/></label>
 {intern?<label className="field"><span>Departamento</span><select name="departmentId" defaultValue={e.departmentId??""}><option value="">Sin especificar</option>{departments.filter(d=>d.isActive||d.id===e.departmentId).map(d=><option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}</select></label>:<input type="hidden" name="departmentId" value=""/>}
 <ProgrammeEntryFields internal={intern} entry={e}/><label className="field full"><span>Observaciones</span><textarea name="notes" defaultValue={e.notes??""}/></label><label className="field"><span>Responsable del cambio</span><input name="actor" defaultValue="Usuario demo" required/></label><label className="field full"><span>Motivo de actualización</span><input name="reason" required/></label></PlanEntryForm></details>:null}
 {e.isActive&&!e.audit?<details className="audit-editor"><summary>Retirar de la planificación</summary><form action={retirePlanEntryAction.bind(null,id,e.id)} className="audit-child-form"><CsrfField /><label className="field"><span>Responsable</span><input name="actor" defaultValue="Usuario demo" required/></label><label className="field full"><span>Motivo de retirada</span><input name="reason" required/></label><button className="button">Confirmar retirada</button></form></details>:null}
 </article>)}</div>{!plan.entries.length?<p>Sin entradas planificadas.</p>:null}</section>
 <AnnualProgrammePanel planId={id}/>
 <details className="card"><summary><strong>Historial de cambios del plan</strong></summary><ol className="audit-history">{plan.changes.map(c=><li key={c.id}><strong>{c.event}</strong><p>{c.reason}</p><small>{c.actor} · {c.createdAt.toISOString().slice(0,10)}</small></li>)}</ol></details>
 </section>;
}

export default async function PlanDetailPage(...args: Parameters<typeof PlanDetailPageAuthenticatedContent>) {
  return authorizedPage("src/app/audits/plans/[id]/page.tsx", () => PlanDetailPageAuthenticatedContent(...args));
}
