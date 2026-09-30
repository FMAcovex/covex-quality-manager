import { createReturnAction } from "@/modules/returns/actions";
import { ReturnForm } from "@/modules/returns/components/return-form";
import { getReturnLookups } from "@/modules/returns/queries";
import { prisma } from "@/lib/db";
export const dynamic="force-dynamic";
export default async function NewReturnPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;const fromComplaintId=typeof params.fromComplaintId==="string"?params.fromComplaintId:undefined;
 const [lookups,complaint]=await Promise.all([getReturnLookups(),fromComplaintId?prisma.complaint.findUnique({where:{id:fromComplaintId},include:{qmsRecord:true}}):Promise.resolve(null)]);
 const defaults=complaint?{
  communicationDate:new Date().toISOString().slice(0,10),createdByText:process.env.DEFAULT_ACTOR_NAME||"Usuario demo",status:"DRAFT" as const,decision:"PENDING" as const,
  returnType:"COMPLAINT" as const,customerEntity:complaint.partyName??undefined,relatedDocument:complaint.qmsRecord.businessCode??undefined,
  reasonObservations:complaint.description??undefined,
  products:[{departmentId:"",productType:"OTHER" as const,otherProductType:"",productNameCode:complaint.reference??complaint.affectedScope??"Producto relacionado",format:"",lot:complaint.lotReference??"",expiryReanalysis:complaint.expiryReanalysis??"",quantity:complaint.quantity??"",unit:"",netWeight:"",grossWeight:"",receptionObservations:"",receivedBy:"",receivedByDate:"",verifiedBy:"",verifiedByDate:""}]
 }:{communicationDate:new Date().toISOString().slice(0,10),createdByText:process.env.DEFAULT_ACTOR_NAME||"Usuario demo",status:"DRAFT" as const,decision:"PENDING" as const};
 return <section className="workspace"><div className="page-heading"><div><p className="eyebrow">Devoluciones</p><h1>Nueva devolución</h1><p>GC-00/028/03 · recepción, evaluación y destino final.</p></div></div>
 {complaint?<div className="analytics-note"><strong>Origen:</strong> devolución iniciada desde la reclamación {complaint.qmsRecord.businessCode}.</div>:null}
 <ReturnForm mode="create" action={createReturnAction} departments={lookups.departments} defaults={defaults} fromComplaintId={fromComplaintId}/></section>;
}