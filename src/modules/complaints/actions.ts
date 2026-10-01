"use server";

import type { FollowupActionState } from "@/components/basic-followup-form";

import { Prisma, QmsRecordType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { persistenceFormError } from "@/lib/forms/persistence-error";
import { preserveFormState } from "@/lib/forms/preserved-state";
import { allowedOutgoingRelationTypes } from "@/lib/qms/relation-rules";
import {
  deactivateOperationalRelation,
  linkOperationalRelationByBusinessCode,
} from "@/lib/qms/relation-service";
import {
  assignOperationalBusinessCode,
  OperationalBusinessCodeError,
} from "@/lib/qms/business-code";
import { parseComplaintForm } from "@/modules/complaints/validation";
import type { ComplaintFormState } from "@/modules/complaints/types";
import type { RelationActionState } from "@/lib/qms/relation-form-types";
import { getApplicableFormVersion,getApplicableTemplateVersion } from "@/modules/configuration/runtime";
import {
 ensureInitialVersion,refreshCurrentVersion,snapshotJson,serializeComplaintVersion,startNextVersion,
 complaintSnapshotVersionFollowupDate
} from "@/lib/qms/versioning";
import { complaintSaveMode,complaintVersionKind } from "@/modules/complaints/version-mode";

const d=(v:string|null|undefined)=>v?new Date(v):null;
const j=(v:unknown):Prisma.InputJsonValue=>({value:v??null}) as Prisma.InputJsonValue;

async function getSnapshot(tx:Prisma.TransactionClient,id:string){
 return tx.complaint.findUniqueOrThrow({where:{id},include:{qmsRecord:true,followups:{orderBy:[{followupDate:"asc"},{createdAt:"asc"}]},capaPlans:{orderBy:{createdAt:"asc"},include:{linkedCapaRecord:true}},derivedActions:{orderBy:[{sortOrder:"asc"},{createdAt:"asc"}]},formVersion:true,annexIIITemplateVersion:true,annexIVTemplateVersion:true,annexVTemplateVersion:true}});
}

type ExistingComplaintSnapshot={
 departmentId:string|null;departmentCodeSnapshot:string|null;departmentNameSnapshot:string|null;
 detectedBy:string|null;affectedScope:string|null;externalCommunication:string|null;effectivenessRequired:boolean|null;
 initialEvaluationDate:Date|null;initialConclusionDate:Date|null;approvalNames:string|null;closeApprovalNames:string|null;
 signedDocumentAvailable:boolean|null;
};
function complaintData(v:ReturnType<typeof parseComplaintForm>["values"],department:{id:string;code:string;name:string}|null,existing?:ExistingComplaintSnapshot){
 return {
  departmentId:department?.id??null,
  departmentCodeSnapshot:department?(existing?.departmentId===department.id?(existing.departmentCodeSnapshot??department.code):department.code):null,
  departmentNameSnapshot:department?(existing?.departmentId===department.id?(existing.departmentNameSnapshot??department.name):department.name):null,
  openedAt:d(v.openedAt),detectionDate:d(v.detectionDate),receptionDate:d(v.receptionDate),detectedBy:existing?.detectedBy??v.detectedBy,createdByText:v.createdByText,complaintType:v.complaintType!,
  sourceTypes:v.sourceTypes,sourceOther:v.sourceOther,scopeTypes:v.scopeTypes,scopeOther:v.scopeOther,affectedObjectTypes:v.affectedObjectTypes,affectedObjectOther:v.affectedObjectOther,
  categoryTypes:v.categoryTypes,categoryOther:v.categoryOther,partyName:v.partyName,contact:v.contact,affectedScope:existing?.affectedScope??v.affectedScope,reference:v.reference,lotReference:v.lotReference,quantity:v.quantity,
  expiryReanalysis:v.expiryReanalysis,purchaseDeliveryReference:v.purchaseDeliveryReference,description:v.description,recurrent:v.recurrent,
  recurrenceReference:v.recurrenceReference,attachedDocumentation:v.attachedDocumentation,emittedBy:v.emittedBy,qaValidatedBy:v.qaValidatedBy,
  investigation:v.investigation,impactAssessment:v.impactAssessment,impactQualityGmp:v.impactQualityGmp,impactSafetyEfficacy:v.impactSafetyEfficacy,
  impactRegulatory:v.impactRegulatory,impactEnvironment:v.impactEnvironment,impactOtherSimilar:v.impactOtherSimilar,containmentActions:v.containmentActions,
  containmentOther:v.containmentOther,riskJustification:v.riskJustification,investigationResult:v.investigationResult,rootCause:v.rootCause,classification:v.classification,
  potentialRecall:v.potentialRecall,recallProcedureRequired:v.recallProcedureRequired,authorityNotificationRequired:v.authorityNotificationRequired,
  responsiblePartyCommunicationRequired:v.responsiblePartyCommunicationRequired,regulatoryJustification:v.regulatoryJustification,
  resolutionLines:v.resolutionLines,resolutionActions:v.resolutionActions,hasDerivedActions:v.hasDerivedActions,nextFollowupDate:v.status==="CLOSED"?null:d(v.nextFollowupDate),
  immediateActionDetails:v.immediateActionDetails,recallActionDetails:v.recallActionDetails,creditActionDetails:v.creditActionDetails,replacementActionDetails:v.replacementActionDetails,otherResolutionDetails:v.otherResolutionDetails,
  externalCommunication:existing?.externalCommunication??v.externalCommunication,communicationDate:d(v.communicationDate),communicationMedium:v.communicationMedium,communicationParties:v.communicationParties,
  communicationSummary:v.communicationSummary,partIIRequired:v.partIIRequired,conclusion:v.conclusion,effectivenessRequired:existing?.effectivenessRequired??v.effectivenessRequired,initialEvaluationDate:existing?.initialEvaluationDate??d(v.initialEvaluationDate),
  initialConclusionDate:existing?.initialConclusionDate??d(v.initialConclusionDate),responseDate:d(v.responseDate),responseMedium:v.responseMedium,responseSummary:v.responseSummary,responseSufficient:v.responseSufficient,
  effectivenessStatus:v.effectivenessStatus,effectivenessAssessment:v.effectivenessAssessment,closeActionStatus:v.closeActionStatus,closeActionReferences:v.closeActionReferences,
  closeConclusion:v.closeConclusion,approvalNames:existing?.approvalNames??v.approvalNames,
  closeApprovalNames:existing?.closeApprovalNames??v.closeApprovalNames,closedAt:d(v.closedAt),status:v.status,internalObservations:v.internalObservations,
  signedDocumentAvailable:existing?.signedDocumentAvailable??v.signedDocumentAvailable,dataQualityStatus:v.dataQualityStatus
 };
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

async function replaceDerivedActions(tx:Prisma.TransactionClient,complaintId:string,actions:ReturnType<typeof parseComplaintForm>["values"]["derivedActions"]){
 await tx.complaintDerivedAction.deleteMany({where:{complaintId}});
 for(let i=0;i<actions.length;i++){
  const a=actions[i];
  await tx.complaintDerivedAction.create({data:{complaintId,actionType:a.actionType||"OTRA",businessCode:a.businessCode||null,description:a.description||null,responsible:a.responsible||null,plannedExecutionDate:d(a.plannedExecutionDate),sortOrder:a.sortOrder??i*10}});
 }
}

export async function createComplaintAction(previous:ComplaintFormState,fd:FormData):Promise<ComplaintFormState>{
 const parsed=parseComplaintForm(fd); if(parsed.errors.length)return preserveFormState(previous,fd,{error:"No se puede guardar la reclamación.",fieldErrors:parsed.errors});
 const v=parsed.values; let createdId:string;
 try{
  const department=v.departmentId?await prisma.department.findUnique({where:{id:v.departmentId}}):null;
  if(v.status!=="DRAFT"&&!department)return preserveFormState(previous,fd,{error:"El departamento no existe."});
  const ref=d(v.openedAt)??new Date();
  const [form,iii,iv,vlist]=await Promise.all([
   getApplicableFormVersion(QmsRecordType.COMPLAINT,ref),
   getApplicableTemplateVersion(QmsRecordType.COMPLAINT,"COMPLAINT_ANNEX_III",ref),
   getApplicableTemplateVersion(QmsRecordType.COMPLAINT,"COMPLAINT_ANNEX_IV",ref),
   getApplicableTemplateVersion(QmsRecordType.COMPLAINT,"COMPLAINT_ANNEX_V",ref)
  ]);
  const created=await prisma.$transaction(async tx=>{
   const openingYear=v.openedAt?new Date(v.openedAt).getFullYear():null;
   let businessCode=v.businessCode;
   if(openingYear&&(v.status!=="DRAFT"||businessCode)){
    businessCode=await assignOperationalBusinessCode(tx,{
     recordType:QmsRecordType.COMPLAINT,
     year:openingYear,
     complaintType:v.complaintType,
     requestedCode:businessCode
    });
   }else if(v.status!=="DRAFT"){
    throw new OperationalBusinessCodeError("INVALID_FORMAT","Para abrir la reclamación debe estar informada la fecha de apertura.");
   }else{
    businessCode=null;
   }
   v.businessCode=businessCode;
   const qr=await tx.qmsRecord.create({data:{recordType:"COMPLAINT",businessCode,year:openingYear}});
   const rec=await tx.complaint.create({data:{qmsRecordId:qr.id,...complaintData(v,department),formVersionId:form?.id,annexIIITemplateVersionId:iii?.id,annexIVTemplateVersionId:iv?.id,annexVTemplateVersionId:vlist?.id}});
   await replaceCapaPlans(tx,rec.id,v.capaPlans);
   await replaceDerivedActions(tx,rec.id,v.derivedActions);
   await tx.changeHistory.create({data:{qmsRecordId:qr.id,changedByText:parsed.actor,fieldPath:"__created__",newValue:j({businessCode:v.businessCode,description:v.description}),reason:v.status==="DRAFT"?"Borrador inicial de reclamación":"Alta de reclamación",source:"UI"}});
   const snap=await getSnapshot(tx,rec.id); await ensureInitialVersion(tx,qr.id,snapshotJson(serializeComplaintVersion(snap)),parsed.actor);
   return rec;
  });
  createdId=created.id;
 }catch(e){
  if(e instanceof OperationalBusinessCodeError){
   return preserveFormState(previous,fd,{error:"No se puede guardar la reclamación.",fieldErrors:[e.message]});
  }
  return preserveFormState(previous,fd,persistenceFormError(e,"la reclamación"));
 }
 revalidatePath("/complaints");redirect(`/complaints/${createdId}`);
}

export async function updateComplaintAction(id:string,previous:ComplaintFormState,fd:FormData):Promise<ComplaintFormState>{
 const parsed=parseComplaintForm(fd); if(parsed.errors.length)return preserveFormState(previous,fd,{error:"No se puede guardar la reclamación.",fieldErrors:parsed.errors});
 const v=parsed.values;
 const saveMode=complaintSaveMode(fd.get("saveMode"));
 const versionReason=String(fd.get("changeReason")??"").trim();
 const versionFollowupDate=String(fd.get("versionFollowupDate")??"").trim();
 if(saveMode==="CREATE_VERSION"&&!versionReason){
  return preserveFormState(previous,fd,{error:"No se puede generar la nueva versión.",fieldErrors:["Debe indicarse el motivo del seguimiento o de la nueva versión."]});
 }
 if(saveMode==="CREATE_VERSION"&&!versionFollowupDate){
  return preserveFormState(previous,fd,{error:"No se puede generar la nueva versión.",fieldErrors:["Debe indicarse la fecha del seguimiento o de la nueva versión."]});
 }
 const existing=await prisma.complaint.findUnique({where:{id},include:{qmsRecord:{include:{sourceRelations:{where:{isActive:true},include:{targetRecord:true}}}}}});if(!existing)return preserveFormState(previous,fd,{error:"La reclamación ya no existe."});
 if(v.hasDerivedActions===false&&existing.qmsRecord.sourceRelations.some(x=>x.targetRecord.recordType==="CAPA"||x.targetRecord.recordType==="RETURN")){
  return preserveFormState(previous,fd,{error:"No se puede indicar que no existen acciones derivadas mientras haya CAPA o Devoluciones vinculadas.",fieldErrors:["Desvincula primero los expedientes derivados o mantén «Sí» en acciones derivadas."]});
 }
 const requestedBusinessCode=v.businessCode;
 v.businessCode=existing.qmsRecord.businessCode??requestedBusinessCode;
 if(existing.status!=="DRAFT"&&v.status==="DRAFT"){
  return preserveFormState(previous,fd,{error:"No se puede volver a borrador una reclamación ya operativa.",fieldErrors:["Una reclamación abierta o cerrada no puede volver al estado Borrador."]});
 }
 const department=v.departmentId?await prisma.department.findUnique({where:{id:v.departmentId}}):null;
 if(v.status!=="DRAFT"&&!department)return preserveFormState(previous,fd,{error:"El departamento no existe."});
 try{
 await prisma.$transaction(async tx=>{
  const openingYear=v.openedAt?new Date(v.openedAt).getFullYear():null;
  let businessCode=existing.qmsRecord.businessCode;
  if(existing.status==="DRAFT"&&openingYear){
   if(!businessCode&&(v.status!=="DRAFT"||requestedBusinessCode)){
    businessCode=await assignOperationalBusinessCode(tx,{recordType:QmsRecordType.COMPLAINT,year:openingYear,complaintType:v.complaintType,requestedCode:requestedBusinessCode,excludeQmsRecordId:existing.qmsRecordId});
   }else if(businessCode&&requestedBusinessCode&&requestedBusinessCode!==businessCode){
    businessCode=await assignOperationalBusinessCode(tx,{recordType:QmsRecordType.COMPLAINT,year:openingYear,complaintType:v.complaintType,requestedCode:requestedBusinessCode,excludeQmsRecordId:existing.qmsRecordId});
   }
  }
  v.businessCode=businessCode;
  await tx.qmsRecord.update({where:{id:existing.qmsRecordId},data:{businessCode,year:openingYear}});
  await tx.complaint.update({where:{id},data:complaintData(v,department,existing)});
  await replaceCapaPlans(tx,id,v.capaPlans);
  await replaceDerivedActions(tx,id,v.derivedActions);
  await tx.changeHistory.create({data:{qmsRecordId:existing.qmsRecordId,changedByText:parsed.actor,fieldPath:"__edit__",oldValue:j({updatedAt:existing.updatedAt}),newValue:j({businessCode:v.businessCode,status:v.status}),reason:v.changeReason,source:"UI"}});
  const snap=await getSnapshot(tx,id);await refreshCurrentVersion(tx,existing.qmsRecordId,snapshotJson(serializeComplaintVersion(snap)),parsed.actor,v.changeReason);
 });

 }catch(e){
  if(e instanceof OperationalBusinessCodeError)return preserveFormState(previous,fd,{error:"No se puede guardar la reclamación.",fieldErrors:[e.message]});
  return preserveFormState(previous,fd,persistenceFormError(e,"la reclamación"));
}
 revalidatePath("/complaints");revalidatePath(`/complaints/${id}`);redirect(`/complaints/${id}`);
}

export async function addComplaintFollowupAction(id:string,_state:FollowupActionState,fd:FormData):Promise<FollowupActionState>{
 const rec=await prisma.complaint.findUnique({where:{id}});if(!rec)return{error:"Reclamación no encontrada."};
 if(rec.status==="DRAFT")return{error:"La reclamación debe estar abierta antes de registrar seguimientos."};
 const followupDate=String(fd.get("followupDate")??""),completedByText=String(fd.get("completedByText")??"").trim(),comment=String(fd.get("comment")??"").trim();
 if(!followupDate||!completedByText||!comment)return{error:"Fecha, responsable y comentario son obligatorios."};
 try{
await prisma.$transaction(async tx=>{
  await tx.complaintFollowup.create({data:{complaintId:id,followupDate:new Date(followupDate),completedByText,followupType:String(fd.get("followupType")??"").trim()||null,comment,nextFollowupDate:d(String(fd.get("nextFollowupDate")??"")),evidenceReference:String(fd.get("evidenceReference")??"").trim()||null}});
  await tx.changeHistory.create({data:{qmsRecordId:rec.qmsRecordId,changedByText:completedByText,fieldPath:"followups",newValue:j({followupDate,comment}),reason:"Nuevo seguimiento",source:"UI"}});
  const snap=await getSnapshot(tx,id);await refreshCurrentVersion(tx,rec.qmsRecordId,snapshotJson(serializeComplaintVersion(snap)),completedByText,"Nuevo seguimiento");
 });

 }catch(e){return persistenceFormError(e,"el seguimiento de la reclamación");}
 revalidatePath(`/complaints/${id}`);return{success:"Seguimiento guardado correctamente."};
}


export async function unlinkComplaintRelationAction(
 id:string,
 relatedQmsRecordId:string,
 fd:FormData
){
 const actor=String(fd.get("actor")??process.env.DEFAULT_ACTOR_NAME??"Usuario demo").trim();
 const rec=await prisma.complaint.findUnique({where:{id},select:{qmsRecordId:true}});
 if(!rec)throw new Error("La reclamación no existe.");

 await prisma.$transaction((tx)=>
  deactivateOperationalRelation(tx,{
   currentRecordId:rec.qmsRecordId,
   relatedRecordId:relatedQmsRecordId,
   changedByText:actor,
   reason:"Desvinculación de expediente derivado"
  })
 );

 revalidatePath("/complaints");
 revalidatePath("/capa");
 revalidatePath("/returns");
 revalidatePath(`/complaints/${id}`);
}

export async function addComplaintRelationAction(
 id:string,
 _state:RelationActionState,
 fd:FormData
):Promise<RelationActionState>{
 try{
  const rec=await prisma.complaint.findUnique({where:{id},select:{qmsRecordId:true,status:true}});
  if(!rec)return{error:"Reclamación no encontrada."};
  if(rec.status==="DRAFT")return{error:"La reclamación debe estar abierta antes de vincular expedientes derivados."};

  const code=String(fd.get("businessCode")??"").trim();
  const actor=String(fd.get("actor")??process.env.DEFAULT_ACTOR_NAME??"Usuario demo").trim();
  const requestedType=String(fd.get("recordType")??"").trim() as QmsRecordType;
  if(!code)return{error:"Debe indicarse la codificación del expediente derivado."};

  const allowedTypes=allowedOutgoingRelationTypes(QmsRecordType.COMPLAINT);
  if(!allowedTypes.includes(requestedType)){
   return{error:"Una reclamación solo puede vincularse operativamente con CAPA o Devoluciones."};
  }

  await prisma.$transaction(async tx=>{
   await linkOperationalRelationByBusinessCode(tx,{
    currentRecordId:rec.qmsRecordId,
    currentType:QmsRecordType.COMPLAINT,
    relatedType:requestedType,
    businessCode:code,
    createdByText:actor
   });
   await tx.complaint.update({where:{id},data:{hasDerivedActions:true}});
  });
  revalidatePath("/complaints");revalidatePath("/capa");revalidatePath("/returns");revalidatePath(`/complaints/${id}`);
  return{error:null,success:requestedType===QmsRecordType.CAPA?"CAPA vinculada correctamente.":"Devolución vinculada correctamente."};
 }catch(error){
  return{error:error instanceof Error?error.message:"No se ha podido vincular el expediente."};
 }
}
