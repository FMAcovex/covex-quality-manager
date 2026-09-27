import assert from "node:assert/strict";
import { PrismaClient,QmsRecordType } from "@prisma/client";
const prisma=new PrismaClient();

async function main(){
  const dept=await prisma.department.findUniqueOrThrow({where:{code:"GC-00"}});
  const devRecord=await prisma.qmsRecord.create({data:{recordType:QmsRecordType.DEVIATION,businessCode:"D/CAPA-SMOKE/001/2099",year:2099}});
  await prisma.deviation.create({data:{
    qmsRecordId:devRecord.id,departmentId:dept.id,departmentCodeSnapshot:dept.code,departmentNameSnapshot:dept.name,
    issueDate:new Date("2099-01-01"),whatHappened:"Desviación ficticia origen de CAPA",createdByText:"CI",
  }});
  const capaRecord=await prisma.qmsRecord.create({data:{recordType:QmsRecordType.CAPA,businessCode:"AC/CAPA-SMOKE/001/2099",year:2099}});
  const capa=await prisma.capa.create({data:{
    qmsRecordId:capaRecord.id,actionType:"CORRECTIVE",departmentId:dept.id,departmentCodeSnapshot:dept.code,departmentNameSnapshot:dept.name,
    openedAt:new Date("2099-01-02"),createdByText:"CI",originType:"Desviación",originCode:"D/CAPA-SMOKE/001/2099",
    defectDescription:"Defecto ficticio",rootCause:"Causa ficticia sustentada",
    plannedActions:{create:[{description:"Implantar control ficticio",responsible:"CI",plannedExecutionDate:new Date("2099-01-15")}]},
  }});
  await prisma.capaFollowup.create({data:{
    capaId:capa.id,sequenceNumber:1,followupDate:new Date("2099-01-14"),completedByText:"CI",
    reason:"Seguimiento programado",description:"Control implantado",evidenceReference:"EV-CI-001",
  }});
  await prisma.qmsRelation.create({data:{sourceRecordId:devRecord.id,targetRecordId:capaRecord.id,relationType:"GENERATES",createdByText:"CI"}});
  await prisma.capa.update({where:{id:capa.id},data:{
    status:"CLOSED",operationalClosedAt:new Date("2099-01-14"),conclusion:"Acción ejecutada con evidencia.",
    effectivenessStatus:"CONFORMING",effectivenessCriteria:"Sin recurrencia",effectivenessAssessment:"Conforme",
    effectivenessEvidence:"EV-CI-002",effectiveClosedAt:new Date("2099-02-14"),
  }});
  const stored=await prisma.capa.findUniqueOrThrow({where:{id:capa.id},include:{plannedActions:true,followups:true,qmsRecord:{include:{targetRelations:true}}}});
  assert.equal(stored.status,"CLOSED");
  assert.equal(stored.effectivenessStatus,"CONFORMING");
  assert.equal(stored.plannedActions.length,1);
  assert.equal(stored.followups[0].evidenceReference,"EV-CI-001");
  assert.equal(stored.qmsRecord.targetRelations.length,1);
  console.log("CAPA lifecycle PostgreSQL smoke test passed.");
}
main().catch((e)=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
