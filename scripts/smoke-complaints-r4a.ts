import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { createQmsRelation, deactivateQmsRelation } from "../src/lib/qms/relation-service";
import { ensureInitialVersion, serializeComplaintVersion, snapshotJson, startNextVersion, complaintSnapshotVersionFollowupDate } from "../src/lib/qms/versioning";
import { complaintVersionSource, lockComplaintVersion } from "../src/modules/complaints/version-service";
import { getComplaintList } from "../src/modules/complaints/queries";
const marker=`R4A-PG-${randomUUID()}`,ids:string[]=[];
async function main(){
 if(process.env.APP_ENV!=="test")throw new Error("R4A requiere APP_ENV=test y una BD ficticia.");
 try{
  for(const type of ["CUSTOMER","PROVIDER"] as const){
   const qr=await prisma.qmsRecord.create({data:{recordType:"COMPLAINT",businessCode:`${marker}-${type}`,year:2094}});ids.push(qr.id);
   const rec=await prisma.complaint.create({data:{qmsRecordId:qr.id,complaintType:type,status:"OPEN",description:"V00",partIIRequired:null,nextFollowupDate:new Date("2094-10-20")}});
   const capa=await prisma.qmsRecord.create({data:{recordType:"CAPA",businessCode:`${marker}-CAPA-${type}`,capa:{create:{status:"OPEN",actionType:"CORRECTIVE"}}}});
   const ret=await prisma.qmsRecord.create({data:{recordType:"RETURN",businessCode:`${marker}-RETURN-${type}`,returnRecord:{create:{status:"OPEN",returnType:"COMPLAINT"}}}});ids.push(capa.id,ret.id);
   await prisma.$transaction(async tx=>{await ensureInitialVersion(tx,qr.id,snapshotJson(serializeComplaintVersion(await complaintVersionSource(tx,rec.id))),"Autor V00");await createQmsRelation(tx,{sourceRecordId:qr.id,targetRecordId:capa.id,createdByText:"QA"});await createQmsRelation(tx,{sourceRecordId:qr.id,targetRecordId:ret.id,createdByText:"QA"});});
   const v00=await prisma.qmsRecordVersion.findFirstOrThrow({where:{qmsRecordId:qr.id,sequenceNumber:0}}),snap=JSON.stringify(v00.snapshot);
   assert.equal((v00.snapshot as {complaint:{relations:unknown[]}}).complaint.relations.length,2);
   await Promise.all([1,2,3].map(n=>prisma.$transaction(async tx=>{
    await lockComplaintVersion(tx,qr.id);
    await tx.complaint.update({where:{id:rec.id},data:{description:`Seguimiento ${n}`,partIIRequired:true,responseSummary:`Respuesta ${type}`,responseSufficient:true,effectivenessStatus:"ACCEPTABLE",closeActionStatus:"LINKED",closeActionReferences:"Expedientes independientes",closeConclusion:"Cierre controlado",status:"CLOSED",closedAt:new Date("2094-10-10"),nextFollowupDate:null}});
    return startNextVersion(tx,qr.id,"FOLLOWUP",snapshotJson(serializeComplaintVersion(await complaintVersionSource(tx,rec.id),{versionFollowupDate:new Date("2094-10-10")})),`Autor ${n}`,`Motivo ${n}`);
   },{timeout:15000})));
   const versions=await prisma.qmsRecordVersion.findMany({where:{qmsRecordId:qr.id},orderBy:{sequenceNumber:"asc"}});
   assert.deepEqual(versions.map(v=>v.sequenceNumber),[0,1,2,3]);assert.equal(JSON.stringify(versions[0].snapshot),snap);assert.equal(versions[0].createdByText,"Autor V00");assert(versions.slice(0,-1).every(v=>v.frozenAt));
   for(const v of versions.slice(1)){assert.equal(complaintSnapshotVersionFollowupDate(v.snapshot,v.sequenceNumber)?.toISOString().slice(0,10),"2094-10-10");assert.equal((v.snapshot as {complaint:{relations:unknown[];status:string}}).complaint.relations.length,2);assert.equal((v.snapshot as {complaint:{status:string}}).complaint.status,"CLOSED");}
   await prisma.$transaction(tx=>deactivateQmsRelation(tx,{sourceRecordId:qr.id,targetRecordId:ret.id}));
   const current=await prisma.qmsRecordVersion.findUniqueOrThrow({where:{id:versions[3].id}});
   assert.equal((current.snapshot as {complaint:{relations:unknown[]}}).complaint.relations.length,1);assert.equal(JSON.stringify((await prisma.qmsRecordVersion.findUniqueOrThrow({where:{id:v00.id}})).snapshot),snap);assert.equal(complaintSnapshotVersionFollowupDate(current.snapshot,3)?.toISOString().slice(0,10),"2094-10-10");
  }
  const listIds=Array.from({length:305},()=>randomUUID());ids.push(...listIds);
  await prisma.qmsRecord.createMany({data:listIds.map((id,i)=>({id,recordType:"COMPLAINT",businessCode:`${marker}-PAGE-${String(i).padStart(3,"0")}`,year:2094}))});
  await prisma.complaint.createMany({data:listIds.map(qmsRecordId=>({qmsRecordId,complaintType:"CUSTOMER",status:"OPEN",partIIRequired:true,responseSummary:"Respuesta",effectivenessStatus:"PENDING",recurrent:true,nextFollowupDate:new Date("2094-10-20")}))});
  const page=await getComplaintList({q:`${marker}-PAGE`,recurrent:"YES",situation:["EFFECTIVENESS_PENDING"],page:"13"});assert.equal(page.pagination.total,305);assert.equal(page.rows.length,5);assert.equal(page.pagination.pageCount,13);
  const capa=await getComplaintList({q:marker,capa:"YES",returns:"NO"});assert.equal(capa.rows.length,2);
  console.log("R4A PostgreSQL OK: cliente/proveedor, relaciones UUID en snapshots, 3 versiones concurrentes consecutivas, históricos intactos, cierre con expedientes independientes, desvinculación y fecha preservada, filtros SQL/paginación más allá de 300 registros.");
 }finally{
  await prisma.qmsRelation.deleteMany({where:{OR:[{sourceRecordId:{in:ids}},{targetRecordId:{in:ids}}]}});await prisma.qmsRecordVersion.deleteMany({where:{qmsRecordId:{in:ids}}});await prisma.complaint.deleteMany({where:{qmsRecordId:{in:ids}}});await prisma.capa.deleteMany({where:{qmsRecordId:{in:ids}}});await prisma.returnRecord.deleteMany({where:{qmsRecordId:{in:ids}}});await prisma.qmsRecord.deleteMany({where:{id:{in:ids}}});
 }
}
main().finally(()=>prisma.$disconnect()).catch(e=>{console.error(e);process.exitCode=1;});
