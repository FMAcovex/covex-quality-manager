"use server";

import type { FollowupActionState } from "@/components/basic-followup-form";
import { Prisma,QmsRecordType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { persistenceFormError } from "@/lib/forms/persistence-error";
import { preserveFormState } from "@/lib/forms/preserved-state";
import {
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
import { ensureInitialVersion,refreshCurrentVersion,serializeReturnVersion,snapshotJson } from "@/lib/qms/versioning";
const d=(v:string|null|undefined)=>v?new Date(v):null;
const j=(v:unknown):Prisma.InputJsonValue=>({value:v??null}) as Prisma.InputJsonValue;

async function getSnapshot(tx:Prisma.TransactionClient,id:string){
 return tx.returnRecord.findUniqueOrThrow({where:{id},include:{qmsRecord:true,products:{orderBy:[{sortOrder:"asc"},{createdAt:"asc"}]},followups:{orderBy:[{followupDate:"asc"},{createdAt:"asc"}]},formVersion:true,annexIIITemplateVersion:true,annexIVTemplateVersion:true,annexVTemplateVersion:true,annexVITemplateVersion:true}});
}
type ExistingReturnSnapshot={departmentId:string|null;departmentCodeSnapshot:string|null;departmentNameSnapshot:string|null};
function recordData(v:ReturnType<typeof parseReturnForm>["values"],department:{id:string;code:string;name:string}|null,existing?:ExistingReturnSnapshot){
 return {
  departmentId:department?.id??null,departmentCodeSnapshot:department?(existing?.departmentId===department.id?(existing.departmentCodeSnapshot??department.code):department.code):null,
  departmentNameSnapshot:department?(existing?.departmentId===department.id?(existing.departmentNameSnapshot??department.name):department.name):null,
  communicationDate:d(v.communicationDate),receivedAt:d(v.receivedAt),createdByText:v.createdByText,returnType:v.returnType!,otherReturnType:v.otherReturnType,
  customerEntity:v.customerEntity,country:v.country,address:v.address,relatedDocument:v.relatedDocument,conservationConditions:v.conservationConditions,
  deliveryNote:v.deliveryNote,reasonObservations:v.reasonObservations,attachedDocumentation:v.attachedDocumentation,
  withinAcceptedReturnPeriod:v.withinAcceptedReturnPeriod,roomTemperatureWithinTenDays:v.roomTemperatureWithinTenDays,coldChainWithinFortyEightHours:v.coldChainWithinFortyEightHours,
  uniqueIdentifierActive:v.uniqueIdentifierActive,tamperEvidenceIntact:v.tamperEvidenceIntact,packagingIntegrityOk:v.packagingIntegrityOk,
  customerDeclarationAvailable:v.customerDeclarationAvailable,customerDeclarationSignatoryName:v.customerDeclarationSignatoryName,
  customerDeclarationSignatoryRole:v.customerDeclarationSignatoryRole,customerDeclarationSignedAt:d(v.customerDeclarationSignedAt),
  customerDeclarationObservations:v.customerDeclarationObservations,storageTransportConditionsOk:v.storageTransportConditionsOk,noUseDamageContamination:v.noUseDamageContamination,
  noRecallAlertBlock:v.noRecallAlertBlock,expiryAcceptable:v.expiryAcceptable,qcAssessmentCompleted:v.qcAssessmentCompleted,storageTemperatureRecord:v.storageTemperatureRecord,
  returnTransportTempEvidence:v.returnTransportTempEvidence,transportPackagingSuitable:v.transportPackagingSuitable,receiptTemperatureAcceptable:v.receiptTemperatureAcceptable,
  temperatureExcursionEvaluated:v.temperatureExcursionEvaluated,coldChainReturnSystemValidated:v.coldChainReturnSystemValidated,decision:v.decision,
  finalDestination:v.finalDestination,decisionObservations:v.decisionObservations,qaApprovalName:v.qaApprovalName,technicalApprovalName:v.technicalApprovalName,decisionDate:d(v.decisionDate),
  destructionManagedBy:v.destructionManagedBy,destructionCertificate:v.destructionCertificate,traceabilityUpdated:v.traceabilityUpdated,
  closedAt:d(v.closedAt),status:v.status,internalObservations:v.internalObservations,signedDocumentAvailable:v.signedDocumentAvailable,dataQualityStatus:v.dataQualityStatus
 };
}
async function replaceProducts(tx:Prisma.TransactionClient,id:string,products:ReturnType<typeof parseReturnForm>["values"]["products"]){
 await tx.returnProduct.deleteMany({where:{returnRecordId:id}});
 for(let i=0;i<products.length;i++){
  const p=products[i];let department=null;
  if(p.departmentId)department=await tx.department.findUnique({where:{id:p.departmentId}});
  await tx.returnProduct.create({data:{returnRecordId:id,departmentId:department?.id??null,productType:p.productType,otherProductType:p.otherProductType||null,productNameCode:p.productNameCode,
   format:p.format||null,lot:p.lot||null,expiryReanalysis:p.expiryReanalysis||null,quantity:p.quantity||null,unit:p.unit||null,netWeight:p.netWeight||null,grossWeight:p.grossWeight||null,
   receptionObservations:p.receptionObservations||null,receivedBy:p.receivedBy||null,receivedByDate:d(p.receivedByDate),verifiedBy:p.verifiedBy||null,verifiedByDate:d(p.verifiedByDate),sortOrder:i}});
 }
}
export async function createReturnAction(previous:ReturnFormState,fd:FormData):Promise<ReturnFormState>{
 const parsed=parseReturnForm(fd);if(parsed.errors.length)return preserveFormState(previous,fd,{error:"No se puede guardar la devolución.",fieldErrors:parsed.errors});
 const v=parsed.values;let createdId:string;
 try{
  const department=v.departmentId?await prisma.department.findUnique({where:{id:v.departmentId}}):null;
  if(v.status!=="DRAFT"&&!department)return preserveFormState(previous,fd,{error:"El área seleccionada no existe."});
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
   const communicationYear=v.communicationDate?new Date(v.communicationDate).getFullYear():null;
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
   const rec=await tx.returnRecord.create({data:{qmsRecordId:qr.id,...recordData(canonicalValues,department),formVersionId:form?.id,annexIIITemplateVersionId:iii?.id,annexIVTemplateVersionId:iv?.id,annexVTemplateVersionId:vdecl?.id,annexVITemplateVersionId:vi?.id}});
   await replaceProducts(tx,rec.id,v.products);
   await tx.changeHistory.create({data:{qmsRecordId:qr.id,changedByText:parsed.actor,fieldPath:"__created__",newValue:j({businessCode:v.businessCode,customerEntity:v.customerEntity}),reason:v.status==="DRAFT"?"Borrador inicial de devolución":"Alta de devolución",source:"UI"}});
   if(complaintOrigin&&v.status!=="DRAFT"){
    await registerComplaintReturnOrigin(tx,{
     complaintQmsRecordId:complaintOrigin.complaintQmsRecordId,
     returnQmsRecordId:qr.id,
     actor:parsed.actor
    });
   }
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
 revalidatePath("/returns");revalidatePath("/complaints");redirect(`/returns/${createdId}`);
}
export async function updateReturnAction(id:string,previous:ReturnFormState,fd:FormData):Promise<ReturnFormState>{
 const parsed=parseReturnForm(fd);if(parsed.errors.length)return preserveFormState(previous,fd,{error:"No se puede guardar la devolución.",fieldErrors:parsed.errors});
 const v=parsed.values,existing=await prisma.returnRecord.findUnique({where:{id},include:{qmsRecord:true}});if(!existing)return preserveFormState(previous,fd,{error:"La devolución ya no existe."});
 const requestedBusinessCode=v.businessCode;
 v.businessCode=existing.qmsRecord.businessCode??requestedBusinessCode;
 if(existing.status!=="DRAFT"&&v.status==="DRAFT")return preserveFormState(previous,fd,{error:"No se puede volver a borrador una devolución ya operativa.",fieldErrors:["Una devolución abierta o cerrada no puede volver al estado Borrador."]});
 const department=v.departmentId?await prisma.department.findUnique({where:{id:v.departmentId}}):null;
 if(v.status!=="DRAFT"&&!department)return preserveFormState(previous,fd,{error:"El área seleccionada no existe."});
 try{
 await prisma.$transaction(async tx=>{
  const communicationYear=v.communicationDate?new Date(v.communicationDate).getFullYear():null;
  let businessCode=existing.qmsRecord.businessCode;
  if(existing.status==="DRAFT"&&department&&communicationYear){
   if(!businessCode&&(v.status!=="DRAFT"||requestedBusinessCode)){
    businessCode=await assignOperationalBusinessCode(tx,{recordType:QmsRecordType.RETURN,year:communicationYear,departmentCode:department.code,requestedCode:requestedBusinessCode,excludeQmsRecordId:existing.qmsRecordId});
   }else if(businessCode&&requestedBusinessCode&&requestedBusinessCode!==businessCode){
    businessCode=await assignOperationalBusinessCode(tx,{recordType:QmsRecordType.RETURN,year:communicationYear,departmentCode:department.code,requestedCode:requestedBusinessCode,excludeQmsRecordId:existing.qmsRecordId});
   }
  }
  v.businessCode=businessCode;
  await tx.qmsRecord.update({where:{id:existing.qmsRecordId},data:{businessCode,year:communicationYear}});
  await tx.returnRecord.update({where:{id},data:recordData(v,department,existing)});await replaceProducts(tx,id,v.products);
  await tx.changeHistory.create({data:{qmsRecordId:existing.qmsRecordId,changedByText:parsed.actor,fieldPath:"__edit__",oldValue:j({updatedAt:existing.updatedAt}),newValue:j({businessCode:v.businessCode,status:v.status}),reason:v.changeReason,source:"UI"}});
  const snap=await getSnapshot(tx,id);await refreshCurrentVersion(tx,existing.qmsRecordId,snapshotJson(serializeReturnVersion(snap)),parsed.actor,v.changeReason);
 });

 }catch(e){
  if(e instanceof OperationalBusinessCodeError)return preserveFormState(previous,fd,{error:"No se puede guardar la devolución.",fieldErrors:[e.message]});
  return preserveFormState(previous,fd,persistenceFormError(e,"la devolución"));
}
 revalidatePath("/returns");revalidatePath(`/returns/${id}`);redirect(`/returns/${id}`);
}
export async function addReturnFollowupAction(id:string,_state:FollowupActionState,fd:FormData):Promise<FollowupActionState>{
 const rec=await prisma.returnRecord.findUnique({where:{id}});if(!rec)return{error:"Devolución no encontrada."};
 if(rec.status==="DRAFT")return{error:"La devolución debe estar abierta antes de registrar seguimientos."};
 const followupDate=String(fd.get("followupDate")??""),completedByText=String(fd.get("completedByText")??"").trim(),comment=String(fd.get("comment")??"").trim();
 if(!followupDate||!completedByText||!comment)return{error:"Fecha, responsable y comentario son obligatorios."};
 try{
await prisma.$transaction(async tx=>{
  await tx.returnFollowup.create({data:{returnRecordId:id,followupDate:new Date(followupDate),completedByText,comment,nextFollowupDate:d(String(fd.get("nextFollowupDate")??"")),evidenceReference:String(fd.get("evidenceReference")??"").trim()||null}});
  await tx.changeHistory.create({data:{qmsRecordId:rec.qmsRecordId,changedByText:completedByText,fieldPath:"followups",newValue:j({followupDate,comment}),reason:"Nuevo seguimiento",source:"UI"}});
  const snap=await getSnapshot(tx,id);await refreshCurrentVersion(tx,rec.qmsRecordId,snapshotJson(serializeReturnVersion(snap)),completedByText,"Nuevo seguimiento");
 });

 }catch(e){return persistenceFormError(e,"el seguimiento de la devolución");}
 revalidatePath(`/returns/${id}`);return{success:"Seguimiento guardado correctamente."};
}

export async function unlinkReturnComplaintAction(
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

export async function addReturnRelationAction(
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

  await linkOperationalRelationByBusinessCode(prisma,{
   currentRecordId:rec.qmsRecordId,
   currentType:QmsRecordType.RETURN,
   relatedType:QmsRecordType.COMPLAINT,
   businessCode:code,
   createdByText:actor
  });
  revalidatePath("/returns");revalidatePath("/complaints");revalidatePath(`/returns/${id}`);
  return{error:null,success:"Reclamación de origen vinculada correctamente."};
 }catch(error){
  return{error:error instanceof Error?error.message:"No se ha podido vincular la reclamación."};
 }
}
