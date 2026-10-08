import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {prisma} from "../src/lib/db";
import {saveReturnProducts} from "../src/modules/returns/product-service";
import {returnSnapshotSource,refreshReturnSnapshot} from "../src/modules/returns/snapshot-service";
import {ensureInitialVersion,snapshotJson,serializeReturnVersion,serializeComplaintVersion,startNextVersion} from "../src/lib/qms/versioning";
import {complaintVersionSource} from "../src/modules/complaints/version-service";
import {createQmsRelation,deactivateQmsRelation} from "../src/lib/qms/relation-service";
import {getReturnList} from "../src/modules/returns/queries";
import type {ReturnProductInput} from "../src/modules/returns/types";
const marker=`R4B-PG-${randomUUID()}`,ids:string[]=[];
async function main(){
 if(process.env.APP_ENV!=="test")throw new Error("R4B requiere BD ficticia APP_ENV=test.");
 try{
  const qr=await prisma.qmsRecord.create({data:{recordType:"RETURN",businessCode:marker,returnRecord:{create:{status:"OPEN",returnType:"COMPLAINT",customerEntity:marker,extraData:{legacy:"preservar"}}}}});ids.push(qr.id);
  const ret=await prisma.returnRecord.findUniqueOrThrow({where:{qmsRecordId:qr.id}});
  const product:ReturnProductInput={departmentId:"",productType:"API",otherProductType:"",productNameCode:"MAT-R4B",format:"1 kg",lot:"L-R4B",expiryReanalysis:"2027",quantity:"1",unit:"kg",netWeight:"",grossWeight:"",receptionObservations:"",receivedBy:"",receivedByDate:"",verifiedBy:"",verifiedByDate:""};
  await prisma.$transaction(async tx=>{await saveReturnProducts(tx,ret.id,[product,{...product,productNameCode:"Otro"}]);await ensureInitialVersion(tx,qr.id,snapshotJson(serializeReturnVersion(await returnSnapshotSource(tx,ret.id))),"Autor original");});
  const original=await prisma.returnProduct.findMany({where:{returnRecordId:ret.id},orderBy:{sortOrder:"asc"}});
  await prisma.$transaction(async tx=>{await saveReturnProducts(tx,ret.id,[{...product,id:original[1].id,quantity:"2"},{...product,id:original[0].id}]);await refreshReturnSnapshot(tx,qr.id);});
  const updated=await prisma.returnProduct.findMany({where:{returnRecordId:ret.id},orderBy:{sortOrder:"asc"}});
  assert.deepEqual(updated.map(x=>x.id),[original[1].id,original[0].id]);assert.equal(updated[0].createdAt.toISOString(),original[1].createdAt.toISOString());
  await assert.rejects(prisma.$transaction(tx=>saveReturnProducts(tx,ret.id,[{...product,id:randomUUID()}])));assert.equal(await prisma.returnProduct.count({where:{returnRecordId:ret.id}}),2);
  await assert.rejects(prisma.$transaction(tx=>saveReturnProducts(tx,ret.id,[{...product,id:original[0].id},{...product,id:original[0].id}])));
  const complaintQms=await prisma.qmsRecord.create({data:{recordType:"COMPLAINT",businessCode:`${marker}-COMPLAINT`,complaint:{create:{complaintType:"CUSTOMER",status:"OPEN"}}}});ids.push(complaintQms.id);
  const complaint=await prisma.complaint.findUniqueOrThrow({where:{qmsRecordId:complaintQms.id}});
  await prisma.$transaction(async tx=>{
   await ensureInitialVersion(tx,complaintQms.id,snapshotJson(serializeComplaintVersion(await complaintVersionSource(tx,complaint.id))),"QA");
   await createQmsRelation(tx,{sourceRecordId:complaintQms.id,targetRecordId:qr.id});
  });
  const snapshot=await prisma.qmsRecordVersion.findFirstOrThrow({where:{qmsRecordId:qr.id}});
  assert.equal(snapshot.createdByText,"Autor original");assert.equal((snapshot.snapshot as {returnRecord:{origins:unknown[];products:{id:string}[]}}).returnRecord.origins.length,1);
  assert.deepEqual((snapshot.snapshot as {returnRecord:{products:{id:string}[]}}).returnRecord.products.map(x=>x.id),updated.map(x=>x.id));
  const complaintV00=await prisma.qmsRecordVersion.findFirstOrThrow({where:{qmsRecordId:complaintQms.id}}),frozen=JSON.stringify(complaintV00.snapshot);
  await prisma.$transaction(async tx=>{await startNextVersion(tx,complaintQms.id,"FOLLOWUP",snapshotJson(serializeComplaintVersion(await complaintVersionSource(tx,complaint.id))),"QA","Seguimiento");await deactivateQmsRelation(tx,{sourceRecordId:complaintQms.id,targetRecordId:qr.id});});
  assert.equal((await prisma.qmsRecordVersion.findFirstOrThrow({where:{qmsRecordId:qr.id}})).createdByText,"Autor original");assert.equal((await prisma.qmsRecordVersion.findFirstOrThrow({where:{qmsRecordId:qr.id}})).snapshot&&((await prisma.qmsRecordVersion.findFirstOrThrow({where:{qmsRecordId:qr.id}})).snapshot as {returnRecord:{origins:unknown[]}}).returnRecord.origins.length,0);
  assert.equal(JSON.stringify((await prisma.qmsRecordVersion.findUniqueOrThrow({where:{id:complaintV00.id}})).snapshot),frozen);
  await prisma.returnFollowup.createMany({data:[{returnRecordId:ret.id,followupDate:new Date("2026-01-01"),completedByText:"QA",comment:"Viejo vencido",nextFollowupDate:new Date("2026-01-02")},{returnRecordId:ret.id,followupDate:new Date("2026-10-08"),completedByText:"QA",comment:"Último vigente",nextFollowupDate:new Date("2094-12-01")}]});
  assert.equal((await getReturnList({q:marker,followup:"DUE"})).count,0);assert.equal((await getReturnList({q:marker,followup:"PLANNED"})).count,1);
  const pageIds=Array.from({length:305},()=>randomUUID());ids.push(...pageIds);
  await prisma.qmsRecord.createMany({data:pageIds.map((id,i)=>({id,recordType:"RETURN",businessCode:`${marker}-PAGE-${i}`,year:2094}))});
  await prisma.returnRecord.createMany({data:pageIds.map(qmsRecordId=>({qmsRecordId,status:"OPEN",returnType:"COMMERCIAL"}))});
  const page=await getReturnList({q:`${marker}-PAGE`,page:"13"});assert.equal(page.count,305);assert.equal(page.rows.length,5);assert.equal(page.page,13);
  assert.equal(await prisma.qmsRecordVersion.count({where:{qmsRecordId:qr.id}}),1);
  console.log("R4B PG OK: UUID de productos estables/reordenación, ajenos/duplicados rechazados con rollback, relación canónica y snapshots de ambos módulos, V00 Reclamación congelado intacto, Return V00 único con autoría original, seguimiento último vigente, paginación SQL 305 registros.");
 }finally{
  await prisma.qmsRelation.deleteMany({where:{OR:[{sourceRecordId:{in:ids}},{targetRecordId:{in:ids}}]}});await prisma.changeHistory.deleteMany({where:{qmsRecordId:{in:ids}}});await prisma.qmsRecordVersion.deleteMany({where:{qmsRecordId:{in:ids}}});await prisma.complaint.deleteMany({where:{qmsRecordId:{in:ids}}});await prisma.returnRecord.deleteMany({where:{qmsRecordId:{in:ids}}});await prisma.qmsRecord.deleteMany({where:{id:{in:ids}}});
 }
}
main().finally(()=>prisma.$disconnect()).catch(e=>{console.error(e);process.exitCode=1;});
