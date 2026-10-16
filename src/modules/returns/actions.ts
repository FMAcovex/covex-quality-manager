"use server";

import { authorizedAction } from "@/lib/auth/action-guard";
import type { FollowupActionState } from "@/components/basic-followup-form";
import { Prisma,QmsRecordType } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { persistenceFormError } from "@/lib/forms/persistence-error";
import { preserveFormState } from "@/lib/forms/preserved-state";
import {
  createQmsRelation,
  deactivateOperationalRelation,
  linkOperationalRelationByBusinessCode,
} from "@/lib/qms/relation-service";
import {
  assignOperationalBusinessCode,
  OperationalBusinessCodeError,
} from "@/lib/qms/business-code";
import { parseReturnForm } from "@/modules/returns/validation";
import {
  ComplaintReturnLinkError,
  getComplaintReturnOrigin,
  registerComplaintReturnOrigin,
} from "@/modules/returns/complaint-origin";
import type { ReturnFormState } from "@/modules/returns/types";
import type { RelationActionState } from "@/lib/qms/relation-form-types";
import { getApplicableFormVersion,getApplicableTemplateVersion } from "@/modules/configuration/runtime";
import { saveReturnProducts } from "./product-service";
import { lockReturn, returnSnapshotSource, refreshReturnSnapshot } from "./snapshot-service";
import { contextFromExtraData,validReturnDate } from "./rules";
import { isReturnDepartmentCode } from "@/modules/returns/departments";
import { ensureInitialVersion,serializeReturnVersion,snapshotJson } from "@/lib/qms/versioning";
import { keepsOperationalStatus } from "@/modules/lifecycle";
const d=(v:string|null|undefined)=>v?new Date(v):null;
const j=(v:unknown):Prisma.InputJsonValue=>({value:v??null}) as Prisma.InputJsonValue;

const getSnapshot=returnSnapshotSource;
type ExistingReturnSnapshot={
 departmentId:string|null;
 departmentCodeSnapshot:string|null;
 departmentNameSnapshot:string|null;
 customerDeclarationSignatoryName:string|null;
 customerDeclarationSignatoryRole:string|null;
 customerDeclarationSignedAt:Date|null;
 customerDeclarationObservations:string|null;
 decisionObservations:string|null;
 qaApprovalName:string|null;
 technicalApprovalName:string|null;
 destructionManagedBy:string|null;
 destructionCertificate:string|null;
};
function recordData(v:ReturnType<typeof parseReturnForm>["values"],department:{id:string;code:string;name:string}|null,existing?:ExistingReturnSnapshot,submitted?:FormData){
 return {
  departmentId:department?.id??null,departmentCodeSnapshot:department?(existing?.departmentId===department.id?(existing.departmentCodeSnapshot??department.code):department.code):null,
  departmentNameSnapshot:department?(existing?.departmentId===department.id?(existing.departmentNameSnapshot??department.name):department.name):null,
  communicationDate:d(v.communicationDate),receivedAt:d(v.receivedAt),createdByText:v.createdByText,returnType:v.returnType??"OTHER",otherReturnType:v.otherReturnType,
  customerEntity:v.customerEntity,country:v.country,address:v.address,relatedDocument:v.relatedDocument,conservationConditions:v.conservationConditions,
  deliveryNote:v.deliveryNote,reasonObservations:v.reasonObservations,attachedDocumentation:v.attachedDocumentation,
  withinAcceptedReturnPeriod:v.withinAcceptedReturnPeriod,roomTemperatureWithinTenDays:v.roomTemperatureWithinTenDays,coldChainWithinFortyEightHours:v.coldChainWithinFortyEightHours,
  uniqueIdentifierActive:v.uniqueIdentifierActive,tamperEvidenceIntact:v.tamperEvidenceIntact,packagingIntegrityOk:v.packagingIntegrityOk,
  customerDeclarationAvailable:v.customerDeclarationAvailable,customerDeclarationSignatoryName:existing&&!submitted?.has("customerDeclarationSignatoryName")?existing.customerDeclarationSignatoryName:v.customerDeclarationSignatoryName,
  customerDeclarationSignatoryRole:existing&&!submitted?.has("customerDeclarationSignatoryRole")?existing.customerDeclarationSignatoryRole:v.customerDeclarationSignatoryRole,customerDeclarationSignedAt:existing&&!submitted?.has("customerDeclarationSignedAt")?existing.customerDeclarationSignedAt:d(v.customerDeclarationSignedAt),
  customerDeclarationObservations:existing&&!submitted?.has("customerDeclarationObservations")?existing.customerDeclarationObservations:v.customerDeclarationObservations,storageTransportConditionsOk:v.storageTransportConditionsOk,noUseDamageContamination:v.noUseDamageContamination,
  noRecallAlertBlock:v.noRecallAlertBlock,expiryAcceptable:v.expiryAcceptable,qcAssessmentCompleted:v.qcAssessmentCompleted,storageTemperatureRecord:v.storageTemperatureRecord,
  returnTransportTempEvidence:v.returnTransportTempEvidence,transportPackagingSuitable:v.transportPackagingSuitable,receiptTemperatureAcceptable:v.receiptTemperatureAcceptable,
  temperatureExcursionEvaluated:v.temperatureExcursionEvaluated,coldChainReturnSystemValidated:v.coldChainReturnSystemValidated,decision:v.decision,
  finalDestination:v.finalDestination,decisionObservations:existing&&!submitted?.has("decisionObservations")?existing.decisionObservations:v.decisionObservations,qaApprovalName:existing&&!submitted?.has("qaApprovalName")?existing.qaApprovalName:v.qaApprovalName,technicalApprovalName:existing&&!submitted?.has("technicalApprovalName")?existing.technicalApprovalName:v.technicalApprovalName,decisionDate:d(v.decisionDate),
  destructionManagedBy:existing&&!submitted?.has("destructionManagedBy")?existing.destructionManagedBy:v.destructionManagedBy,destructionCertificate:existing&&!submitted?.has("destructionCertificate")?existing.destructionCertificate:v.destructionCertificate,traceabilityUpdated:v.traceabilityUpdated,
  closedAt:v.status==="CLOSED"?d(v.closedAt):null,status:v.status,internalObservations:v.internalObservations,signedDocumentAvailable:v.signedDocumentAvailable,dataQualityStatus:v.dataQualityStatus
 };
}
const replaceProducts=saveReturnProducts;
async function planFollowup(tx:Prisma.TransactionClient,id:string,v:ReturnType<typeof parseReturnForm>["values"],actor:string){
 if(v.status!=="OPEN"||!v.nextFollowupDate)return;
 const latest=await tx.returnFollowup.findFirst({where:{returnRecordId:id},orderBy:[{followupDate:"desc"},{createdAt:"desc"},{id:"desc"}]});
 if(latest?.nextFollowupDate?.toISOString().slice(0,10)===v.nextFollowupDate)return;
 await tx.returnFollowup.create({data:{returnRecordId:id,followupDate:new Date(),completedByText:actor,comment:v.followupComment!,nextFollowupDate:new Date(v.nextFollowupDate)}});
}
function extraData(existing:Prisma.JsonValue|null|undefined,v:ReturnType<typeof parseReturnForm>["values"],pendingComplaintId?:string|null):Prisma.InputJsonObject{
 const data=existing&&typeof existing==="object"&&!Array.isArray(existing)?{...existing}:{};
 delete data.pendingComplaintId;
 return {...data,pendingReturnType:v.returnType===null,r4b:v.context,...(pendingComplaintId?{pendingComplaintId}:{})} as Prisma.InputJsonObject;
}
async function createReturnActionAuthenticatedContent(previous:ReturnFormState,fd:FormData):Promise<ReturnFormState>{
 const parsed=parseReturnForm(fd);if(parsed.errors.length)return preserveFormState(previous,fd,{error:"No se puede guardar la devolución.",fieldErrors:parsed.errors});
 const v=parsed.values;let createdId:string;
 try{
  const department=v.departmentId?await prisma.department.findUnique({where:{id:v.departmentId}}):null;
  if((department&&!isReturnDepartmentCode(department.code))||(v.status!=="DRAFT"&&!department))return preserveFormState(previous,fd,{error:"El área seleccionada no es válida para Devoluciones.",fieldErrors:["La codificación de Devoluciones está restringida a LG-00, LG-10, LG-20, LG-30 y LG-40."]});
  const ref=d(v.communicationDate)??new Date();
  const [form,iii,iv,vdecl,vi]=await Promise.all([
   getApplicableFormVersion(QmsRecordType.RETURN,ref),getApplicableTemplateVersion(QmsRecordType.RETURN,"RETURN_ANNEX_III",ref),
   getApplicableTemplateVersion(QmsRecordType.RETURN,"RETURN_ANNEX_IV",ref),getApplicableTemplateVersion(QmsRecordType.RETURN,"RETURN_ANNEX_V",ref),
   getApplicableTemplateVersion(QmsRecordType.RETURN,"RETURN_ANNEX_VI",ref)
  ]);
  const created=await prisma.$transaction(async tx=>{
   const complaintOrigin=v.fromComplaintId
    ?await getComplaintReturnOrigin(tx,v.fromComplaintId)
    :null;
   const canonicalValues=complaintOrigin
    ?{...v,returnType:"COMPLAINT" as const,relatedDocument:complaintOrigin.complaintBusinessCode}
    :v;
   const communicationYear=v.communicationDate?new Date(v.receivedAt??v.communicationDate).getUTCFullYear():null;
   let businessCode=v.businessCode;
   if(department&&communicationYear&&(v.status!=="DRAFT"||businessCode)){
    businessCode=await assignOperationalBusinessCode(tx,{
     recordType:QmsRecordType.RETURN,
     year:communicationYear,
     departmentCode:department.code,
     requestedCode:businessCode
    });
   }else if(v.status!=="DRAFT"){
    throw new OperationalBusinessCodeError("INVALID_FORMAT","Para abrir la devolución deben estar informados el área y la fecha de comunicación.");
   }else{
    businessCode=null;
   }
   v.businessCode=businessCode;
   const qr=await tx.qmsRecord.create({data:{recordType:"RETURN",businessCode,year:communicationYear}});
   const rec=await tx.returnRecord.create({data:{qmsRecordId:qr.id,...recordData(canonicalValues,department),formVersionId:form?.id,annexIIITemplateVersionId:iii?.id,annexIVTemplateVersionId:iv?.id,annexVTemplateVersionId:vdecl?.id,annexVITemplateVersionId:vi?.id,extraData:extraData(null,v,v.status==="DRAFT"&&complaintOrigin?v.fromComplaintId:null)}});
   await replaceProducts(tx,rec.id,v.products);
   await tx.changeHistory.create({data:{qmsRecordId:qr.id,changedByText:parsed.actor,fieldPath:"__created__",newValue:j({businessCode:v.businessCode,customerEntity:v.customerEntity}),reason:v.status==="DRAFT"?"Borrador inicial de devolución":"Alta de devolución",source:"UI"}});
   if(complaintOrigin&&v.status!=="DRAFT"){
    await registerComplaintReturnOrigin(tx,{
     complaintQmsRecordId:complaintOrigin.complaintQmsRecordId,
     returnQmsRecordId:qr.id,
     actor:parsed.actor
    });
   }
   await planFollowup(tx,rec.id,v,parsed.actor);
   const snap=await getSnapshot(tx,rec.id);await ensureInitialVersion(tx,qr.id,snapshotJson(serializeReturnVersion(snap)),parsed.actor);
   return rec;
  });
  createdId=created.id;
 }catch(e){
  if(e instanceof OperationalBusinessCodeError){
   return preserveFormState(previous,fd,{error:"No se puede guardar la devolución.",fieldErrors:[e.message]});
  }
  if(e instanceof ComplaintReturnLinkError){
   return preserveFormState(previous,fd,{error:"No se puede guardar la devolución.",fieldErrors:[e.message]});
  }
  return preserveFormState(previous,fd,persistenceFormError(e,"la devolución"));
 }
 return {error:null,savedRecordId:createdId};
}
async function updateReturnActionAuthenticatedContent(id:string,previous:ReturnFormState,fd:FormData):Promise<ReturnFormState>{
 const existing=await prisma.returnRecord.findUnique({where:{id},include:{qmsRecord:true,followups:{orderBy:[{followupDate:"desc"},{createdAt:"desc"},{id:"desc"}],take:1}}});if(!existing)return preserveFormState(previous,fd,{error:"La devolución ya no existe."});
 const parsed=parseReturnForm(fd,existing.followups[0]?.nextFollowupDate?.toISOString().slice(0,10));if(parsed.errors.length)return preserveFormState(previous,fd,{error:"No se puede guardar la devolución.",fieldErrors:parsed.errors});
 const v=parsed.values;
 const requestedBusinessCode=v.businessCode;
 const pendingComplaintId=existing.status==="DRAFT"&&existing.extraData&&typeof existing.extraData==="object"&&!Array.isArray(existing.extraData)
  ?(existing.extraData as {pendingComplaintId?:string|null}).pendingComplaintId??null
  :null;

 v.businessCode=existing.qmsRecord.businessCode??requestedBusinessCode;
 if(!keepsOperationalStatus(existing.status,v.status))return preserveFormState(previous,fd,{error:"No se puede volver a borrador una devolución ya operativa.",fieldErrors:["Una devolución abierta o cerrada no puede volver al estado Borrador."]});
 const department=v.departmentId?await prisma.department.findUnique({where:{id:v.departmentId}}):null;
 if((department&&!isReturnDepartmentCode(department.code))||(v.status!=="DRAFT"&&!department))return preserveFormState(previous,fd,{error:"El área seleccionada no es válida para Devoluciones.",fieldErrors:["La codificación de Devoluciones está restringida a LG-00, LG-10, LG-20, LG-30 y LG-40."]});
 try{
 await prisma.$transaction(async tx=>{
  // Relations consistently lock COMPLAINT before RETURN.
  if(pendingComplaintId){const origin=await getComplaintReturnOrigin(tx,pendingComplaintId);await tx.$queryRaw(Prisma.sql`SELECT id FROM "QmsRecord" WHERE id=${origin.complaintQmsRecordId} FOR UPDATE`);v.returnType="COMPLAINT";v.relatedDocument=origin.complaintBusinessCode;}
  await lockReturn(tx,existing.qmsRecordId);
  const before=await getSnapshot(tx,id);
  const becomingOperational=before.status==="DRAFT"&&v.status!=="DRAFT";
  if(!before.qmsRecord.isActive)throw new Error("No se puede modificar una devolución anulada.");
  if(!keepsOperationalStatus(before.status,v.status))throw new Error("Una devolución operativa no puede volver a Borrador.");
  if((before.status!=="DRAFT"||before.qmsRecord.businessCode)&&v.departmentId!==before.departmentId)throw new Error("El área debe conservar la codificación operativa existente.");
  const communicationYear=v.communicationDate?new Date(v.receivedAt??v.communicationDate).getUTCFullYear():null;
  let businessCode=before.qmsRecord.businessCode;
  if(before.status==="DRAFT"&&department&&communicationYear){
   if(!businessCode&&(v.status!=="DRAFT"||requestedBusinessCode)){
    businessCode=await assignOperationalBusinessCode(tx,{recordType:QmsRecordType.RETURN,year:communicationYear,departmentCode:department.code,requestedCode:requestedBusinessCode,excludeQmsRecordId:existing.qmsRecordId});

   }
  }
  v.businessCode=businessCode;
  await tx.qmsRecord.update({where:{id:existing.qmsRecordId},data:{businessCode,year:before.status==="DRAFT"&&!before.qmsRecord.businessCode?communicationYear:before.qmsRecord.year}});
  await tx.returnRecord.update({where:{id},data:{...recordData(v,department,before,fd),extraData:extraData(before.extraData,v,becomingOperational?null:pendingComplaintId)}});const removed=await replaceProducts(tx,id,v.products);
  if(removed.length)await tx.changeHistory.create({data:{qmsRecordId:existing.qmsRecordId,changedByText:parsed.actor,fieldPath:"products.removed",oldValue:j(removed),reason:"Retirada de productos; Review conserva UUID y valor histórico",source:"UI"}});
  await planFollowup(tx,id,v,parsed.actor);
  if(becomingOperational&&pendingComplaintId){
   const complaintOrigin=await getComplaintReturnOrigin(tx,pendingComplaintId);
   await registerComplaintReturnOrigin(tx,{complaintQmsRecordId:complaintOrigin.complaintQmsRecordId,returnQmsRecordId:existing.qmsRecordId,actor:parsed.actor});
  }
  await tx.changeHistory.create({data:{qmsRecordId:existing.qmsRecordId,changedByText:parsed.actor,fieldPath:"__edit__",oldValue:snapshotJson(serializeReturnVersion(before)),newValue:snapshotJson(serializeReturnVersion(await getSnapshot(tx,id))),reason:v.changeReason,source:"UI"}});
  await refreshReturnSnapshot(tx,existing.qmsRecordId);
 });

 }catch(e){
  if(e instanceof OperationalBusinessCodeError)return preserveFormState(previous,fd,{error:"No se puede guardar la devolución.",fieldErrors:[e.message]});
  return preserveFormState(previous,fd,persistenceFormError(e,"la devolución"));
}
 return {error:null,savedRecordId:id};
}
async function addReturnFollowupActionAuthenticatedContent(id:string,_state:FollowupActionState,fd:FormData):Promise<FollowupActionState>{
 const rec=await prisma.returnRecord.findUnique({where:{id}});if(!rec)return{error:"Devolución no encontrada."};
 if(rec.status!=="OPEN")return{error:"La devolución debe estar abierta antes de registrar seguimientos."};
 const followupDate=String(fd.get("followupDate")??""),completedByText=String(fd.get("completedByText")??"").trim(),comment=String(fd.get("comment")??"").trim();
 if(!followupDate||!validReturnDate(followupDate)||!validReturnDate(String(fd.get("nextFollowupDate")??""))||!completedByText||!comment)return{error:"Fecha, responsable y comentario son obligatorios."};
 try{
await prisma.$transaction(async tx=>{
  await lockReturn(tx,rec.qmsRecordId);
  const current=await getSnapshot(tx,id);if(!current.qmsRecord.isActive||current.status!=="OPEN")throw new Error("La devolución debe estar activa y abierta.");
  if(contextFromExtraData(current.extraData).requiresFollowup&&!String(fd.get("nextFollowupDate")??"").trim())throw new Error("La devolución abierta requiere próxima fecha de seguimiento.");
  await tx.returnFollowup.create({data:{returnRecordId:id,followupDate:new Date(followupDate),completedByText,comment,nextFollowupDate:d(String(fd.get("nextFollowupDate")??"")),evidenceReference:String(fd.get("evidenceReference")??"").trim()||null}});
  await tx.changeHistory.create({data:{qmsRecordId:rec.qmsRecordId,changedByText:completedByText,fieldPath:"followups",newValue:j({followupDate,comment}),reason:"Nuevo seguimiento",source:"UI"}});
  await refreshReturnSnapshot(tx,rec.qmsRecordId);
 });

 }catch(e){return persistenceFormError(e,"el seguimiento de la devolución");}
 return{success:"Seguimiento guardado correctamente."};
}

async function unlinkReturnComplaintActionAuthenticatedContent(
 id:string,
 complaintQmsRecordId:string,
 fd:FormData
){
 const actor=String(fd.get("actor")??process.env.DEFAULT_ACTOR_NAME??"Usuario demo").trim();
 const rec=await prisma.returnRecord.findUnique({where:{id},select:{qmsRecordId:true}});
 if(!rec)throw new Error("La devolución no existe.");

 await prisma.$transaction((tx)=>
  deactivateOperationalRelation(tx,{
   currentRecordId:rec.qmsRecordId,
   relatedRecordId:complaintQmsRecordId,
   changedByText:actor,
   reason:"Desvinculación de reclamación de origen"
  })
 );

 revalidatePath("/returns");
 revalidatePath("/complaints");
 revalidatePath(`/returns/${id}`);
}

async function addReturnRelationActionAuthenticatedContent(
 id:string,
 _state:RelationActionState,
 fd:FormData
):Promise<RelationActionState>{
 try{
  const rec=await prisma.returnRecord.findUnique({where:{id},select:{qmsRecordId:true,status:true}});
  if(!rec)return{error:"Devolución no encontrada."};
  if(rec.status==="DRAFT")return{error:"La devolución debe estar abierta antes de vincular una reclamación."};

  const code=String(fd.get("businessCode")??"").trim();
  const actor=String(fd.get("actor")??process.env.DEFAULT_ACTOR_NAME??"Usuario demo").trim();
  const requestedType=String(fd.get("recordType")??"COMPLAINT").trim();
  if(!code)return{error:"Debe indicarse la codificación de la Reclamación de origen."};
  if(requestedType!==QmsRecordType.COMPLAINT){
   return{error:"Una devolución solo puede vincularse con una Reclamación de origen."};
  }

  await prisma.$transaction(async tx=>{
   const selected=String(fd.get("targetRecordId")??"").trim();
   if(selected){
    const complaint=await tx.complaint.findUnique({where:{qmsRecordId:selected},select:{status:true}});
    if(!complaint||complaint.status==="DRAFT")throw new Error("Selecciona una Reclamación operativa.");
    await createQmsRelation(tx,{sourceRecordId:selected,targetRecordId:rec.qmsRecordId,createdByText:actor});
   }else await linkOperationalRelationByBusinessCode(tx,{currentRecordId:rec.qmsRecordId,currentType:QmsRecordType.RETURN,relatedType:QmsRecordType.COMPLAINT,businessCode:code,createdByText:actor});
  });
  revalidatePath("/returns");revalidatePath("/complaints");revalidatePath(`/returns/${id}`);
  return{error:null,success:"Reclamación de origen vinculada correctamente."};
 }catch(error){
  return{error:error instanceof Error?error.message:"No se ha podido vincular la reclamación."};
 }
}

export async function createReturnAction(...args: Parameters<typeof createReturnActionAuthenticatedContent>) {
  return authorizedAction("createReturnAction", args, authenticated => createReturnActionAuthenticatedContent(...authenticated as Parameters<typeof createReturnActionAuthenticatedContent>));
}

export async function updateReturnAction(...args: Parameters<typeof updateReturnActionAuthenticatedContent>) {
  return authorizedAction("updateReturnAction", args, authenticated => updateReturnActionAuthenticatedContent(...authenticated as Parameters<typeof updateReturnActionAuthenticatedContent>));
}

export async function addReturnFollowupAction(...args: Parameters<typeof addReturnFollowupActionAuthenticatedContent>) {
  return authorizedAction("addReturnFollowupAction", args, authenticated => addReturnFollowupActionAuthenticatedContent(...authenticated as Parameters<typeof addReturnFollowupActionAuthenticatedContent>));
}

export async function unlinkReturnComplaintAction(...args: Parameters<typeof unlinkReturnComplaintActionAuthenticatedContent>) {
  return authorizedAction("unlinkReturnComplaintAction", args, authenticated => unlinkReturnComplaintActionAuthenticatedContent(...authenticated as Parameters<typeof unlinkReturnComplaintActionAuthenticatedContent>));
}

export async function addReturnRelationAction(...args: Parameters<typeof addReturnRelationActionAuthenticatedContent>) {
  return authorizedAction("addReturnRelationAction", args, authenticated => addReturnRelationActionAuthenticatedContent(...authenticated as Parameters<typeof addReturnRelationActionAuthenticatedContent>));
}
