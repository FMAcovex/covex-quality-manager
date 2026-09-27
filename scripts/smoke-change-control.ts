import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
const prisma=new PrismaClient();
async function main(){
  const dept=await prisma.department.upsert({where:{code:"ZZ-CC"},update:{},create:{code:"ZZ-CC",name:"Smoke Change Control"}});
  const qms=await prisma.qmsRecord.create({data:{recordType:"CHANGE_CONTROL",businessCode:"C/ZZ-CC/999/2099",year:2099}});
  try{
    const change=await prisma.changeControl.create({data:{
      qmsRecordId:qms.id,departmentId:dept.id,departmentCodeSnapshot:dept.code,departmentNameSnapshot:dept.name,
      requestedAt:new Date("2099-01-01"),requesterName:"CI",scopes:["DOCUMENTATION"],description:"Cambio smoke",justification:"CI",
      requestStatus:"ACCEPTED",requestDecisionAt:new Date("2099-01-02"),classification:"MINOR",plannedImplementationAt:new Date("2099-01-15"),
      decisionResult:"APPROVED",decisionAt:new Date("2099-01-02"),executionStatus:"NOT_EXECUTED",effectivenessStatus:"PENDING",status:"OPEN",
      actions:{create:[{description:"Acción",responsible:"CI",plannedExecutionDate:new Date("2099-01-15")}]},
    }});
    const v0=await prisma.qmsRecordVersion.create({data:{qmsRecordId:qms.id,sequenceNumber:0,kind:"INITIAL",snapshot:{status:"initial"},frozenAt:new Date()}});
    const f0=await prisma.changeControlFollowup.create({data:{changeControlId:change.id,sequenceNumber:0,followupDate:new Date("2099-01-10"),responsibleText:"CI",executionStatus:"NOT_EXECUTED",effectivenessStatus:"PENDING",nextFollowupDate:new Date("2099-01-20"),openReason:"Pendiente"}});
    const v1=await prisma.qmsRecordVersion.create({data:{qmsRecordId:qms.id,sequenceNumber:1,kind:"FOLLOWUP",sourceEntityId:f0.id,snapshot:{followup:0},frozenAt:new Date()}});
    const f1=await prisma.changeControlFollowup.create({data:{changeControlId:change.id,sequenceNumber:1,followupDate:new Date("2099-01-20"),responsibleText:"CI",executionStatus:"EXECUTED",executionDate:new Date("2099-01-18"),effectivenessStatus:"ACCEPTABLE",closesChange:true,conclusion:"Correcto"}});
    const v2=await prisma.qmsRecordVersion.create({data:{qmsRecordId:qms.id,sequenceNumber:2,kind:"FOLLOWUP",sourceEntityId:f1.id,snapshot:{followup:1}}});
    assert.equal(v0.sequenceNumber,0);assert.equal(v1.sequenceNumber,1);assert.equal(v2.sequenceNumber,2);
    const followups=await prisma.changeControlFollowup.findMany({where:{changeControlId:change.id},orderBy:{sequenceNumber:"asc"}});
    assert.deepEqual(followups.map((x)=>x.sequenceNumber),[0,1]);
    console.log("Change Control lifecycle PostgreSQL smoke test passed.");
  }finally{
    await prisma.qmsRecordVersion.deleteMany({where:{qmsRecordId:qms.id}});
    await prisma.changeControlFollowup.deleteMany({where:{changeControl:{qmsRecordId:qms.id}}});
    await prisma.changeControlAction.deleteMany({where:{changeControl:{qmsRecordId:qms.id}}});
    await prisma.changeControl.deleteMany({where:{qmsRecordId:qms.id}});await prisma.qmsRecord.delete({where:{id:qms.id}});await prisma.department.delete({where:{id:dept.id}});
  }
}
main().catch((e)=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
