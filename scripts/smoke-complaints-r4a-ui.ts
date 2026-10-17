import { purgeLegacyFixtureDocuments } from "./audit-fixtures/legacy-cleanup";
import { Prisma } from "@prisma/client";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { chromium } from "./auth-fixtures/browser";
import { type Page } from "playwright";
import { prisma } from "../src/lib/db";
import { readZip, getZipEntryText } from "../src/lib/ooxml/zip";
import { syntheticComplaintDoc } from "./complaints-r4a-doc-fixtures";
const base=process.env.R4A_UI_BASE_URL,marker=`R4A-UI-${randomUUID()}`,ids:string[]=[];
async function view(page:Page,path:string){await page.goto(`${base}${path}`);await page.waitForLoadState("networkidle");}
async function save(page:Page,label:string){await page.getByRole("button",{name:label,exact:true}).click();await page.waitForURL(/\/complaints\/[a-f0-9-]+$/,{timeout:30000});await page.waitForLoadState("networkidle");}
async function assertCurrentForm(page:Page){
 assert.equal(await page.getByRole("heading",{name:/Aprobaciones/}).count(),0);
 for(const name of ["approvalNames","closeApprovalNames","effectivenessRequired","externalCommunication"])assert.equal(await page.locator(`[name="${name}"]`).count(),0,`${name} retirado de captura`);
 assert.equal(await page.locator('[name="internalObservations"]').getAttribute("required"),null);
 assert.deepEqual(await page.locator('[name="partIIRequired"] option').evaluateAll(options=>options.map(option=>(option as HTMLOptionElement).value)),["pending","true","false"]);
}
function assertLegacy(record:{approvalNames:string|null;closeApprovalNames:string|null},tag:string){assert.equal(record.approvalNames,`Legacy Parte I ${tag}`);assert.equal(record.closeApprovalNames,`Legacy cierre ${tag}`);}
async function main(){
 if(process.env.APP_ENV!=="test"||!base)throw new Error("APP_ENV=test y R4A_UI_BASE_URL son obligatorios.");
 const backups:Array<{id:string;data:Prisma.TemplateVersionUpdateInput}>=[];
 const browser=await chromium.launch({args:["--no-sandbox"]});const page=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:"Europe/Madrid"}),errors:string[]=[];
 page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error"&&/hydrat|server rendered/i.test(m.text()))errors.push(m.text());});
 try{
  if(process.env.R4A_OFFICIAL_TEMPLATES!=="1")for(const annex of ["III","IV"] as const){
   const t=await prisma.templateVersion.findUniqueOrThrow({where:{module_documentType_versionCode:{module:"COMPLAINT",documentType:annex==="III"?"COMPLAINT_ANNEX_III":"COMPLAINT_ANNEX_IV",versionCode:"03"}}});
   if(t.fileData||t.filePath)throw new Error("Usa R4A_OFFICIAL_TEMPLATES=1 para las plantillas oficiales ya instaladas.");
   backups.push({id:t.id,data:{fileData:t.fileData,fileName:t.fileName,fileSize:t.fileSize,checksum:t.checksum,filePath:t.filePath}});const bytes=syntheticComplaintDoc(annex);
   await prisma.templateVersion.update({where:{id:t.id},data:{fileData:new Uint8Array(bytes),fileName:`TEST-R4A-${annex}.docx`,fileSize:bytes.length,checksum:createHash("sha256").update(bytes).digest("hex")}});
  }
  const department=await prisma.department.findUniqueOrThrow({where:{code:"GC-00"}});
  for(const type of ["CUSTOMER","PROVIDER"] as const){
   const tag=`${marker}-${type}`;
   await view(page,"/complaints/new");await assertCurrentForm(page);await page.locator(`input[name="complaintType"][value="${type}"]`).check();await page.locator('[name="partyName"]').fill(tag);
   await save(page,"Guardar borrador");const draft=await prisma.complaint.findFirstOrThrow({where:{partyName:tag}});ids.push(draft.qmsRecordId);assert.equal(draft.status,"DRAFT");assert.equal(draft.qmsRecordId.length,36);
   // Model an existing historical record without adding any retired UI inputs.
   await prisma.complaint.update({where:{id:draft.id},data:{approvalNames:`Legacy Parte I ${tag}`,closeApprovalNames:`Legacy cierre ${tag}`}});
   const capa=await prisma.qmsRecord.create({data:{recordType:"CAPA",businessCode:`AC-${tag}`,year:2094,capa:{create:{status:"OPEN",actionType:"CORRECTIVE",createdByText:"QA ficticio"}}}});
   const ret=await prisma.qmsRecord.create({data:{recordType:"RETURN",businessCode:`DEV-${tag}`,year:2094,returnRecord:{create:{status:"OPEN",returnType:"COMPLAINT",createdByText:"QA ficticio"}}}});ids.push(capa.id,ret.id);
   await view(page,`/complaints/${draft.id}/edit`);await assertCurrentForm(page);
   const texts:Record<string,string>={openedAt:"2094-10-01",detectionDate:"2094-10-01",receptionDate:"2094-10-01",createdByText:"QA ficticio",contact:"qa@example.invalid",reference:"Servicio ficticio",description:`V00 ${tag}`,emittedBy:"QA ficticio",riskJustification:"Sin riesgo identificado",investigation:"Investigación inicial",impactAssessment:"Sin impacto identificado",rootCause:"Causa documentada",regulatoryJustification:"No precisa retirada ni notificación",resolutionLines:"Seguimiento de resolución",communicationDate:"2094-10-02",communicationMedium:"Correo",communicationParties:type==="CUSTOMER"?"QA / Cliente":"QA / Proveedor",communicationSummary:"Comunicación inicial",conclusion:"Continuidad pendiente"};
   for(const [name,value] of Object.entries(texts))await page.locator(`input[name="${name}"],textarea[name="${name}"]`).fill(value);
   await page.locator('[name="departmentId"]').selectOption(department.id);
   for(const [name,value] of [["sourceTypes",type==="CUSTOMER"?"CUSTOMER":"SUPPLIER"],["scopeTypes","MEDICINE"],["affectedObjectTypes","SERVICE"],["categoryTypes","SERVICE_SUPPLY"],["containmentActions","NONE"]])await page.locator(`input[name="${name}"][value="${value}"]`).check();
   for(const [name,value] of Object.entries({recurrent:"false",impactQualityGmp:"NO",impactSafetyEfficacy:"NO",impactRegulatory:"NO",impactEnvironment:"NO",impactOtherSimilar:"NO",investigationResult:"PROCEDENT",classification:"MINOR",potentialRecall:"NO",recallProcedureRequired:"NO",authorityNotificationRequired:"NO",responsiblePartyCommunicationRequired:"YES",hasDerivedActions:"false"}))await page.locator(`select[name="${name}"]`).selectOption(value);
   await page.locator('[name="status"]').selectOption("OPEN");await page.locator('[name="nextFollowupDate"]').fill("2094-10-20");
   await page.locator('input[name="affectedObjectTypes"][value="PRODUCT_MATERIAL"]').check();assert.equal(await page.locator('[name="lotReference"]').getAttribute("required"),"");await page.locator('input[name="affectedObjectTypes"][value="PRODUCT_MATERIAL"]').uncheck();assert.equal(await page.locator('[name="lotReference"]').getAttribute("required"),null);
   // Simulate a stale client still posting retired approval fields.
   await page.evaluate(()=>{for(const [name,value] of [["approvalNames","Intento de sobrescribir legacy"],["closeApprovalNames",""]]){const input=document.createElement("input");input.type="hidden";input.name=name;input.value=value;document.querySelector('[name="status"]')!.closest('form')!.append(input);}});
   await save(page,"Guardar cambios");const opened=await prisma.complaint.findUniqueOrThrow({where:{id:draft.id},include:{qmsRecord:true}});assert.equal(opened.status,"OPEN");assert.equal(opened.effectivenessStatus,"PENDING");assertLegacy(opened,tag);assert.equal(opened.nextFollowupDate?.toISOString().slice(0,10),"2094-10-20");assert.match(opened.qmsRecord.businessCode!,type==="CUSTOMER"?/^R\/C\//:/^R\/P\//);
   for(const [recordType,target] of [["CAPA",capa],["RETURN",ret]] as const){
    await view(page,`/complaints/${draft.id}?tab=relations`);const form=page.locator(".relation-form");await form.locator('[name="recordType"]').selectOption(recordType);await form.locator('[name="businessCode"]').fill(target.businessCode!);await page.getByRole("option").filter({hasText:target.businessCode!}).click();assert.equal(await form.locator('[name="targetRecordId"]').inputValue(),target.id);
    await form.getByRole("button",{name:"Vincular expediente",exact:true}).click();await page.locator(".form-success").waitFor();await page.waitForLoadState("networkidle");
   }
   await view(page,`/complaints/${draft.id}/edit`);await assertCurrentForm(page);await page.locator('[name="hasDerivedActions"]').selectOption("true");
   for(const action of ["CORRECTIVE_ACTION","PREVENTIVE_ACTION","RETURN","CREDIT"])await page.locator(`input[name="resolutionActions"][value="${action}"]`).check();
   await page.locator('[name="creditActionDetails"]').fill("Abono ficticio");
   const capaRows=page.locator(".dynamic-row.capa");for(let i=0;i<await capaRows.count();i++){const inputs=capaRows.nth(i).locator("input");await inputs.nth(0).fill(`Propuesta ${i}`);await inputs.nth(1).fill("2094-10-12");await inputs.nth(2).fill("QA ficticio");}
   const returnInputs=page.locator(".complaint-derived-row input");await returnInputs.nth(1).fill("Devolver material");await returnInputs.nth(2).fill("QA ficticio");await returnInputs.nth(3).fill("2094-10-13");
   await save(page,"Guardar cambios");assertLegacy(await prisma.complaint.findUniqueOrThrow({where:{id:draft.id}}),tag);const proposalIds=(await prisma.complaintCapaPlan.findMany({where:{complaintId:draft.id}})).map(x=>x.id);
   await view(page,`/complaints/${draft.id}?tab=part-i&review=1`);await page.locator("#review-complaint-description .review-marker").click();const drawer=page.locator(".review-drawer");await drawer.locator(".review-form textarea").last().fill(`Review V00 ${tag}`);await drawer.getByRole("button",{name:"Crear observación",exact:true}).click();await drawer.locator(".review-thread-card").filter({hasText:`Review V00 ${tag}`}).waitFor();await page.getByRole("button",{name:"Cerrar",exact:true}).click();
   const thread=await prisma.reviewThread.findFirstOrThrow({where:{qmsRecordId:draft.qmsRecordId}}),v00=await prisma.qmsRecordVersion.findFirstOrThrow({where:{qmsRecordId:draft.qmsRecordId,sequenceNumber:0}});assert.equal(thread.recordVersionId,v00.id);assertLegacy((v00.snapshot as unknown as {complaint:{approvalNames:string|null;closeApprovalNames:string|null}}).complaint,tag);const snapshot00=JSON.stringify(v00.snapshot);
   await view(page,`/complaints/${draft.id}/edit`);await assertCurrentForm(page);await page.locator('[name="partIIRequired"]').selectOption("true");
   for(const [name,value] of Object.entries({responseDate:"2094-10-10",responseMedium:"Correo",responseSummary:type==="CUSTOMER"?"Respuesta al cliente / compromisos":"Respuesta del proveedor / compromisos",effectivenessAssessment:"Eficacia conforme",closeActionReferences:"CAPA y devolución con seguimiento independiente",closeConclusion:"Conclusión de cierre"}))await page.locator(`input[name="${name}"],textarea[name="${name}"]`).fill(value);
   await page.locator('[name="responseSufficient"]').selectOption("true");await page.locator('[name="effectivenessStatus"]').selectOption("ACCEPTABLE");await page.locator('[name="closeActionStatus"]').selectOption("LINKED");
   await page.locator('[name="partIIRequired"]').selectOption("false");await page.locator('[name="partIIRequired"]').selectOption("true");assert.match(await page.locator('[name="responseSummary"]').inputValue(),/compromisos/);
   await page.getByRole("button",{name:"Guardar como nueva versión / seguimiento",exact:true}).click();await page.getByText("Debe indicarse el motivo del seguimiento o de la nueva versión.",{exact:true}).waitFor();assert.equal(await prisma.qmsRecordVersion.count({where:{qmsRecordId:draft.qmsRecordId}}),1);
   await page.locator('[name="versionFollowupDate"]').fill("2094-10-10");await page.locator('[name="changeReason"]').fill("Seguimiento formal Parte II");await save(page,"Guardar como nueva versión / seguimiento");
   assert.deepEqual((await prisma.complaintCapaPlan.findMany({where:{complaintId:draft.id}})).map(x=>x.id).sort(),[...proposalIds].sort());assert.equal(JSON.stringify((await prisma.qmsRecordVersion.findUniqueOrThrow({where:{id:v00.id}})).snapshot),snapshot00);
   assertLegacy(await prisma.complaint.findUniqueOrThrow({where:{id:draft.id}}),tag);
   const v01=await prisma.qmsRecordVersion.findFirstOrThrow({where:{qmsRecordId:draft.qmsRecordId,sequenceNumber:1}});
   assertLegacy((v01.snapshot as unknown as {complaint:{approvalNames:string|null;closeApprovalNames:string|null}}).complaint,tag);
   for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});for(const tab of ["summary","part-i","part-ii","relations","documents","versions","review","timeline"]){await view(page,`/complaints/${draft.id}?tab=${tab}`);assert.equal(await page.getByRole("heading",{name:/Aprobaciones/}).count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,`${type}/${tab} ${width}px`);}}
   await page.setViewportSize({width:1440,height:1000});await view(page,`/complaints/${draft.id}?tab=versions`);
   for(const sequence of [0,1]){const article=page.locator(".record-version-item").filter({has:page.getByRole("link",{name:`Descargar Anexo III V0${sequence}`,exact:true})});await article.locator('[name="file"]').setInputFiles({name:`signed-V0${sequence}.pdf`,mimeType:"application/pdf",buffer:Buffer.from(`%PDF-1.7\n% Ficticio ${sequence}\n%%EOF`)});await article.getByRole("button",{name:"Cargar PDF firmado",exact:true}).click();await article.getByRole("link",{name:`Descargar PDF firmado V0${sequence}`,exact:true}).waitFor();
    const pdf=await page.request.get(`${base}/api/complaints/${draft.id}/versions/${sequence}/signed-pdf`);assert.equal(pdf.status(),200);
    const stored=await prisma.recordVersionDocument.findFirstOrThrow({where:{kind:"SIGNED_PDF",recordVersion:{qmsRecordId:draft.qmsRecordId,sequenceNumber:sequence}}});assert.equal(createHash("sha256").update(await pdf.body()).digest("hex"),stored.checksum);
    for(const annex of ["iii","iv"]){const response=await page.request.get(`${base}/api/complaints/${draft.id}/annex-${annex}?version=${sequence}`);assert.equal(response.status(),200);const xml=getZipEntryText(readZip(await response.body()),"word/document.xml");assert(xml.includes(`V00 ${tag}`));assert(xml.includes(`V0${sequence}`));}
   }
   await view(page,`/complaints/${draft.id}?tab=review&review=1`);await page.locator(".review-thread-card").filter({hasText:`Review V00 ${tag}`}).getByRole("link",{name:"Ir al campo",exact:true}).click();await page.locator("#review-complaint-description.review-target-highlight").waitFor();assert.equal(new URL(page.url()).searchParams.get("tab"),"part-i");
   await view(page,`/complaints/${draft.id}/edit`);await assertCurrentForm(page);await page.locator('[name="status"]').selectOption("CLOSED");await page.locator('[name="closedAt"]').fill("2094-10-11");await page.locator('[name="versionFollowupDate"]').fill("2094-10-11");await page.locator('[name="changeReason"]').fill("Cierre formal");await save(page,"Guardar como nueva versión / seguimiento");
   const closed=await prisma.complaint.findUniqueOrThrow({where:{id:draft.id}});assert.equal(closed.status,"CLOSED");assertLegacy(closed,tag);
   const v02=await prisma.qmsRecordVersion.findFirstOrThrow({where:{qmsRecordId:draft.qmsRecordId,sequenceNumber:2}});assertLegacy((v02.snapshot as unknown as {complaint:{approvalNames:string|null;closeApprovalNames:string|null}}).complaint,tag);
   await view(page,`/complaints/${draft.id}?tab=part-ii`);assert.equal(await page.getByRole("heading",{name:/Aprobaciones/}).count(),0);assert.equal(await page.getByText(`Legacy cierre ${tag}`,{exact:true}).count(),0);assert.equal(closed.nextFollowupDate,null);assert.equal((await prisma.reviewThread.findUniqueOrThrow({where:{id:thread.id}})).recordVersionId,v00.id);assert.equal(JSON.stringify((await prisma.qmsRecordVersion.findUniqueOrThrow({where:{id:v00.id}})).snapshot),snapshot00);assert.equal(await prisma.complaintFollowup.count({where:{complaintId:draft.id}}),0);
  }
  assert.deepEqual(errors,[]);console.log("R4A UI OK: cliente/proveedor Draft→apertura V00→acciones múltiples/CAPA/Return UUID→Parte II V01→PDF V00/V01→Review histórico/deep link→cierre V02; aprobaciones legacy preservadas en BD/V00/V01/V02 y ausentes de UX, propuestas estables, validación motivo/fecha, 1440/768/390 Madrid sin errores de hidratación.");
 }catch(e){console.error("R4A UI failure",page.url(),errors);console.error((await page.locator("main").ariaSnapshot().catch(()=>"")).slice(-12000));throw e;}
 finally{
  await browser.close();
  // Also clean a committed Draft when the browser fails before its navigation.
  ids.push(...(await prisma.complaint.findMany({where:{partyName:{startsWith:marker}},select:{qmsRecordId:true}})).map(row=>row.qmsRecordId));
  await prisma.reviewMessage.deleteMany({where:{reviewThread:{qmsRecordId:{in:ids}}}});await prisma.reviewThread.deleteMany({where:{qmsRecordId:{in:ids}}});await purgeLegacyFixtureDocuments(prisma, {recordVersion:{qmsRecordId:{in:ids}}});
    await prisma.recordVersionDocument.deleteMany({where:{recordVersion:{qmsRecordId:{in:ids}}}});await prisma.generatedDocument.deleteMany({where:{qmsRecordId:{in:ids}}});await prisma.qmsRelation.deleteMany({where:{OR:[{sourceRecordId:{in:ids}},{targetRecordId:{in:ids}}]}});await prisma.changeHistory.deleteMany({where:{qmsRecordId:{in:ids}}});await prisma.qmsRecordVersion.deleteMany({where:{qmsRecordId:{in:ids}}});await prisma.complaint.deleteMany({where:{qmsRecordId:{in:ids}}});await prisma.capa.deleteMany({where:{qmsRecordId:{in:ids}}});await prisma.returnRecord.deleteMany({where:{qmsRecordId:{in:ids}}});await prisma.qmsRecord.deleteMany({where:{id:{in:ids}}});for(const backup of backups)await prisma.templateVersion.update({where:{id:backup.id},data:backup.data});
 }
}
main().finally(()=>prisma.$disconnect()).catch(e=>{console.error(e);process.exitCode=1;});
