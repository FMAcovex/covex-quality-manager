import { notFound } from "next/navigation";
import { updateComplaintAction } from "@/modules/complaints/actions";
import { ComplaintForm } from "@/modules/complaints/components/complaint-form";
import { getComplaintDetail,getComplaintLookups } from "@/modules/complaints/queries";
export const dynamic="force-dynamic";
const b=(v:boolean|null):""|"true"|"false"=>v===true?"true":v===false?"false":"";
export default async function EditComplaintPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const [r,l]=await Promise.all([getComplaintDetail(id),getComplaintLookups()]);if(!r)notFound();
 const defaults={
  businessCode:r.qmsRecord.businessCode??undefined,departmentId:r.departmentId??undefined,openedAt:r.openedAt?.toISOString().slice(0,10),detectionDate:r.detectionDate?.toISOString().slice(0,10),receivedAt:r.receivedAt?.toISOString().slice(0,10),
  detectedBy:r.detectedBy??undefined,createdByText:r.createdByText??undefined,complaintType:r.complaintType,
  detectionSources:r.detectionSources,otherDetectionSource:r.otherDetectionSource??undefined,scopeCategories:r.scopeCategories,otherScopeCategory:r.otherScopeCategory??undefined,
  affectedObjects:r.affectedObjects,otherAffectedObject:r.otherAffectedObject??undefined,complaintCategories:r.complaintCategories,otherComplaintCategory:r.otherComplaintCategory??undefined,
  partyName:r.partyName??undefined,contact:r.contact??undefined,
  affectedScope:r.affectedScope??undefined,reference:r.reference??undefined,lotReference:r.lotReference??undefined,quantity:r.quantity??undefined,expiryReanalysis:r.expiryReanalysis??undefined,
  purchaseDeliveryReference:r.purchaseDeliveryReference??undefined,description:r.description??undefined,recurrent:b(r.recurrent),recurrenceReference:r.recurrenceReference??undefined,
  attachedDocumentation:r.attachedDocumentation??undefined,emittedBy:r.emittedBy??undefined,qaValidatedBy:r.qaValidatedBy??undefined,investigation:r.investigation??undefined,
  impactAssessment:r.impactAssessment??undefined,impactQualityGmp:b(r.impactQualityGmp),impactSafetyEfficacy:b(r.impactSafetyEfficacy),
  impactRegulatory:b(r.impactRegulatory),impactEnvironment:b(r.impactEnvironment),impactOtherSimilar:b(r.impactOtherSimilar),
  containmentActions:r.containmentActions,otherContainmentAction:r.otherContainmentAction??undefined,containmentJustification:r.containmentJustification??undefined,
  investigationResult:r.investigationResult??undefined,rootCause:r.rootCause??undefined,classification:r.classification??undefined,
  recallPotential:r.recallPotential??"",recallProcedureRequired:r.recallProcedureRequired??"",authorityNotificationRequired:r.authorityNotificationRequired??"",
  responsibleClientCommunicationRequired:r.responsibleClientCommunicationRequired??"",regulatoryJustification:r.regulatoryJustification??undefined,
  resolutionLines:r.resolutionLines??undefined,resolutionActions:r.resolutionActions,immediateActionDetails:r.immediateActionDetails??undefined,otherResolutionDetails:r.otherResolutionDetails??undefined,
  externalCommunication:r.externalCommunication??undefined,communicationDate:r.communicationDate?.toISOString().slice(0,10),
  communicationMedium:r.communicationMedium??undefined,communicationSenderRecipient:r.communicationSenderRecipient??undefined,
  communicationSummary:r.communicationSummary??undefined,conclusion:r.conclusion??undefined,continueToPartII:b(r.continueToPartII),effectivenessRequired:b(r.effectivenessRequired),
  initialEvaluationDate:r.initialEvaluationDate?.toISOString().slice(0,10),initialConclusionDate:r.initialConclusionDate?.toISOString().slice(0,10),
  responseDate:r.responseDate?.toISOString().slice(0,10),responseMedium:r.responseMedium??undefined,responseSummary:r.responseSummary??undefined,responseSufficient:b(r.responseSufficient),
  effectivenessStatus:r.effectivenessStatus,effectivenessAssessment:r.effectivenessAssessment??undefined,closeConclusion:r.closeConclusion??undefined,
  closureActionStatus:r.closureActionStatus??undefined,closureActionReferences:r.closureActionReferences??undefined,closureActionResponsible:r.closureActionResponsible??undefined,
  approvalNames:r.approvalNames??undefined,closeApprovalNames:r.closeApprovalNames??undefined,closedAt:r.closedAt?.toISOString().slice(0,10),status:r.status,
  internalObservations:r.internalObservations??undefined,signedDocumentAvailable:b(r.signedDocumentAvailable),dataQualityStatus:r.dataQualityStatus,
  capaPlans:r.capaPlans.map(x=>({id:x.id,actionType:x.actionType,description:x.description,plannedExecutionDate:x.plannedExecutionDate?.toISOString().slice(0,10)??"",responsible:x.responsible??"",businessCapaCode:x.businessCapaCode??""})),
  derivedActions:r.derivedActions.map(x=>({id:x.id,typeCode:x.typeCode,actionEvidence:x.actionEvidence??"",responsible:x.responsible??"",plannedDate:x.plannedDate?.toISOString().slice(0,10)??""}))
 };
 return <section className="workspace"><div className="page-heading"><div><p className="eyebrow">Reclamaciones</p><h1>Editar {r.qmsRecord.businessCode}</h1></div></div><ComplaintForm mode="edit" action={updateComplaintAction.bind(null,id)} departments={l.departments} defaults={defaults} complaintId={id}/></section>;
}