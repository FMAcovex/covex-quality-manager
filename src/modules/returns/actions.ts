"use server";

import type { FollowupActionState } from "@/components/basic-followup-form";
import { Prisma,QmsRecordType,QmsRelationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { persistenceFormError } from "@/lib/forms/persistence-error";
import { parseReturnForm } from "@/modules/returns/validation";
import type { ReturnFormState } from "@/modules/returns/types";
import { getApplicableFormVersion,getApplicableTemplateVersion } from "@/modules/configuration/runtime";
import { ensureInitialVersion,refreshCurrentVersion,serializeReturnVersion,snapshotJson } from "@/lib/qms/versioning";
const d=(v:string|null|undefined)=>v?new Date(v):null;
const j=(v:unknown):Prisma.InputJsonValue=>({value:v??null}) as Prisma.InputJsonValue;

async function getSnapshot(tx:Prisma.TransactionClient,id:string){
 return tx.returnRecord.findUniqueOrThrow({where:{id},include:{qmsRecord:true,products:{orderBy:[{sortOrder:"asc"},{createdAt:"asc"}]},followups:{orderBy:[{followupDate:"asc"},{createdAt:"asc"}]},formVersion:true,annexIIITemplateVersion:true,annexIVTemplateVersion:true,annexVTemplateVersion:true,annexVITemplateVersion:true}});
}
type ExistingReturnSnapshot={departmentId:string|null;departmentCodeSnapshot:string|null;departmentNameSnapshot:string|null};
function recordData(v:ReturnType<typeof parseReturnForm>["values"],department:{id:string;code:string;name:string},existing?:ExistingReturnSnapshot){
 return {
  departmentId:department.id,departmentCodeSnapshot:existing?.departmentId===department.id?(existing.departmentCodeSnapshot??department.code):department.code,
  departmentNameSnapshot:existing?.departmentId===department.id?(existing.departmentNameSnapshot??department.name):department.name,
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
export async function createReturnAction(_s:ReturnFormState,fd:FormData):Promise<ReturnFormState>{
 const parsed=parseReturnForm(fd);if(parsed.errors.length)return{error:"No se puede guardar la devolución.",fieldErrors:parsed.errors};
 const v=parsed.values;let createdId:string;
 try{
  const department=await prisma.department.findUnique({where:{id:v.departmentId!}});if(!department)return{error:"El área seleccionada no existe."};
  const ref=d(v.communicationDate)??new Date();
  const [form,iii,iv,vdecl,vi]=await Promise.all([
   getApplicableFormVersion(QmsRecordType.RETURN,ref),getApplicableTemplateVersion(QmsRecordType.RETURN,"RETURN_ANNEX_III",ref),
   getApplicableTemplateVersion(QmsRecordType.RETURN,"RETURN_ANNEX_IV",ref),getApplicableTemplateVersion(QmsRecordType.RETURN,"RETURN_ANNEX_V",ref),
   getApplicableTemplateVersion(QmsRecordType.RETURN,"RETURN_ANNEX_VI",ref)
  ]);
  const created=await prisma.$transaction(async tx=>{
   const qr=await tx.qmsRecord.create({data:{recordType:"RETURN",businessCode:v.businessCode,year:v.communicationDate?new Date(v.communicationDate).getFullYear():null}});
   const rec=await tx.returnRecord.create({data:{qmsRecordId:qr.id,...recordData(v,department),formVersionId:form?.id,annexIIITemplateVersionId:iii?.id,annexIVTemplateVersionId:iv?.id,annexVTemplateVersionId:vdecl?.id,annexVITemplateVersionId:vi?.id}});
   await replaceProducts(tx,rec.id,v.products);
   await tx.changeHistory.create({data:{qmsRecordId:qr.id,changedByText:parsed.actor,fieldPath:"__created__",newValue:j({businessCode:v.businessCode,customerEntity:v.customerEntity}),reason:"Alta de devolución",source:"UI"}});
   if(v.fromComplaintId){
    const complaint=await tx.complaint.findUnique({where:{id:v.fromComplaintId}});
    if(complaint){
     await tx.qmsRelation.upsert({
      where:{sourceRecordId_targetRecordId_relationType:{sourceRecordId:complaint.qmsRecordId,targetRecordId:qr.id,relationType:"GENERATES"}},
      update:{isActive:true,createdByText:parsed.actor,notes:"Devolución creada desde la reclamación."},
      create:{sourceRecordId:complaint.qmsRecordId,targetRecordId:qr.id,relationType:"GENERATES",createdByText:parsed.actor,notes:"Devolución creada desde la reclamación."}
     });
    }
   }
   const snap=await getSnapshot(tx,rec.id);await ensureInitialVersion(tx,qr.id,snapshotJson(serializeReturnVersion(snap)),parsed.actor);
   return rec;
  });
  createdId=created.id;
 }catch(e){return persistenceFormError(e,"la devolución");}
 revalidatePath("/returns");revalidatePath("/complaints");redirect(`/returns/${createdId}`);
}
export async function updateReturnAction(id:string,_s:ReturnFormState,fd:FormData):Promise<ReturnFormState>{
 const parsed=parseReturnForm(fd);if(parsed.errors.length)return{error:"No se puede guardar la devolución.",fieldErrors:parsed.errors};
 const v=parsed.values,existing=await prisma.returnRecord.findUnique({where:{id},include:{qmsRecord:true}});if(!existing)return{error:"La devolución ya no existe."};
 const department=await prisma.department.findUnique({where:{id:v.departmentId!}});if(!department)return{error:"El área seleccionada no existe."};
 await prisma.$transaction(async tx=>{
  await tx.qmsRecord.update({where:{id:existing.qmsRecordId},data:{businessCode:v.businessCode,year:v.communicationDate?new Date(v.communicationDate).getFullYear():null}});
  await tx.returnRecord.update({where:{id},data:recordData(v,department,existing)});await replaceProducts(tx,id,v.products);
  await tx.changeHistory.create({data:{qmsRecordId:existing.qmsRecordId,changedByText:parsed.actor,fieldPath:"__edit__",oldValue:j({updatedAt:existing.updatedAt}),newValue:j({businessCode:v.businessCode,status:v.status}),reason:v.changeReason,source:"UI"}});
  const snap=await getSnapshot(tx,id);await refreshCurrentVersion(tx,existing.qmsRecordId,snapshotJson(serializeReturnVersion(snap)),parsed.actor,v.changeReason);
 });
 revalidatePath("/returns");revalidatePath(`/returns/${id}`);redirect(`/returns/${id}`);
}
export async function addReturnFollowupAction(id:string,_state:FollowupActionState,fd:FormData):Promise<FollowupActionState>{
 const rec=await prisma.returnRecord.findUnique({where:{id}});if(!rec)return{error:"Devolución no encontrada."};
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
export async function addReturnRelationAction(id:string,fd:FormData){
 const rec=await prisma.returnRecord.findUnique({where:{id}});if(!rec)throw new Error("Devolución no encontrada.");
 const code=String(fd.get("businessCode")??"").trim(),rawType=String(fd.get("relationType")??"RELATED_TO"),actor=String(fd.get("actor")??process.env.DEFAULT_ACTOR_NAME??"Usuario demo");
 const allowed=new Set(Object.values(QmsRelationType));if(!allowed.has(rawType as QmsRelationType))throw new Error("Tipo de relación no válido.");const type=rawType as QmsRelationType;
 const target=await prisma.qmsRecord.findFirst({where:{businessCode:code,id:{not:rec.qmsRecordId}}});if(!target)throw new Error("No existe un expediente con esa codificación.");
 await prisma.qmsRelation.upsert({where:{sourceRecordId_targetRecordId_relationType:{sourceRecordId:rec.qmsRecordId,targetRecordId:target.id,relationType:type}},update:{isActive:true,createdByText:actor},create:{sourceRecordId:rec.qmsRecordId,targetRecordId:target.id,relationType:type,createdByText:actor}});
 revalidatePath(`/returns/${id}`);
}
