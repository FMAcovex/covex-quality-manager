import { notFound } from "next/navigation";
import { updateComplaintAction } from "@/modules/complaints/actions";
import { ComplaintForm } from "@/modules/complaints/components/complaint-form";
import { getComplaintDetail,getComplaintLookups } from "@/modules/complaints/queries";
import { parseComplaintRevision03Json } from "@/modules/complaints/revision03";
export const dynamic="force-dynamic";
const b=(v:boolean|null):""|"true"|"false"=>v===true?"true":v===false?"false":"";
export default async function EditComplaintPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const [r,l]=await Promise.all([getComplaintDetail(id),getComplaintLookups()]);if(!r)notFound();
 const rev03=parseComplaintRevision03Json(r.extraData);
 const defaults={
  businessCode:r.qmsRecord.businessCode??undefined,departmentId:r.departmentId??undefined,openedAt:r.openedAt?.toISOString().slice(0,10),detectionDate:r.detectionDate?.toISOString().slice(0,10),
  detectedBy:r.detectedBy??undefined,createdByText:r.createdByText??undefined,complaintType:r.complaintType,partyName:r.partyName??undefined,contact:r.contact??undefined,
  affectedScope:r.affectedScope??undefined,reference:r.reference??undefined,lotReference:r.lotReference??undefined,quantity:r.quantity??undefined,expiryReanalysis:r.expiryReanalysis??undefined,
  purchaseDeliveryReference:r.purchaseDeliveryReference??undefined,description:r.description??undefined,recurrent:b(r.recurrent),recurrenceReference:r.recurrenceReference??undefined,
  attachedDocumentation:r.attachedDocumentation??undefined,emittedBy:r.emittedBy??undefined,qaValidatedBy:r.qaValidatedBy??undefined,investigation:r.investigation??undefined,
  impactAssessment:r.impactAssessment??undefined,investigationResult:r.investigationResult??undefined,rootCause:r.rootCause??undefined,classification:r.classification??undefined,
  resolutionLines:r.resolutionLines??undefined,resolutionActions:r.resolutionActions,immediateActionDetails:r.immediateActionDetails??undefined,otherResolutionDetails:r.otherResolutionDetails??undefined,
  externalCommunication:r.externalCommunication??undefined,conclusion:r.conclusion??undefined,effectivenessRequired:b(r.effectivenessRequired),
  initialEvaluationDate:r.initialEvaluationDate?.toISOString().slice(0,10),initialConclusionDate:r.initialConclusionDate?.toISOString().slice(0,10),
  responseDate:r.responseDate?.toISOString().slice(0,10),responseMedium:r.responseMedium??undefined,responseSummary:r.responseSummary??undefined,
  effectivenessStatus:r.effectivenessStatus,effectivenessAssessment:r.effectivenessAssessment??undefined,closeConclusion:r.closeConclusion??undefined,
  approvalNames:r.approvalNames??undefined,closeApprovalNames:r.closeApprovalNames??undefined,closedAt:r.closedAt?.toISOString().slice(0,10),status:r.status,
  internalObservations:r.internalObservations??undefined,signedDocumentAvailable:b(r.signedDocumentAvailable),dataQualityStatus:r.dataQualityStatus,
  capaPlans:r.capaPlans.map(x=>({id:x.id,actionType:x.actionType,description:x.description,plannedExecutionDate:x.plannedExecutionDate?.toISOString().slice(0,10)??"",responsible:x.responsible??"",businessCapaCode:x.businessCapaCode??""})),
  receivedAt:rev03.receivedAt??undefined,sourceFlags:rev03.sourceFlags,sourceOther:rev03.sourceOther??undefined,
  scopeFlags:rev03.scopeFlags,scopeOther:rev03.scopeOther??undefined,objectFlags:rev03.objectFlags,objectOther:rev03.objectOther??undefined,
  categoryFlags:rev03.categoryFlags,categoryOther:rev03.categoryOther??undefined,
  impactQualityGmp:rev03.impactQualityGmp??"",impactSafetyEfficacy:rev03.impactSafetyEfficacy??"",impactRegulatory:rev03.impactRegulatory??"",
  impactEnvironment:rev03.impactEnvironment??"",impactOtherLots:rev03.impactOtherLots??"",
  containmentFlags:rev03.containmentFlags,containmentOther:rev03.containmentOther??undefined,riskJustification:rev03.riskJustification??undefined,
  regulatoryMayRequireRecall:rev03.regulatoryMayRequireRecall??"",regulatoryActivateRecall:rev03.regulatoryActivateRecall??"",
  regulatoryAuthorityNotification:rev03.regulatoryAuthorityNotification??"",regulatoryResponsibleCommunication:rev03.regulatoryResponsibleCommunication??"",
  regulatoryJustification:rev03.regulatoryJustification??undefined,derivedActions:rev03.derivedActions,
  communicationDate:rev03.communicationDate??undefined,communicationMedium:rev03.communicationMedium??undefined,communicationFromTo:rev03.communicationFromTo??undefined,
  partIOutcome:rev03.partIOutcome??"",responseSufficient:b(rev03.responseSufficient),finalActionsStatus:rev03.finalActionsStatus??"",
  finalActionsReferences:rev03.finalActionsReferences??undefined,nextFollowupDate:rev03.nextFollowupDate??undefined
 };
 return <section className="workspace"><div className="page-heading"><div><p className="eyebrow">Reclamaciones</p><h1>Editar {r.qmsRecord.businessCode}</h1></div></div><ComplaintForm mode="edit" action={updateComplaintAction.bind(null,id)} departments={l.departments} defaults={defaults} complaintId={id}/></section>;
}