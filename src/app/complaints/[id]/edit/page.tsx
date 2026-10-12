import { PermissionGate } from "@/components/permissions";
import { authorizedPage } from "@/lib/auth/page-guard";
import { notFound } from "next/navigation";
import { qmsDetailUrl, qmsListingReturnTo, qmsDetailTab } from "@/lib/qms/list-return-navigation";
import { updateComplaintAction } from "@/modules/complaints/actions";
import { ComplaintForm } from "@/modules/complaints/components/complaint-form";
import { getComplaintDetail,getComplaintLookups } from "@/modules/complaints/queries";
import type { ComplaintFormDefaults } from "@/modules/complaints/types";
export const dynamic="force-dynamic";
const b=(v:boolean|null):""|"true"|"false"=>v===true?"true":v===false?"false":"";
const partII=(v:boolean|null):"pending"|"true"|"false"=>v===true?"true":v===false?"false":"pending";
async function EditComplaintPageAuthenticatedContent({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{returnTo?:string;tab?:string}>}){
 const {id}=await params;
 const {returnTo,tab}=await searchParams;
 const cancelHref=qmsDetailUrl("/complaints",id,returnTo,tab);const [r,l]=await Promise.all([getComplaintDetail(id),getComplaintLookups()]);if(!r)notFound();
 const defaults:ComplaintFormDefaults={
  businessCode:r.qmsRecord.businessCode??undefined,departmentId:r.departmentId??undefined,openedAt:r.openedAt?.toISOString().slice(0,10),detectionDate:r.detectionDate?.toISOString().slice(0,10),
  receptionDate:r.receptionDate?.toISOString().slice(0,10),detectedBy:r.detectedBy??undefined,createdByText:r.createdByText??undefined,complaintType:r.complaintType,
  sourceTypes:r.sourceTypes,sourceOther:r.sourceOther??undefined,scopeTypes:r.scopeTypes,scopeOther:r.scopeOther??undefined,
  affectedObjectTypes:r.affectedObjectTypes,affectedObjectOther:r.affectedObjectOther??undefined,categoryTypes:r.categoryTypes,categoryOther:r.categoryOther??undefined,
  partyName:r.partyName??undefined,contact:r.contact??undefined,
  affectedScope:r.affectedScope??undefined,reference:r.reference??undefined,lotReference:r.lotReference??undefined,quantity:r.quantity??undefined,expiryReanalysis:r.expiryReanalysis??undefined,
  purchaseDeliveryReference:r.purchaseDeliveryReference??undefined,description:r.description??undefined,recurrent:b(r.recurrent),recurrenceReference:r.recurrenceReference??undefined,
  attachedDocumentation:r.attachedDocumentation??undefined,emittedBy:r.emittedBy??undefined,qaValidatedBy:r.qaValidatedBy??undefined,investigation:r.investigation??undefined,
  impactAssessment:r.impactAssessment??undefined,impactQualityGmp:r.impactQualityGmp??"",impactSafetyEfficacy:r.impactSafetyEfficacy??"",
  impactRegulatory:r.impactRegulatory??"",impactEnvironment:r.impactEnvironment??"",impactOtherSimilar:r.impactOtherSimilar??"",
  containmentActions:r.containmentActions,containmentOther:r.containmentOther??undefined,riskJustification:r.riskJustification??undefined,
  investigationResult:r.investigationResult??undefined,rootCause:r.rootCause??undefined,classification:r.classification??undefined,
  potentialRecall:r.potentialRecall??"",recallProcedureRequired:r.recallProcedureRequired??"",authorityNotificationRequired:r.authorityNotificationRequired??"",
  responsiblePartyCommunicationRequired:r.responsiblePartyCommunicationRequired??"",regulatoryJustification:r.regulatoryJustification??undefined,
  resolutionLines:r.resolutionLines??undefined,resolutionActions:r.resolutionActions,
   immediateActionDetails:r.immediateActionDetails??undefined,recallActionDetails:r.recallActionDetails??undefined,
   creditActionDetails:r.creditActionDetails??undefined,replacementActionDetails:r.replacementActionDetails??undefined,
   otherResolutionDetails:r.otherResolutionDetails??undefined,
  externalCommunication:r.externalCommunication??undefined,communicationDate:r.communicationDate?.toISOString().slice(0,10),communicationMedium:r.communicationMedium??undefined,
  communicationParties:r.communicationParties??undefined,communicationSummary:r.communicationSummary??undefined,partIIRequired:partII(r.partIIRequired),
  hasDerivedActions:(r.hasDerivedActions===true||r.qmsRecord.sourceRelations.some(x=>x.targetRecord.recordType==="CAPA"||x.targetRecord.recordType==="RETURN")?"true":r.hasDerivedActions===false?"false":""),
  nextFollowupDate:r.nextFollowupDate?.toISOString().slice(0,10),
  conclusion:r.conclusion??undefined,effectivenessRequired:b(r.effectivenessRequired),
  initialEvaluationDate:r.initialEvaluationDate?.toISOString().slice(0,10),initialConclusionDate:r.initialConclusionDate?.toISOString().slice(0,10),
  responseDate:r.responseDate?.toISOString().slice(0,10),responseMedium:r.responseMedium??undefined,responseSummary:r.responseSummary??undefined,responseSufficient:b(r.responseSufficient),
  effectivenessStatus:r.effectivenessStatus,effectivenessAssessment:r.effectivenessAssessment??undefined,closeActionStatus:r.closeActionStatus??undefined,
  closeActionReferences:r.closeActionReferences??undefined,closeConclusion:r.closeConclusion??undefined,
  approvalNames:r.approvalNames??undefined,closeApprovalNames:r.closeApprovalNames??undefined,closedAt:r.closedAt?.toISOString().slice(0,10),status:r.status,
  internalObservations:r.internalObservations??undefined,signedDocumentAvailable:b(r.signedDocumentAvailable),dataQualityStatus:r.dataQualityStatus,
  capaPlans:r.capaPlans.map(x=>({id:x.id,actionType:x.actionType,description:x.description,plannedExecutionDate:x.plannedExecutionDate?.toISOString().slice(0,10)??"",responsible:x.responsible??"",businessCapaCode:x.businessCapaCode??""})),
  derivedActions:r.derivedActions.map(x=>({id:x.id,actionType:x.actionType,businessCode:x.businessCode??"",description:x.description??"",responsible:x.responsible??"",plannedExecutionDate:x.plannedExecutionDate?.toISOString().slice(0,10)??"",sortOrder:x.sortOrder}))
 };
 return <section className="workspace"><div className="page-heading"><div><p className="eyebrow">Reclamaciones</p><h1>Editar {r.qmsRecord.businessCode}</h1></div></div><PermissionGate permission="EDIT"><ComplaintForm mode="edit" action={updateComplaintAction.bind(null,id)} departments={l.departments} defaults={defaults} complaintId={id} cancelHref={cancelHref} returnTo={qmsListingReturnTo("/complaints",returnTo)} detailTab={qmsDetailTab("/complaints",tab)}/></PermissionGate></section>;
}

export default async function EditComplaintPage(...args: Parameters<typeof EditComplaintPageAuthenticatedContent>) {
  return authorizedPage("src/app/complaints/[id]/edit/page.tsx", () => EditComplaintPageAuthenticatedContent(...args), args);
}
