import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "./auth-fixtures/browser";
import { type Page } from "playwright";
import { prisma } from "../src/lib/db";
import { createQmsRelation, deactivateQmsRelation } from "../src/lib/qms/relation-service";
import { ensureInitialVersion, serializeComplaintVersion, serializeReturnVersion, snapshotJson, startNextVersion } from "../src/lib/qms/versioning";
import { complaintVersionSource } from "../src/modules/complaints/version-service";
import { getComplaintReturnOrigin, registerComplaintReturnOrigin } from "../src/modules/returns/complaint-origin";
import { returnSnapshotSource, refreshReturnSnapshot } from "../src/modules/returns/snapshot-service";
import { saveReturnProducts } from "../src/modules/returns/product-service";
import { getComplaintList } from "../src/modules/complaints/queries";
import { getReturnList } from "../src/modules/returns/queries";
import type { ReturnProductInput } from "../src/modules/returns/types";

const marker=`R4C-${randomUUID()}`, ids:string[]=[];
const base=process.env.R4C_UI_BASE_URL;
async function view(page:Page,path:string){await page.goto(`${base}${path}`);await page.waitForLoadState("networkidle");}
async function main(){
 if(process.env.APP_ENV!=="test")throw new Error("R4C requiere APP_ENV=test y datos ficticios.");
 const browser=base?await chromium.launch({args:["--no-sandbox"]}):null;
 const page=browser?await browser.newPage({timezoneId:"Europe/Madrid"}):null;
 const errors:string[]=[];page?.on("pageerror",e=>errors.push(e.message));
 try{
  for(const type of ["CUSTOMER","PROVIDER"] as const){
   const cq=await prisma.qmsRecord.create({data:{recordType:"COMPLAINT",businessCode:`${marker}-${type}`,year:2096,complaint:{create:{complaintType:type,status:"OPEN",partyName:marker}}}});ids.push(cq.id);
   const complaint=await prisma.complaint.findUniqueOrThrow({where:{qmsRecordId:cq.id}});
   await prisma.$transaction(async tx=>{await ensureInitialVersion(tx,cq.id,snapshotJson(serializeComplaintVersion(await complaintVersionSource(tx,complaint.id))),"Autor original");});
   const returns=[];
   for(let n=0;n<2;n++){
    const item=await prisma.$transaction(async tx=>{
     const origin=await getComplaintReturnOrigin(tx,complaint.id);
     const rq=await tx.qmsRecord.create({data:{recordType:"RETURN",businessCode:`${marker}-${type}-DEV-${n}`,year:2096,returnRecord:{create:{status:"OPEN",returnType:"COMPLAINT",customerEntity:marker,relatedDocument:origin.complaintBusinessCode}}}});ids.push(rq.id);
     const ret=await tx.returnRecord.findUniqueOrThrow({where:{qmsRecordId:rq.id}});
     const p:ReturnProductInput={departmentId:"",productType:"API",otherProductType:"",productNameCode:`${marker}-${n}`,format:"1 kg",lot:"L",expiryReanalysis:"2097",quantity:"1",unit:"kg",netWeight:"",grossWeight:"",receptionObservations:"",receivedBy:"",receivedByDate:"",verifiedBy:"",verifiedByDate:""};
     await saveReturnProducts(tx,ret.id,[p]);
     const followup=await tx.returnFollowup.create({data:{returnRecordId:ret.id,followupDate:new Date("2096-01-01"),nextFollowupDate:new Date("2096-02-01"),completedByText:"QA",comment:"Seguimiento independiente"}});
     await ensureInitialVersion(tx,rq.id,snapshotJson(serializeReturnVersion(await returnSnapshotSource(tx,ret.id))),"Autor devolución");
     await registerComplaintReturnOrigin(tx,{complaintQmsRecordId:cq.id,returnQmsRecordId:rq.id,actor:"QA"});
     const product=await tx.returnProduct.findFirstOrThrow({where:{returnRecordId:ret.id}});
     return {rq,ret,p,product,followup};
    });returns.push(item);
   }
   const v00=await prisma.qmsRecordVersion.findFirstOrThrow({where:{qmsRecordId:cq.id}});
   const frozen=JSON.stringify(v00.snapshot);
   await prisma.$transaction(async tx=>{await startNextVersion(tx,cq.id,"FOLLOWUP",snapshotJson(serializeComplaintVersion(await complaintVersionSource(tx,complaint.id))),"QA","Seguimiento R4C");});
   const target=returns[0];
   const relation=await prisma.qmsRelation.findFirstOrThrow({where:{sourceRecordId:cq.id,targetRecordId:target.rq.id,isActive:true}});
   await prisma.$transaction(tx=>deactivateQmsRelation(tx,{sourceRecordId:cq.id,targetRecordId:target.rq.id}));
   assert.equal((await getReturnList({q:target.rq.businessCode!,complaint:"YES"})).count,0);
   assert.equal((await getReturnList({q:target.rq.businessCode!,complaint:"NO"})).count,1);
   await prisma.$transaction(tx=>createQmsRelation(tx,{sourceRecordId:cq.id,targetRecordId:target.rq.id}));
   assert.equal((await prisma.qmsRelation.findFirstOrThrow({where:{sourceRecordId:cq.id,targetRecordId:target.rq.id}})).id,relation.id,"reactivar conserva UUID del vínculo");
   assert.equal(await prisma.qmsRelation.count({where:{sourceRecordId:cq.id,isActive:true}}),2);
   assert.equal(await prisma.qmsRelation.count({where:{sourceRecordId:{in:returns.map(x=>x.rq.id)},targetRecordId:cq.id}}),0,"sin filas inversas");
   if(page){
    await view(page,`/complaints/${complaint.id}?tab=relations`);
    await page.getByRole("link",{name:target.rq.businessCode!,exact:true}).click();await page.waitForURL(new RegExp(`/returns/${target.ret.id}`));
    await view(page,`/returns/${target.ret.id}?tab=relations`);
    await page.getByRole("link",{name:cq.businessCode!,exact:true}).click();await page.waitForURL(new RegExp(`/complaints/${complaint.id}`));
    // Both real UI unlink actions and both UUID selection directions.
    for(const fromReturn of [false,true]){
     await view(page,fromReturn?`/returns/${target.ret.id}?tab=relations`:`/complaints/${complaint.id}?tab=relations`);
     const code=fromReturn?cq.businessCode!:target.rq.businessCode!;
     const card=page.locator(".relation-card").filter({has:page.getByRole("link",{name:code,exact:true})});
     await card.getByRole("button",{name:"Desvincular",exact:true}).click();
     await page.getByRole("link",{name:code,exact:true}).waitFor({state:"detached"});
     await page.waitForLoadState("networkidle");
     assert.equal(await prisma.qmsRelation.count({where:{sourceRecordId:cq.id,targetRecordId:target.rq.id,isActive:true}}),0);
     const form=page.locator(".relation-form");if(!fromReturn)await form.locator('[name="recordType"]').selectOption("RETURN");
     await page.waitForLoadState("networkidle");
     await form.locator('[name="businessCode"]').fill(code);// A previous blur timer must not hide suggestions after fast refocus.
     await form.locator('[name="businessCode"]').blur();await form.locator('[name="businessCode"]').focus();
     const suggestionResponse=await page.request.get(`${base}/api/qms/relation-suggestions?${new URLSearchParams({currentRecordId:fromReturn?target.rq.id:cq.id,currentType:fromReturn?"RETURN":"COMPLAINT",relatedType:fromReturn?"COMPLAINT":"RETURN",q:code})}`);
     assert.equal(suggestionResponse.status(),200);const suggestions=await suggestionResponse.json();assert(suggestions.suggestions.some((x:{id:string})=>x.id===(fromReturn?cq.id:target.rq.id)),JSON.stringify(suggestions));
     await page.getByRole("option").filter({hasText:code}).click();
     assert.equal(await form.locator('[name="targetRecordId"]').inputValue(),fromReturn?cq.id:target.rq.id);
     await form.locator('button[type="submit"]').click();await page.locator(".form-success").waitFor();
     await view(page,fromReturn?`/returns/${target.ret.id}?tab=relations`:`/complaints/${complaint.id}?tab=relations`);
     await page.getByRole("link",{name:code,exact:true}).waitFor();
    }
   }
   await prisma.$transaction(async tx=>{
    await tx.complaint.update({where:{id:complaint.id},data:{status:"CLOSED",closedAt:new Date("2096-01-02"),closeActionStatus:"LINKED",closeActionReferences:"Devoluciones bajo seguimiento independiente",closeConclusion:"Cierre R4C"}});
    await startNextVersion(tx,cq.id,"FOLLOWUP",snapshotJson(serializeComplaintVersion(await complaintVersionSource(tx,complaint.id))),"QA","Cierre R4C");
   });
   assert.equal((await getComplaintList({q:cq.businessCode!,returns:"YES"})).rows.length,1);
   assert.equal((await getReturnList({q:cq.businessCode!,complaint:"YES",followup:"PLANNED"})).count,2,"cierre de Reclamación no cierra sus devoluciones");
   for(const item of returns){
    await prisma.$transaction(async tx=>{
     await saveReturnProducts(tx,item.ret.id,[{...item.p,id:item.product.id,quantity:"2"}]);
     await tx.returnRecord.update({where:{id:item.ret.id},data:{status:"CLOSED",decision:"REJECTED",decisionDate:new Date("2096-01-03"),closedAt:new Date("2096-01-03"),finalDestination:"Retorno al cliente",traceabilityUpdated:"YES"}});
     await refreshReturnSnapshot(tx,item.rq.id);
    });
    assert.equal((await prisma.returnProduct.findUniqueOrThrow({where:{id:item.product.id}})).createdAt.toISOString(),item.product.createdAt.toISOString());
    assert.equal((await prisma.returnFollowup.findUniqueOrThrow({where:{id:item.followup.id}})).comment,"Seguimiento independiente");
    const versions=await prisma.qmsRecordVersion.findMany({where:{qmsRecordId:item.rq.id}});assert.equal(versions.length,1);assert.equal(versions[0].sequenceNumber,0);assert.equal(versions[0].createdByText,"Autor devolución");
    const snapshot=versions[0].snapshot as {returnRecord:{products:{id:string}[];followups:{id:string}[];origins:unknown[]}};
    assert.equal(snapshot.returnRecord.products[0].id,item.product.id);assert.equal(snapshot.returnRecord.followups[0].id,item.followup.id);assert.equal(snapshot.returnRecord.origins.length,1);
   }
   assert.equal(JSON.stringify((await prisma.qmsRecordVersion.findUniqueOrThrow({where:{id:v00.id}})).snapshot),frozen);
  }
  assert.deepEqual(errors,[]);
  console.log(`R4C ${page?"PG+UI":"PG"} OK: cliente/proveedor, dos devoluciones, origen canónico, ida/vuelta, desvinculación/revinculación en ambas direcciones, snapshots congelados intactos, cierre independiente, UUID producto/seguimiento, snapshot técnico único y filtros relacionados.`);
 }catch(e){if(page)console.error("R4C UI failure",page.url(),await page.locator("main").ariaSnapshot());throw e;
 }finally{
  await browser?.close();await prisma.qmsRelation.deleteMany({where:{OR:[{sourceRecordId:{in:ids}},{targetRecordId:{in:ids}}]}});await prisma.changeHistory.deleteMany({where:{qmsRecordId:{in:ids}}});await prisma.qmsRecordVersion.deleteMany({where:{qmsRecordId:{in:ids}}});await prisma.returnRecord.deleteMany({where:{qmsRecordId:{in:ids}}});await prisma.complaint.deleteMany({where:{qmsRecordId:{in:ids}}});await prisma.qmsRecord.deleteMany({where:{id:{in:ids}}});
 }
}
main().finally(()=>prisma.$disconnect()).catch(e=>{console.error(e);process.exitCode=1;});
