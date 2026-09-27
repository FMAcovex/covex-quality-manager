import { createReturnAction } from "@/modules/returns/actions";
import { ReturnForm } from "@/modules/returns/components/return-form";
import { getReturnLookups } from "@/modules/returns/queries";
export const dynamic="force-dynamic";
export default async function NewReturnPage(){const {departments}=await getReturnLookups();return <section className="workspace"><div className="page-heading"><div><p className="eyebrow">Devoluciones</p><h1>Nueva devolución</h1><p>GC-00/028/03 · recepción, evaluación y destino final.</p></div></div><ReturnForm mode="create" action={createReturnAction} departments={departments} defaults={{communicationDate:new Date().toISOString().slice(0,10),createdByText:process.env.DEFAULT_ACTOR_NAME||"Usuario demo",status:"OPEN",decision:"PENDING"}}/></section>}