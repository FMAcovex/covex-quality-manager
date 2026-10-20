import { purgeLegacyFixtureDocuments } from "./audit-fixtures/legacy-cleanup";
import {Prisma} from "@prisma/client";
import assert from "node:assert/strict";
import {createHash,randomUUID} from "node:crypto";
import { chromium } from "./auth-fixtures/browser";
import { type Page } from "playwright";
import {ensureInitialVersion,serializeComplaintVersion,snapshotJson} from "../src/lib/qms/versioning";
import {complaintVersionSource} from "../src/modules/complaints/version-service";
import {prisma} from "../src/lib/db";
import {readZip,getZipEntryText} from "../src/lib/ooxml/zip";
import {syntheticReturnDoc,syntheticReturnXlsx} from "./returns-r4b-doc-fixtures";
import {generalReturnChecks,coldReturnChecks} from "../src/modules/returns/rules";
const base=process.env.R4B_UI_BASE_URL,marker=`R4B-UI-${randomUUID()}`,ids:string[]=[];
async function view(page:Page,path:string){await page.goto(`${base}${path}`);await page.waitForLoadState("networkidle");}
async function save(page:Page,label:string){await page.getByRole("button",{name:label,exact:true}).click();await page.waitForURL(/\/returns\/[a-f0-9-]+$/,{timeout:30000});await page.waitForLoadState("networkidle");}
async function main(){
 if(process.env.APP_ENV!=="test"||!base)throw new Error("APP_ENV=test y R4B_UI_BASE_URL obligatorios.");
 const backups:Array<{id:string;data:Prisma.TemplateVersionUpdateInput}>=[];
 const browser=await chromium.launch({args:["--no-sandbox"]});const page=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:"Europe/Madrid"}),errors:string[]=[];
 const pendingRequests=new Map<string,string>();page.on("request",r=>pendingRequests.set(r.url(),r.method()));page.on("requestfinished",r=>pendingRequests.delete(r.url()));page.on("requestfailed",r=>pendingRequests.delete(r.url()));
 page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error"&&/hydrat|server rendered/i.test(m.text()))errors.push(m.text());});
 try{
  if(process.env.R4B_OFFICIAL_TEMPLATES!=="1")for(const annex of ["III","IV","V","VI"] as const){
   const t=await prisma.templateVersion.findUniqueOrThrow({where:{module_documentType_versionCode:{module:"RETURN",documentType:`RETURN_ANNEX_${annex}`,versionCode:"03"}},omit:{fileData:false}});
   if(t.fileData||t.filePath)throw new Error("Usa R4B_OFFICIAL_TEMPLATES=1 para fuentes oficiales instaladas.");
   backups.push({id:t.id,data:{fileData:t.fileData,fileName:t.fileName,fileSize:t.fileSize,checksum:t.checksum,filePath:t.filePath}});
   const bytes=annex==="VI"?syntheticReturnXlsx():syntheticReturnDoc(annex);
   await prisma.templateVersion.update({where:{id:t.id},data:{fileData:new Uint8Array(bytes),fileName:`TEST-R4B-${annex}.${annex==="VI"?"xlsx":"docx"}`,fileSize:bytes.length,checksum:createHash("sha256").update(bytes).digest("hex")}});
  }
  const lg=await prisma.department.findUniqueOrThrow({where:{code:"LG-20"}});
  const origin=await prisma.qmsRecord.create({data:{recordType:"COMPLAINT",businessCode:`R4B-${marker}`,year:2095,complaint:{create:{status:"OPEN",complaintType:"CUSTOMER",partyName:marker}}}});ids.push(origin.id);
  const originComplaint=await prisma.complaint.findUniqueOrThrow({where:{qmsRecordId:origin.id}});await prisma.$transaction(async tx=>{await ensureInitialVersion(tx,origin.id,snapshotJson(serializeComplaintVersion(await complaintVersionSource(tx,originComplaint.id))),"QA ficticio");});
  let previousArchiveId:string|undefined;
  for(const medicine of [false,true]){
   const tag=`${marker}-${medicine?"MED":"API"}`;
   await view(page,medicine?"/returns/new":`/returns/new?fromComplaintId=${originComplaint.id}`);await page.locator('[name="customerEntity"]').fill(tag);await save(page,"Guardar borrador");
   const draft=await prisma.returnRecord.findFirstOrThrow({where:{customerEntity:tag}});ids.push(draft.qmsRecordId);assert.equal(draft.status,"DRAFT");if(!medicine)assert.equal(await prisma.qmsRelation.count({where:{sourceRecordId:origin.id,targetRecordId:draft.qmsRecordId}}),0);assert.equal((await page.request.get(`${base}/api/returns/${draft.id}/annex-iii`)).status(),409);
   await view(page,`/returns/${draft.id}/edit`);
   for(const [name,value] of Object.entries({communicationDate:"2094-12-31",receivedAt:"2095-01-02",createdByText:"QA ficticio",country:"España",address:"Dirección ficticia",conservationConditions:medicine?"Cadena de frío +2/+8 ºC":"Temperatura ambiente",reasonObservations:"Investigación pendiente",attachedDocumentation:"Albarán ficticio",nextFollowupDate:"2095-01-10",followupComment:"Plan de evaluación"}))await page.locator(`[name="${name}"]`).fill(value);
   await page.locator('[name="departmentId"]').selectOption(lg.id);if(medicine)await page.locator('[name="returnType"]').selectOption("COMMERCIAL");else{assert.equal(await page.locator('[name="returnType"]').inputValue(),"COMPLAINT");assert.equal(await page.locator('[name="relatedDocument"]').inputValue(),origin.businessCode);}await page.locator('[name="requiresFollowup"]').check();
   const card=page.locator(".return-product-card").first();await card.getByRole("combobox",{name:/^Tipo de producto/}).selectOption(medicine?"MEDICINE":"API");
   for(const [label,value] of Object.entries({"Producto / código":tag,"Formato":"Caja","Lote":"LOT-R4B","Caducidad / reanálisis":"12/2096","Cantidad":"2"}))await card.getByLabel(label).fill(value);
   if(!medicine){await page.getByRole("button",{name:"+ Añadir producto",exact:true}).click();const second=page.locator(".return-product-card").nth(1);for(const [label,value] of Object.entries({"Producto / código":"API-SEGUNDO","Formato":"1 kg","Lote":"LOT-2","Caducidad / reanálisis":"12/2096","Cantidad":"1"}))await second.getByLabel(label).fill(value);}
   else await page.locator('[name="serializedMedicine"]').check();
   await page.locator('[name="status"]').selectOption("OPEN");assert.equal(await page.locator('[name="storageTemperatureRecord"]').isVisible(),medicine);await save(page,"Guardar cambios");
   const opened=await prisma.returnRecord.findUniqueOrThrow({where:{id:draft.id},include:{qmsRecord:true,products:{orderBy:{sortOrder:"asc"}},followups:true}});
   assert.equal(opened.status,"OPEN");assert.match(opened.qmsRecord.businessCode!,/^DEV\/LG-20\/\d+\/2095$/);assert.equal(opened.followups[0].nextFollowupDate?.toISOString().slice(0,10),"2095-01-10");const productIds=opened.products.map(x=>x.id);
   // UUID lookup establishes only COMPLAINT→RETURN.
   if(medicine){
   await view(page,`/returns/${draft.id}?tab=relations`);const relationForm=page.locator(".relation-form");await relationForm.locator('[name="businessCode"]').fill(origin.businessCode!);await page.getByRole("option").filter({hasText:origin.businessCode!}).click();assert.equal(await relationForm.locator('[name="targetRecordId"]').inputValue(),origin.id);await relationForm.getByRole("button").last().click();await page.locator(".form-success").waitFor();
   }else{
    await view(page,`/returns/${draft.id}?tab=relations`);await page.getByRole("link",{name:origin.businessCode!,exact:true}).waitFor();
    await view(page,`/complaints/${originComplaint.id}?tab=relations`);await page.getByRole("link",{name:opened.qmsRecord.businessCode!,exact:true}).waitFor();
    const originSnapshot=await prisma.qmsRecordVersion.findFirstOrThrow({where:{qmsRecordId:origin.id}});assert.equal((originSnapshot.snapshot as {complaint:{relations:unknown[]}}).complaint.relations.length,1);
   }
   assert.equal(await prisma.qmsRelation.count({where:{sourceRecordId:origin.id,targetRecordId:draft.qmsRecordId,isActive:true}}),1);assert.equal(await prisma.qmsRelation.count({where:{sourceRecordId:draft.qmsRecordId,targetRecordId:origin.id}}),0);
   await view(page,`/returns/${draft.id}?tab=followups`);const followup=page.locator(".followup-form");assert.equal(await followup.locator('[name="nextFollowupDate"]').getAttribute("required"),"");
   await followup.locator('[name="followupDate"]').fill(new Date().toISOString().slice(0,10));await followup.locator('[name="completedByText"]').fill("QA seguimiento");await followup.locator('[name="comment"]').fill(`Seguimiento ${tag}`);await followup.locator('[name="nextFollowupDate"]').fill("2095-01-12");await followup.locator('[name="evidenceReference"]').fill("Evidencia ficticia");await followup.getByRole("button",{name:"Guardar seguimiento",exact:true}).click();await page.getByText(`Seguimiento ${tag}`,{exact:true}).waitFor();
   const recordedFollowup=await prisma.returnFollowup.findFirstOrThrow({where:{returnRecordId:draft.id,comment:`Seguimiento ${tag}`}});assert.equal(recordedFollowup.nextFollowupDate?.toISOString().slice(0,10),"2095-01-12");
   await view(page,`/returns/${draft.id}?tab=followups&review=1`);await page.locator(`#review-return-followup-${recordedFollowup.id} .review-marker`).click();const followupDrawer=page.locator(".review-drawer");await followupDrawer.locator(".review-form textarea").last().fill(`Review seguimiento ${tag}`);await followupDrawer.getByRole("button",{name:"Crear observación",exact:true}).click();await followupDrawer.locator(".review-thread-card").filter({hasText:`Review seguimiento ${tag}`}).waitFor();await page.getByRole("button",{name:"Cerrar",exact:true}).click();
   const followupThread=await prisma.reviewThread.findFirstOrThrow({where:{qmsRecordId:draft.qmsRecordId,targetEntityId:recordedFollowup.id}});assert.equal(followupThread.recordVersionId,null);assert.equal(followupThread.targetEntityType,"ReturnFollowup");
   // Review links to a stable product UUID, without a functional version.
   await view(page,`/returns/${draft.id}?tab=summary&review=1`);await page.locator(`#review-return-product-${productIds[0]} .review-marker`).click();const drawer=page.locator(".review-drawer");await drawer.locator(".review-form textarea").last().fill(`Review ${tag}`);await drawer.getByRole("button",{name:"Crear observación",exact:true}).click();await drawer.locator(".review-thread-card").filter({hasText:`Review ${tag}`}).waitFor();await page.getByRole("button",{name:"Cerrar",exact:true}).click();
   const thread=await prisma.reviewThread.findFirstOrThrow({where:{qmsRecordId:draft.qmsRecordId,targetEntityId:productIds[0]}});assert.equal(thread.recordVersionId,null);assert.equal(thread.targetEntityId,productIds[0]);
   // Conditional release gate rejects an explicit nonconformity and preserves edits.
   await view(page,`/returns/${draft.id}/edit`);await page.locator('[name="destinationKind"]').selectOption(medicine?"SELLABLE_STOCK":"CONFORMING_STOCK");await page.locator('[name="finalDestination"]').fill("Reincorporación autorizada");await page.locator('[name="decision"]').selectOption("ACCEPTED");await page.locator('[name="decisionDate"]').fill("2095-01-05");await page.locator('[name="decisionObservations"]').fill("Evaluación técnica documentada");
   for(const name of [...generalReturnChecks,...(medicine?["uniqueIdentifierActive","tamperEvidenceIntact","coldChainWithinFortyEightHours","customerDeclarationAvailable",...coldReturnChecks]:["qcAssessmentCompleted"])])await page.locator(`[name="${name}"]`).selectOption("YES");
   if(medicine)await page.locator('[name="temperatureExcursionEvaluated"]').selectOption("NA");
   await page.locator('[name="packagingIntegrityOk"]').selectOption("NO");await page.getByRole("button",{name:"Guardar cambios",exact:true}).click();await page.getByText("Reincorporación incompatible con packagingIntegrityOk: debe ser Sí.",{exact:true}).waitFor();assert.equal(await page.locator('[name="finalDestination"]').inputValue(),"Reincorporación autorizada");
   await page.locator('[name="packagingIntegrityOk"]').selectOption("YES");await save(page,"Guardar cambios");assert.deepEqual((await prisma.returnProduct.findMany({where:{returnRecordId:draft.id},orderBy:{sortOrder:"asc"}})).map(x=>x.id),productIds);
   if(previousArchiveId)assert.equal((await page.request.get(`${base}/api/returns/${draft.id}/documents/${previousArchiveId}`)).status(),404,"archivo de otro expediente");
   const archiveIds:string[]=[];
   for(const annex of ["iii","iv","v"]){
    const response=await page.request.get(`${base}/api/returns/${draft.id}/annex-${annex}${annex==="iv"?`?product=${productIds[0]}`:""}`);assert.equal(response.status(),200);const xml=getZipEntryText(readZip(await response.body()),"word/document.xml");assert(xml.includes(tag));
    const doc=await prisma.generatedDocument.findFirstOrThrow({where:{qmsRecordId:draft.qmsRecordId,documentType:`RETURN_ANNEX_${annex.toUpperCase() as "III"|"IV"|"V"}`},orderBy:{generatedAt:"desc"}});archiveIds.push(doc.id);assert.equal(doc.checksum,createHash("sha256").update(await response.body()).digest("hex"));assert.equal((doc.metadata as {sourceSnapshot:{returnRecord:{products:{id:string}[]}}}).sourceSnapshot.returnRecord.products[0].id,productIds[0]);
   }
   if(productIds[1])assert.equal((await page.request.get(`${base}/api/returns/${draft.id}/annex-iv?product=${productIds[1]}`)).status(),200);
   assert.equal((await page.request.get(`${base}/api/returns/${draft.id}/annex-iv?product=${randomUUID()}`)).status(),404);
   assert.equal((await page.request.get(`${base}/api/returns/${draft.id}/documents/${randomUUID()}`)).status(),404);
   previousArchiveId=archiveIds[0];
   const annual=await page.request.get(`${base}/api/returns/export/annex-vi?year=2095`);assert.equal(annual.status(),200);assert(getZipEntryText(readZip(await annual.body()),"xl/worksheets/sheet1.xml").includes(tag));
   // Independent III/V files; replacement requires a reason and archives the bytes.
   for(const annex of ["III","V"]){
    await view(page,`/returns/${draft.id}?tab=documents`);const form=page.locator(".return-signed-document").filter({hasText:`${annex==="III"?"Formulario":"Declaración"}`}).locator("form");
    // Select by existing order: III first, V second.
    const upload=page.locator(".return-signed-document form").nth(annex==="III"?0:1);await upload.locator('[name="file"]').setInputFiles({name:`TEST-${annex}.pdf`,mimeType:"application/pdf",buffer:Buffer.from(`%PDF-1.7\n% Ficticio ${tag} ${annex}\n%%EOF`)});await upload.getByRole("button",{name:"Cargar PDF firmado",exact:true}).click();await page.locator(`a[href="/api/returns/${draft.id}/signed-pdf/annex-${annex.toLowerCase()}"]`).waitFor();
    void form;
   }
   const oldPdf=await prisma.recordVersionDocument.findFirstOrThrow({where:{kind:"RETURN_ANNEX_III_SIGNED",recordVersion:{qmsRecordId:draft.qmsRecordId}}});
   await view(page,`/returns/${draft.id}?tab=documents`);const replacement=page.locator(".return-signed-document form").first();await replacement.locator('[name="file"]').setInputFiles({name:"TEST-replaced.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.7\n% Ficticio sustituto\n%%EOF")});await replacement.locator('[name="replacementReason"]').fill("Corrección documental ficticia");await replacement.locator("button[type=submit]").click();await page.getByText("TEST-replaced.pdf",{exact:false}).first().waitFor();
   assert.equal(await prisma.generatedDocument.count({where:{qmsRecordId:draft.qmsRecordId,checksum:oldPdf.checksum,mimeType:"application/pdf"}}),1);
   const oldArchive=await prisma.generatedDocument.findFirstOrThrow({where:{qmsRecordId:draft.qmsRecordId,checksum:oldPdf.checksum,mimeType:"application/pdf"}});
   const oldDownload=await page.request.get(`${base}/api/returns/${draft.id}/documents/${oldArchive.id}`);assert.equal(oldDownload.status(),200);assert.equal(createHash("sha256").update(await oldDownload.body()).digest("hex"),oldPdf.checksum);
   const currentPdf=await page.request.get(`${base}/api/returns/${draft.id}/signed-pdf/annex-iii`);assert.equal(currentPdf.status(),200);assert.notEqual(createHash("sha256").update(await currentPdf.body()).digest("hex"),oldPdf.checksum);
   // Close the same expediente, then edit it: old generated files stay immutable.
   const archived=await prisma.generatedDocument.findUniqueOrThrow({where:{id:archiveIds[0]}});
   await view(page,`/returns/${draft.id}/edit`);await page.locator('[name="status"]').selectOption("CLOSED");await page.locator('[name="closedAt"]').fill("2095-01-06");await page.locator('[name="traceabilityUpdated"]').selectOption("YES");await page.locator('[name="reasonObservations"]').fill("Conclusión posterior");await save(page,"Guardar cambios");
   const closed=await prisma.returnRecord.findUniqueOrThrow({where:{id:draft.id},include:{qmsRecord:{include:{versions:true}}}});assert.equal(closed.status,"CLOSED");assert.equal(closed.qmsRecord.businessCode,opened.qmsRecord.businessCode);assert.equal(closed.qmsRecord.versions.length,1);
   const historic=await page.request.get(`${base}/api/returns/${draft.id}/documents/${archiveIds[0]}`);assert.equal(historic.status(),200);assert.equal(createHash("sha256").update(await historic.body()).digest("hex"),archived.checksum);assert(getZipEntryText(readZip(await historic.body()),"word/document.xml").includes("Investigación pendiente"));assert(!getZipEntryText(readZip(await historic.body()),"word/document.xml").includes("Conclusión posterior"));
   await prisma.generatedDocument.update({where:{id:archiveIds[0]},data:{checksum:"0".repeat(64)}});assert.equal((await page.request.get(`${base}/api/returns/${draft.id}/documents/${archiveIds[0]}`)).status(),409);await prisma.generatedDocument.update({where:{id:archiveIds[0]},data:{checksum:archived.checksum}});
   await view(page,`/returns/${draft.id}?tab=review&review=1`);await page.locator(".review-thread-card").filter({hasText:`Review ${tag}`}).getByRole("link",{name:"Ir al campo",exact:true}).click();await page.locator(`#review-return-product-${productIds[0]}.review-target-highlight`).waitFor();
   for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});for(const tab of ["summary","checks","followups","relations","documents","review","timeline"]){await view(page,`/returns/${draft.id}?tab=${tab}`);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,`${tab} ${width}px`);}}
   await page.setViewportSize({width:1440,height:1000});
   if(medicine){
    const annul=await page.request.post(`${base}/api/qms/${draft.qmsRecordId}/administrative-status`,{data:{action:"ANNUL",reason:"Prueba de anulación ficticia R4B",actor:"QA ficticio"}});assert.equal(annul.status(),200);
    assert.equal((await page.request.get(`${base}/api/returns/${draft.id}/annex-iii`)).status(),409);assert.equal((await page.request.get(`${base}/api/returns/${draft.id}/documents/${archiveIds[0]}`)).status(),200);assert.equal((await page.request.get(`${base}/api/returns/${draft.id}/signed-pdf/annex-iii`)).status(),200);
    const annulled=await prisma.qmsRecord.findUniqueOrThrow({where:{id:draft.qmsRecordId}});assert.equal(annulled.isActive,false);assert.equal(annulled.annulledBusinessCode,opened.qmsRecord.businessCode);
   }
   if(!medicine){
    const reviewedSnapshot=JSON.stringify(thread.valueSnapshot);await view(page,`/returns/${draft.id}/edit`);await page.locator(".return-product-card").first().getByRole("button",{name:"Quitar",exact:true}).click();await save(page,"Guardar cambios");
    assert.deepEqual((await prisma.returnProduct.findMany({where:{returnRecordId:draft.id}})).map(x=>x.id),[productIds[1]]);
    const retired=await prisma.reviewThread.findUniqueOrThrow({where:{id:thread.id}});assert.equal(retired.targetEntityId,productIds[0]);assert.equal(JSON.stringify(retired.valueSnapshot),reviewedSnapshot);assert.equal(await prisma.changeHistory.count({where:{qmsRecordId:draft.qmsRecordId,fieldPath:"products.removed"}}),1);
    await view(page,`/returns/${draft.id}?tab=review&review=1`);const retiredCard=page.locator(".review-thread-card").filter({hasText:`Review ${tag}`});await retiredCard.waitFor();assert.equal(await retiredCard.getByRole("link",{name:"Ir al campo",exact:true}).count(),0);
   }
  }
  assert.deepEqual(errors,[]);console.log("R4B UI OK: API multi-producto sin frío y medicamento frío/serializado, Draft→OPEN→evaluación→cierre, recepción/código anual, planificación, UUID estables, selector Reclamación canónico, Review sin versión/deep link, rechazo stock NO, III/IV/V/VI reales o fixture TEST, archivo inmutable, PDF III/V y sustitución archivada, 1440/768/390 Madrid sin hidratación.");
 }catch(e){console.error("R4B UI failure",page.url(),errors,Array.from(pendingRequests.entries()));console.error((await page.locator("main").ariaSnapshot().catch(()=>"")).slice(-12000));throw e;}
 finally{
  await browser.close();ids.push(...(await prisma.returnRecord.findMany({where:{customerEntity:{startsWith:marker}},select:{qmsRecordId:true}})).map(x=>x.qmsRecordId));
  await prisma.reviewMessage.deleteMany({where:{reviewThread:{qmsRecordId:{in:ids}}}});await prisma.reviewThread.deleteMany({where:{qmsRecordId:{in:ids}}});await purgeLegacyFixtureDocuments(prisma, {recordVersion:{qmsRecordId:{in:ids}}});
    await prisma.recordVersionDocument.deleteMany({where:{recordVersion:{qmsRecordId:{in:ids}}}});await prisma.generatedDocument.deleteMany({where:{qmsRecordId:{in:ids}}});await prisma.qmsRelation.deleteMany({where:{OR:[{sourceRecordId:{in:ids}},{targetRecordId:{in:ids}}]}});await prisma.changeHistory.deleteMany({where:{qmsRecordId:{in:ids}}});await prisma.qmsRecordVersion.deleteMany({where:{qmsRecordId:{in:ids}}});await prisma.returnRecord.deleteMany({where:{qmsRecordId:{in:ids}}});await prisma.complaint.deleteMany({where:{qmsRecordId:{in:ids}}});await prisma.qmsRecord.deleteMany({where:{id:{in:ids}}});for(const backup of backups)await prisma.templateVersion.update({where:{id:backup.id},data:backup.data});
 }
}
main().finally(()=>prisma.$disconnect()).catch(e=>{console.error(e);process.exitCode=1;});
