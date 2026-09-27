import assert from "node:assert/strict";
import { PrismaClient,QmsRecordType } from "@prisma/client";
const prisma=new PrismaClient();

async function main(){
 const gc=await prisma.department.findUniqueOrThrow({where:{code:"GC-00"}});
 const lg=await prisma.department.findUniqueOrThrow({where:{code:"LG-30"}});
 const complaintQr=await prisma.qmsRecord.create({data:{recordType:QmsRecordType.COMPLAINT,businessCode:"R/C/SMOKE/2099",year:2099}});
 const returnQr=await prisma.qmsRecord.create({data:{recordType:QmsRecordType.RETURN,businessCode:"DEV/LG-30/SMOKE/2099",year:2099}});
 try{
  const complaint=await prisma.complaint.create({data:{
   qmsRecordId:complaintQr.id,departmentId:gc.id,departmentCodeSnapshot:gc.code,departmentNameSnapshot:gc.name,
   openedAt:new Date("2099-01-02"),createdByText:"CI",complaintType:"CUSTOMER",partyName:"Cliente ficticio",
   reference:"Producto ficticio",lotReference:"L2099",description:"Incidencia ficticia",investigation:"Investigación CI",
   impactAssessment:"Sin impacto adicional",investigationResult:"PROCEDENT",rootCause:"Causa CI",classification:"MINOR",
   resolutionLines:"Gestionar devolución y acción correctiva",resolutionActions:["RETURN","OPEN_CAPA"],effectivenessRequired:true,
   capaPlans:{create:[{actionType:"CORRECTIVE",description:"Acción correctiva CI",responsible:"CI",plannedExecutionDate:new Date("2099-01-20")}]}
  },include:{capaPlans:true}});
  await prisma.complaintFollowup.create({data:{complaintId:complaint.id,followupDate:new Date("2099-01-10"),completedByText:"CI",comment:"Seguimiento CI",nextFollowupDate:new Date("2099-01-20"),evidenceReference:"EV-REC-01"}});
  await prisma.complaint.update({where:{id:complaint.id},data:{responseDate:new Date("2099-01-20"),responseMedium:"Email",responseSummary:"Respuesta recibida",effectivenessStatus:"ACCEPTABLE",effectivenessAssessment:"Conforme",closeConclusion:"Reclamación cerrada",closedAt:new Date("2099-01-25"),status:"CLOSED"}});

  const ret=await prisma.returnRecord.create({data:{
   qmsRecordId:returnQr.id,departmentId:lg.id,departmentCodeSnapshot:lg.code,departmentNameSnapshot:lg.name,
   communicationDate:new Date("2099-01-05"),receivedAt:new Date("2099-01-07"),createdByText:"CI",returnType:"COMPLAINT",
   customerEntity:"Cliente ficticio",country:"España",relatedDocument:"R/C/SMOKE/2099",reasonObservations:"Devolución ficticia",
   withinAcceptedReturnPeriod:"YES",roomTemperatureWithinTenDays:"YES",coldChainWithinFortyEightHours:"NA",
   uniqueIdentifierActive:"YES",tamperEvidenceIntact:"YES",packagingIntegrityOk:"YES",customerDeclarationAvailable:"YES",
   storageTransportConditionsOk:"YES",noUseDamageContamination:"YES",noRecallAlertBlock:"YES",expiryAcceptable:"YES",qcAssessmentCompleted:"NA",
   decision:"ACCEPTED",finalDestination:"Reintegración controlada",qaApprovalName:"QA CI",technicalApprovalName:"DT CI",decisionDate:new Date("2099-01-12"),
   traceabilityUpdated:"YES",closedAt:new Date("2099-01-12"),status:"CLOSED",
   products:{create:[{departmentId:lg.id,productType:"MEDICINE",productNameCode:"Producto CI",format:"30 comprimidos",lot:"L2099",expiryReanalysis:"12/2100",quantity:"2",unit:"estuches",receivedBy:"CI",verifiedBy:"CI",sortOrder:0}]}
  },include:{products:true}});
  await prisma.returnFollowup.create({data:{returnRecordId:ret.id,followupDate:new Date("2099-01-10"),completedByText:"CI",comment:"Recepción evaluada",evidenceReference:"EV-DEV-01"}});
  await prisma.qmsRelation.create({data:{sourceRecordId:complaintQr.id,targetRecordId:returnQr.id,relationType:"GENERATES",createdByText:"CI"}});

  const storedComplaint=await prisma.complaint.findUniqueOrThrow({where:{id:complaint.id},include:{capaPlans:true,followups:true,qmsRecord:{include:{sourceRelations:true}}}});
  const storedReturn=await prisma.returnRecord.findUniqueOrThrow({where:{id:ret.id},include:{products:true,followups:true}});
  assert.equal(storedComplaint.status,"CLOSED");
  assert.equal(storedComplaint.effectivenessStatus,"ACCEPTABLE");
  assert.equal(storedComplaint.capaPlans.length,1);
  assert.equal(storedComplaint.followups.length,1);
  assert.equal(storedComplaint.qmsRecord.sourceRelations.length,1);
  assert.equal(storedReturn.status,"CLOSED");
  assert.equal(storedReturn.decision,"ACCEPTED");
  assert.equal(storedReturn.products.length,1);
  assert.equal(storedReturn.traceabilityUpdated,"YES");
  console.log("Complaints and Returns PostgreSQL smoke test passed.");
 } finally {
  await prisma.qmsRelation.deleteMany({where:{OR:[{sourceRecordId:complaintQr.id},{targetRecordId:complaintQr.id},{sourceRecordId:returnQr.id},{targetRecordId:returnQr.id}]}});
  await prisma.qmsRecordVersion.deleteMany({where:{qmsRecordId:{in:[complaintQr.id,returnQr.id]}}});
  await prisma.complaint.deleteMany({where:{qmsRecordId:complaintQr.id}});
  await prisma.returnRecord.deleteMany({where:{qmsRecordId:returnQr.id}});
  await prisma.qmsRecord.deleteMany({where:{id:{in:[complaintQr.id,returnQr.id]}}});
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
