import { administrativeToday } from "@/lib/qms/administrative-date";
import { FormWithIndex } from "@/components/form-with-index";
import { PermissionGate } from "@/components/permissions";
import { currentActor } from "@/lib/auth/presentation";
import { authorizedPage } from "@/lib/auth/page-guard";
import { createReturnAction } from "@/modules/returns/actions";
import { ReturnForm } from "@/modules/returns/components/return-form";
import { getReturnLookups } from "@/modules/returns/queries";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { complaintReturnProposalProblem, complaintReturnProposalState } from "@/modules/returns/complaint-origin";
export const dynamic="force-dynamic";
async function NewReturnPageAuthenticatedContent({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;const fromComplaintId=typeof params.fromComplaintId==="string"?params.fromComplaintId:undefined;
 // RET1: la devolución propuesta de la reclamación que cubre esta devolución.
 const fromComplaintActionId=fromComplaintId&&typeof params.fromComplaintActionId==="string"?params.fromComplaintActionId:undefined;
 const [lookups,complaint]=await Promise.all([getReturnLookups(),fromComplaintId?prisma.complaint.findUnique({where:{id:fromComplaintId},include:{qmsRecord:true}}):Promise.resolve(null)]);
 const defaults=complaint?{
  communicationDate:administrativeToday(),createdByText:currentActor(),status:"DRAFT" as const,decision:"PENDING" as const,
  returnType:"COMPLAINT" as const,customerEntity:complaint.partyName??undefined,relatedDocument:complaint.qmsRecord.businessCode??undefined,
  reasonObservations:complaint.description??undefined,
  products:[{departmentId:"",productType:"OTHER" as const,otherProductType:"",productNameCode:complaint.reference??complaint.affectedScope??"Producto relacionado",format:"",lot:complaint.lotReference??"",expiryReanalysis:complaint.expiryReanalysis??"",quantity:complaint.quantity??"",unit:"",netWeight:"",grossWeight:"",receptionObservations:"",receivedBy:"",receivedByDate:"",verifiedBy:"",verifiedByDate:""}]
 }:{communicationDate:administrativeToday(),createdByText:currentActor(),status:"DRAFT" as const,decision:"PENDING" as const};
 // RET1: si la devolución propuesta ya no admite otra devolución, se avisa antes de rellenar el formulario.
 const proposalProblem=complaint&&fromComplaintActionId?complaintReturnProposalProblem(await complaintReturnProposalState(prisma,complaint.id,fromComplaintActionId,undefined,false)):null;
 if(proposalProblem)return <section className="workspace"><div className="page-heading"><div><p className="eyebrow">Devoluciones</p><h1>Nueva devolución</h1></div></div>
  <div className="form-feedback error" role="alert">{proposalProblem}</div>
  <p><Link className="button" href={`/complaints/${complaint!.id}?tab=part-i`}>Volver a la reclamación {complaint!.qmsRecord.businessCode}</Link></p></section>;
 return <section className="workspace"><div className="page-heading"><div><p className="eyebrow">Devoluciones</p><h1>Nueva devolución</h1><p>GC-00/028/03 · recepción, evaluación y destino final.</p></div></div>
 {complaint?<div className="analytics-note"><strong>Origen:</strong> devolución iniciada desde la reclamación {complaint.qmsRecord.businessCode}.</div>:null}
 <PermissionGate permission="CREATE"><FormWithIndex id="record-form-body"><ReturnForm mode="create" action={createReturnAction} departments={lookups.departments} defaults={defaults} fromComplaintId={fromComplaintId} fromComplaintActionId={fromComplaintActionId}/></FormWithIndex></PermissionGate></section>;
}

export default async function NewReturnPage(...args: Parameters<typeof NewReturnPageAuthenticatedContent>) {
  return authorizedPage("src/app/returns/new/page.tsx", () => NewReturnPageAuthenticatedContent(...args), args);
}
