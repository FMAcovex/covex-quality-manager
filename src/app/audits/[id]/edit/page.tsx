import { authorizedPage } from "@/lib/auth/page-guard";
import { auditListingReturnTo } from "@/modules/audits/navigation";
import { getPlanOptions } from "@/modules/audits/plans";
import { notFound } from "next/navigation";
import { AuditForm } from "@/modules/audits/audit-form";
import { getAuditDetail, getAuditDepartments } from "@/modules/audits/queries";
import { auditDefaults } from "@/modules/audits/service";
export const dynamic = "force-dynamic";
async function EditAuditPageAuthenticatedContent({ params, searchParams }: { params: Promise<{id:string}>;searchParams: Promise<{returnTo?:string}> }) {
  const {id} = await params;
  const {returnTo} = await searchParams;
  const [audit,departments] = await Promise.all([getAuditDetail(id),getAuditDepartments()]);
  if (!audit) notFound();
  if (!audit.qmsRecord.isActive) return <section className="workspace"><h1>Expediente anulado</h1><p>Reactiva la auditoría desde su ficha antes de editarla.</p></section>;
  return <section className="workspace"><div className="page-heading"><h1>Editar auditoría</h1></div><AuditForm returnTo={auditListingReturnTo(returnTo)} id={id} defaults={auditDefaults(audit)} departments={departments} plans={await getPlanOptions()}/></section>;
}

export default async function EditAuditPage(...args: Parameters<typeof EditAuditPageAuthenticatedContent>) {
  return authorizedPage("src/app/audits/[id]/edit/page.tsx", () => EditAuditPageAuthenticatedContent(...args));
}
