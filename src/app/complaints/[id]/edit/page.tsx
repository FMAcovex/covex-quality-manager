import { notFound } from "next/navigation";
import { updateComplaintAction } from "@/modules/complaints/actions";
import { ComplaintForm } from "@/modules/complaints/components/complaint-form";
import { getComplaintDetail,getComplaintLookups } from "@/modules/complaints/queries";
export const dynamic="force-dynamic";
const b=(v:boolean|null):""|"true"|"false"=>v===true?"true":v===false?"false":"";
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};
const str=(v:unknown)=>typeof v==="string"?v:undefined;
const arr=(v:unknown)=>Array.isArray(v)?v.filter((x):x is string=>typeof x==="string"):[];
const tri=(v:unknown)=>v==="YES"||v==="NO"||v==="NA"?v:undefined;
const dateStr=(v:unknown)=>typeof v==="string"?v:undefined;
export default async function EditComplaintPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const [r,l]=await Promise.all([getComplaintDetail(id),getComplaintLookups()]);if(!r)notFound();
 const extra=obj(r.extraData),v03=obj(extra.complaintV03);
 const derived=Array.isArray(v03.derivedActions)?v03.derivedActions.map(x=>{const a=obj(x);return{id:str(a.id),typeCode:str(a.typeCode)??"",actionEvidence:str(a.actionEvidence)??"",responsible:str(a.responsible)??"",plannedDate:dateStr(a.plannedDate)??""}}):[];
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
  v03Origins:arr(v03.origins),v03OriginOther:str(v03.originOther),v03Scopes:arr(v03.scopes),v03AffectedItems:arr(v03.affectedItems),v03CategoryReasons:arr(v03.categoryReasons),
  v03ImpactQualityGmp:tri(v03.impactQualityGmp),v03ImpactSafetyEfficacyUser:tri(v03.impactSafetyEfficacyUser),v03ImpactRegulatory:tri(v03.impactRegulatory),
  v03ImpactEnvironmental:tri(v03.impactEnvironmental),v03SimilarOtherLots:tri(v03.similarOtherLots),v03ContainmentActions:arr(v03.containmentActions),
  v03ContainmentOther:str(v03.containmentOther),v03RiskScopeJustification:str(v03.riskScopeJustification),v03MayRequireRecall:tri(v03.mayRequireRecall),
  v03ActivateRecall:tri(v03.activateRecall),v03AuthorityNotification:tri(v03.authorityNotification),v03MahClientCommunication:tri(v03.mahClientCommunication),
  v03RegulatoryJustification:str(v03.regulatoryJustification),v03DerivedActions:derived,v03CommunicationDate:dateStr(v03.communicationDate),
  v03CommunicationMedium:str(v03.communicationMedium),v03CommunicationSenderRecipient:str(v03.communicationSenderRecipient),v03CommunicationSummary:str(v03.communicationSummary),
  v03ContinuePartII:v03.continuePartII===true?"true":v03.continuePartII===false?"false":"",v03PartIConclusionPendings:str(v03.partIConclusionPendings),
  v03ResponseSufficient:tri(v03.responseSufficient),v03ActionStateSummary:str(v03.actionStateSummary),v03NextFollowupDate:dateStr(v03.nextFollowupDate)
 };
 return <section className="workspace"><div className="page-heading"><div><p className="eyebrow">Reclamaciones</p><h1>Editar {r.qmsRecord.businessCode}</h1></div></div><ComplaintForm mode="edit" action={updateComplaintAction.bind(null,id)} departments={l.departments} defaults={defaults} complaintId={id}/></section>;
}