import { createComplaintAction } from "@/modules/complaints/actions";
import { ComplaintForm } from "@/modules/complaints/components/complaint-form";
import { getComplaintLookups } from "@/modules/complaints/queries";
export const dynamic="force-dynamic";
export default async function NewComplaintPage(){
 const {departments}=await getComplaintLookups();
 return <section className="workspace"><div className="page-heading"><div><p className="eyebrow">Reclamaciones</p><h1>Nueva reclamación</h1><p>GC-00/027/02 · registro, investigación, resolución y cierre.</p></div></div>
 <ComplaintForm mode="create" action={createComplaintAction} departments={departments} defaults={{openedAt:new Date().toISOString().slice(0,10),createdByText:process.env.DEFAULT_ACTOR_NAME||"Usuario demo",status:"DRAFT",effectivenessStatus:"PENDING"}}/></section>;
}