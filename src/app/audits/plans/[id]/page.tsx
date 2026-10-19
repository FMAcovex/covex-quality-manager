import { PermissionGate } from "@/components/permissions";

import { authorizedPage } from "@/lib/auth/page-guard";
import { AnnualProgrammePanel } from "@/modules/audits/annual-programme/panel";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAnnualPlan } from "@/modules/audits/plans";
import { getAuditDepartments } from "@/modules/audits/queries";
import { RetirePlanEntryForm } from "@/modules/audits/plan-forms";
import { PlanEntryForm } from "@/modules/audits/plan-entry-form";
export const dynamic="force-dynamic";
const format=(d:Date|null)=>d?.toISOString().slice(0,10)??"";
const entryDefaults=(e:{subject:string;targetName:string|null;plannedDate:Date|null;departmentId:string|null;notes:string|null;plannedPeriodText:string|null;plannedAuditorsText:string|null;productService:string|null;plannedScope:string|null;plannedModality:string|null;programmeArea:string|null})=>({
  subject:e.subject,targetName:e.targetName??"",plannedDate:format(e.plannedDate),departmentId:e.departmentId??"",notes:e.notes??"",
  plannedPeriodText:e.plannedPeriodText??"",plannedAuditorsText:e.plannedAuditorsText??"",productService:e.productService??"",plannedScope:e.plannedScope??"",plannedModality:e.plannedModality??"",programmeArea:e.programmeArea??"",reason:"",
});
async function PlanDetailPageAuthenticatedContent({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const [plan,departments]=await Promise.all([getAnnualPlan(id),getAuditDepartments()]);if(!plan)notFound();
 const intern=plan.auditType==="INTERNAL";
 const departmentOptions=departments.map(d=>({id:d.id,code:d.code,name:d.name,isActive:d.isActive}));
 return <section className="workspace"><div className="page-heading"><div><Link href="/audits/plans">← Planes anuales</Link><p className="eyebrow">Plan {intern?"interno":"externo"} · {plan.year}</p><h1>{plan.title}</h1><p>{plan.entries.filter(e=>e.isActive).length} auditorías previstas · {plan.entries.filter(e=>e.isActive&&e.audit).length} con expediente</p></div><Link className="button" href="/audits">Ver auditorías</Link></div>
 <section className="card"><h2>Incorporar auditoría prevista</h2><PermissionGate permission="EDIT"><PlanEntryForm planId={id} internal={intern} departments={departmentOptions} defaults={{}}/></PermissionGate></section>
 <section className="card"><h2>Auditorías del plan</h2><div className="audit-work-panel">{plan.entries.map(e=><article key={e.id} className="audit-action-card"><h3>{e.subject} {!e.isActive?"· Retirada":null}</h3><p>{e.targetName||e.department?.name||"Sin entidad indicada"} · {e.plannedPeriodText||format(e.plannedDate)||"Fecha por determinar"}</p>
 {e.audit?<p><Link href={`/audits/${e.audit.id}`}>Expediente: {e.audit.qmsRecord.businessCode||"Sin código"}</Link> · {e.audit.status==="CLOSED"?"Cerrada":e.audit.status==="OPEN"?"Abierta":"Borrador"}</p>:e.isActive?<PermissionGate permission="EDIT"><PermissionGate permission="CREATE" module="AUDIT"><Link className="button small" href={`/audits/new?planEntryId=${e.id}`}>Crear expediente para esta entrada</Link></PermissionGate></PermissionGate>:null}
 {e.isActive?<PermissionGate permission="EDIT"><details className="audit-editor"><summary>Editar planificación</summary><PermissionGate permission="EDIT"><PlanEntryForm planId={id} entryId={e.id} internal={intern} departments={departmentOptions} defaults={entryDefaults(e)}/></PermissionGate></details></PermissionGate>:null}
 {e.isActive&&!e.audit?<PermissionGate permission="EDIT"><details className="audit-editor"><summary>Retirar de la planificación</summary><PermissionGate permission="EDIT"><RetirePlanEntryForm planId={id} entryId={e.id}/></PermissionGate></details></PermissionGate>:null}
 </article>)}</div>{!plan.entries.length?<p>Sin entradas planificadas.</p>:null}</section>
 <AnnualProgrammePanel planId={id}/>
 <details className="card"><summary><strong>Historial de cambios del plan</strong></summary><ol className="audit-history">{plan.changes.map(c=><li key={c.id}><strong>{c.event}</strong><p>{c.reason}</p><small>{c.actor} · {c.createdAt.toISOString().slice(0,10)}</small></li>)}</ol></details>
 </section>;
}

export default async function PlanDetailPage(...args: Parameters<typeof PlanDetailPageAuthenticatedContent>) {
  return authorizedPage("src/app/audits/plans/[id]/page.tsx", () => PlanDetailPageAuthenticatedContent(...args), args);
}
