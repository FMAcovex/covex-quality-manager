import { PermissionGate } from "@/components/permissions";
import { currentActor } from "@/lib/auth/presentation";
import { authorizedPage } from "@/lib/auth/page-guard";
import { createComplaintAction } from "@/modules/complaints/actions";
import { ComplaintForm } from "@/modules/complaints/components/complaint-form";
import { getComplaintLookups } from "@/modules/complaints/queries";
export const dynamic="force-dynamic";
async function NewComplaintPageAuthenticatedContent(){
 const {departments}=await getComplaintLookups();
 return <section className="workspace"><div className="page-heading"><div><p className="eyebrow">Reclamaciones</p><h1>Nueva reclamación</h1><p>GC-00/027/03 · registro, investigación, resolución y cierre.</p></div></div>
 <PermissionGate permission="CREATE"><ComplaintForm mode="create" action={createComplaintAction} departments={departments} defaults={{openedAt:new Date().toISOString().slice(0,10),createdByText:currentActor(),status:"DRAFT",effectivenessStatus:"PENDING",partIIRequired:"pending"}}/></PermissionGate></section>;
}

export default async function NewComplaintPage(...args: Parameters<typeof NewComplaintPageAuthenticatedContent>) {
  return authorizedPage("src/app/complaints/new/page.tsx", () => NewComplaintPageAuthenticatedContent(...args), args);
}
