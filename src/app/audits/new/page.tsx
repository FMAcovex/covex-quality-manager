import { FormWithIndex } from "@/components/form-with-index";
import { authorizedPage } from "@/lib/auth/page-guard";
import { getPlanOptions } from "@/modules/audits/plans";
import { AuditForm } from "@/modules/audits/audit-form";
import { getAuditDepartments } from "@/modules/audits/queries";
export const dynamic = "force-dynamic";
async function NewAuditPageAuthenticatedContent({searchParams}:{searchParams:Promise<{planEntryId?:string}>}) {
  const {planEntryId}=await searchParams;
  const [departments,plans]=await Promise.all([getAuditDepartments(),getPlanOptions()]);
  const match=plans.flatMap(p=>p.entries.map(e=>({plan:p,entry:e}))).find(x=>x.entry.id===planEntryId&&!x.entry.audit);
  return <section className="workspace"><div className="page-heading"><div><p className="eyebrow">Sistema de Calidad</p><h1>Nueva auditoría</h1><p>Guarda un borrador o completa los datos de apertura.</p></div></div><FormWithIndex id="record-form-body"><AuditForm departments={departments} plans={plans} defaults={match?{planningStatus:"PLANNED",planEntryId:match.entry.id,auditType:match.plan.auditType,title:match.entry.subject,plannedDate:match.entry.plannedDate?.toISOString().slice(0,10)??""}:undefined}/></FormWithIndex></section>;
}

export default async function NewAuditPage(...args: Parameters<typeof NewAuditPageAuthenticatedContent>) {
  return authorizedPage("src/app/audits/new/page.tsx", () => NewAuditPageAuthenticatedContent(...args), args);
}
