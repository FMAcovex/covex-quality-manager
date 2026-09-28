"use server";

import type { FollowupActionState } from "@/components/basic-followup-form";

import { Prisma, QmsRecordType, QmsRelationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseComplaintForm } from "@/modules/complaints/validation";
import type { ComplaintFormState } from "@/modules/complaints/types";
import { getApplicableFormVersion,getApplicableTemplateVersion } from "@/modules/configuration/runtime";
import { ensureInitialVersion,refreshCurrentVersion,snapshotJson,serializeComplaintVersion } from "@/lib/qms/versioning";

const d=(v:string|null|undefined)=>v?new Date(v):null;
const j=(v:unknown):Prisma.InputJsonValue=>({value:v??null}) as Prisma.InputJsonValue;

async function getSnapshot(tx:Prisma.TransactionClient,id:string){
 return tx.complaint.findUniqueOrThrow({where:{id},include:{qmsRecord:true,followups:{orderBy:[{followupDate:"asc"},{createdAt:"asc"}]},capaPlans:{orderBy:{createdAt:"asc"},include:{linkedCapaRecord:true}},derivedActions:{orderBy:[{sortOrder:"asc"},{createdAt:"asc"}]},formVersion:true,annexIIITemplateVersion:true,annexIVTemplateVersion:true,annexVTemplateVersion:true}});
}

type ExistingComplaintSnapshot={departmentId:string|null;departmentCodeSnapshot:string|null;departmentNameSnapshot:string|null};
function complaintData(v:ReturnType<typeof parseComplaintForm>["values"],department:{id:string;code:string;name:string},existing?:ExistingComplaintSnapshot){
 return {
  departmentId:department.id,
  departmentCodeSnapshot:existing?.departmentId===department.id?(existing.departmentCodeSnapshot??department.code):department.code,
  departmentNameSnapshot:existing?.departmentId===department.id?(existing.departmentNameSnapshot??department.name):department.name,
  openedAt:d(v.openedAt),detectionDate:d(v.detectionDate),receivedAt:d(v.receivedAt),detectedBy:v.detectedBy,createdByText:v.createdByText,complaintType:v.complaintType!,
  detectionSources:v.detectionSources,otherDetectionSource:v.otherDetectionSource,scopeCategories:v.scopeCategories,otherScopeCategory:v.otherScopeCategory,
  affectedObjects:v.affectedObjects,otherAffectedObject:v.otherAffectedObject,complaintCategories:v.complaintCategories,otherComplaintCategory:v.otherComplaintCategory,
  partyName:v.partyName,contact:v.contact,affectedScope:v.affectedScope,reference:v.reference,lotReference:v.lotReference,quantity:v.quantity,
  expiryReanalysis:v.expiryReanalysis,purchaseDeliveryReference:v.purchaseDeliveryReference,description:v.description,recurrent:v.recurrent,
  recurrenceReference:v.recurrenceReference,attachedDocumentation:v.attachedDocumentation,emittedBy:v.emittedBy,qaValidatedBy:v.qaValidatedBy,
  investigation:v.investigation,impactAssessment:v.impactAssessment,impactQualityGmp:v.impactQualityGmp,impactSafetyEfficacy:v.impactSafetyEfficacy,
  impactRegulatory:v.impactRegulatory,impactEnvironment:v.impactEnvironment,impactOtherSimilar:v.impactOtherSimilar,
  containmentActions:v.containmentActions,otherContainmentAction:v.otherContainmentAction,containmentJustification:v.containmentJustification,
  investigationResult:v.investigationResult,rootCause:v.rootCause,classification:v.classification,
  recallPotential:v.recallPotential,recallProcedureRequired:v.recallProcedureRequired,authorityNotificationRequired:v.authorityNotificationRequired,
  responsibleClientCommunicationRequired:v.responsibleClientCommunicationRequired,regulatoryJustification:v.regulatoryJustification,
  resolutionLines:v.resolutionLines,resolutionActions:v.resolutionActions,immediateActionDetails:v.immediateActionDetails,otherResolutionDetails:v.otherResolutionDetails,
  externalCommunication:v.externalCommunication,communicationDate:d(v.communicationDate),communicationMedium:v.communicationMedium,
  communicationSenderRecipient:v.communicationSenderRecipient,communicationSummary:v.communicationSummary,
  conclusion:v.conclusion,continueToPartII:v.continueToPartII,effectivenessRequired:v.effectivenessRequired,initialEvaluationDate:d(v.initialEvaluationDate),
  initialConclusionDate:d(v.initialConclusionDate),responseDate:d(v.responseDate),responseMedium:v.responseMedium,responseSummary:v.responseSummary,responseSufficient:v.responseSufficient,
  effectivenessStatus:v.effectivenessStatus,effectivenessAssessment:v.effectivenessAssessment,closeConclusion:v.closeConclusion,
  closureActionStatus:v.closureActionStatus,closureActionReferences:v.closureActionReferences,closureActionResponsible:v.closureActionResponsible,approvalNames:v.approvalNames,
  closeApprovalNames:v.closeApprovalNames,closedAt:d(v.closedAt),status:v.status,internalObservations:v.internalObservations,
  signedDocumentAvailable:v.signedDocumentAvailable,dataQualityStatus:v.dataQualityStatus
 };
}

async function replaceDerivedActions(tx:Prisma.TransactionClient,complaintId:string,actions:ReturnType<typeof parseComplaintForm>["values"]["derivedActions"]){
 await tx.complaintDerivedAction.deleteMany({where:{complaintId}});
 for(let i=0;i<actions.length;i++){
  const a=actions[i];
  await tx.complaintDerivedAction.create({data:{complaintId,typeCode:a.typeCode,actionEvidence:a.actionEvidence||null,responsible:a.responsible||null,plannedDate:d(a.plannedDate),sortOrder:i}});
 }
}

async function replaceCapaPlans(tx:Prisma.TransactionClient,complaintId:string,plans:ReturnType<typeof parseComplaintForm>["values"]["capaPlans"]){
 const linked=await tx.complaintCapaPlan.findMany({where:{complaintId,linkedCapaRecordId:{not:null}},select:{id:true}});
 const preserved=new Set(linked.map(item=>item.id));
 await tx.complaintCapaPlan.deleteMany({where:{complaintId,linkedCapaRecordId:null}});
 for(const p of plans){
  if(p.id&&preserved.has(p.id))continue;
  await tx.complaintCapaPlan.create({data:{complaintId,actionType:p.actionType,description:p.description,plannedExecutionDate:d(p.plannedExecutionDate),responsible:p.responsible||null,businessCapaCode:p.businessCapaCode||null}});
 }
}

export async function createComplaintAction(_s:ComplaintFormState,fd:FormData):Promise<ComplaintFormState>{
 const parsed=parseComplaintForm(fd); if(parsed.errors.length)return{error:"No se puede guardar la reclamación.",fieldErrors:parsed.errors};
 const v=parsed.values; const department=await prisma.department.findUnique({where:{id:v.departmentId!}}); if(!department)return{error:"El departamento no existe."};
 const ref=d(v.openedAt)??new Date();
 const [form,iii,iv,vlist]=await Promise.all([
  getApplicableFormVersion(QmsRecordType.COMPLAINT,ref),
  getApplicableTemplateVersion(QmsRecordType.COMPLAINT,"COMPLAINT_ANNEX_III",ref),
  getApplicableTemplateVersion(QmsRecordType.COMPLAINT,"COMPLAINT_ANNEX_IV",ref),
  getApplicableTemplateVersion(QmsRecordType.COMPLAINT,"COMPLAINT_ANNEX_V",ref)
 ]);
 try{
  const created=await prisma.$transaction(async tx=>{
   const qr=await tx.qmsRecord.create({data:{recordType:"COMPLAINT",businessCode:v.businessCode,year:v.openedAt?new Date(v.openedAt).getFullYear():null}});
   const rec=await tx.complaint.create({data:{qmsRecordId:qr.id,...complaintData(v,department),formVersionId:form?.id,annexIIITemplateVersionId:iii?.id,annexIVTemplateVersionId:iv?.id,annexVTemplateVersionId:vlist?.id}});
   await replaceCapaPlans(tx,rec.id,v.capaPlans);
   await replaceDerivedActions(tx,rec.id,v.derivedActions);
   await tx.changeHistory.create({data:{qmsRecordId:qr.id,changedByText:parsed.actor,fieldPath:"__created__",newValue:j({businessCode:v.businessCode,description:v.description}),reason:"Alta de reclamación",source:"UI"}});
   const snap=await getSnapshot(tx,rec.id); await ensureInitialVersion(tx,qr.id,snapshotJson(serializeComplaintVersion(snap)),parsed.actor);
   return rec;
  });
  revalidatePath("/complaints");redirect(`/complaints/${created.id}`);
 }catch(e){if(e instanceof Error&&e.message.includes("Unique constraint"))return{error:"Ya existe una reclamación con esa codificación."};throw e;}
}

export async function updateComplaintAction(id:string,_s:ComplaintFormState,fd:FormData):Promise<ComplaintFormState>{
 const parsed=parseComplaintForm(fd); if(parsed.errors.length)return{error:"No se puede guardar la reclamación.",fieldErrors:parsed.errors};
 const v=parsed.values;
 const existing=await prisma.complaint.findUnique({where:{id},include:{qmsRecord:true}});if(!existing)return{error:"La reclamación ya no existe."};
 const department=await prisma.department.findUnique({where:{id:v.departmentId!}});if(!department)return{error:"El departamento no existe."};
 await prisma.$transaction(async tx=>{
  await tx.qmsRecord.update({where:{id:existing.qmsRecordId},data:{businessCode:v.businessCode,year:v.openedAt?new Date(v.openedAt).getFullYear():null}});
  await tx.complaint.update({where:{id},data:complaintData(v,department,existing)});
  await replaceCapaPlans(tx,id,v.capaPlans);
  await replaceDerivedActions(tx,id,v.derivedActions);
  await tx.changeHistory.create({data:{qmsRecordId:existing.qmsRecordId,changedByText:parsed.actor,fieldPath:"__edit__",oldValue:j({updatedAt:existing.updatedAt}),newValue:j({businessCode:v.businessCode,status:v.status}),reason:v.changeReason,source:"UI"}});
  const snap=await getSnapshot(tx,id);await refreshCurrentVersion(tx,existing.qmsRecordId,snapshotJson(serializeComplaintVersion(snap)),parsed.actor,v.changeReason);
 });
 revalidatePath("/complaints");revalidatePath(`/complaints/${id}`);redirect(`/complaints/${id}`);
}

export async function addComplaintFollowupAction(id:string,_state:FollowupActionState,fd:FormData):Promise<FollowupActionState>{
 const rec=await prisma.complaint.findUnique({where:{id}});if(!rec)return{error:"Reclamación no encontrada."};
 const followupDate=String(fd.get("followupDate")??""),completedByText=String(fd.get("completedByText")??"").trim(),comment=String(fd.get("comment")??"").trim();
 if(!followupDate||!completedByText||!comment)return{error:"Fecha, responsable y comentario son obligatorios."};
 await prisma.$transaction(async tx=>{
  await tx.complaintFollowup.create({data:{complaintId:id,followupDate:new Date(followupDate),completedByText,followupType:String(fd.get("followupType")??"").trim()||null,comment,nextFollowupDate:d(String(fd.get("nextFollowupDate")??"")),evidenceReference:String(fd.get("evidenceReference")??"").trim()||null}});
  await tx.changeHistory.create({data:{qmsRecordId:rec.qmsRecordId,changedByText:completedByText,fieldPath:"followups",newValue:j({followupDate,comment}),reason:"Nuevo seguimiento",source:"UI"}});
  const snap=await getSnapshot(tx,id);await refreshCurrentVersion(tx,rec.qmsRecordId,snapshotJson(serializeComplaintVersion(snap)),completedByText,"Nuevo seguimiento");
 });
 revalidatePath(`/complaints/${id}`);return{success:"Seguimiento guardado correctamente."};
}

export async function addComplaintRelationAction(id:string,fd:FormData){
 const rec=await prisma.complaint.findUnique({where:{id}});if(!rec)throw new Error("Reclamación no encontrada.");
 const code=String(fd.get("businessCode")??"").trim(),rawType=String(fd.get("relationType")??"RELATED_TO"),actor=String(fd.get("actor")??process.env.DEFAULT_ACTOR_NAME??"Usuario demo");
 const allowed=new Set(Object.values(QmsRelationType));if(!allowed.has(rawType as QmsRelationType))throw new Error("Tipo de relación no válido.");const type=rawType as QmsRelationType;
 const target=await prisma.qmsRecord.findFirst({where:{businessCode:code,id:{not:rec.qmsRecordId}}});if(!target)throw new Error("No existe un expediente con esa codificación.");
 await prisma.qmsRelation.upsert({where:{sourceRecordId_targetRecordId_relationType:{sourceRecordId:rec.qmsRecordId,targetRecordId:target.id,relationType:type}},update:{isActive:true,createdByText:actor},create:{sourceRecordId:rec.qmsRecordId,targetRecordId:target.id,relationType:type,createdByText:actor}});
 revalidatePath(`/complaints/${id}`);
}
