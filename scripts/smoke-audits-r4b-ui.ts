import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "./auth-fixtures/browser";
import { type Page } from "playwright";
import { prisma } from "../src/lib/db";

const base=process.env.R4B_AUDITS_UI_BASE_URL;
const marker="R4B-UI-"+randomUUID();
async function navigate(page:Page,path:string){
  await page.goto(base+path);
  await page.waitForLoadState("networkidle");
}
async function submitAndWait(page:Page,label:string,expected:RegExp){
  const completedAction=page.waitForResponse(response=>response.request().method()==="POST"&&Boolean(response.request().headers()["next-action"]),{timeout:25000});
  await page.getByRole("button",{name:label,exact:true}).click();
  const result=await completedAction;
  console.log("R4B acción:",label,{status:result.status(),redirect:result.headers()["x-action-redirect"]});
  if(result.status()===303){
    const redirect=result.headers()["x-action-redirect"]?.split(";")[0];
    assert(redirect && expected.test(new URL(redirect,base).pathname),`Redirección inesperada para ${label}: ${redirect}`);
  }
  assert([200, 303].includes(result.status()),`La acción ${label} devolvió HTTP ${result.status()}`);
  await page.waitForURL(expected,{timeout:25000});
  await page.waitForLoadState("networkidle");
  await page.reload();
  await page.waitForLoadState("networkidle");
}
async function main(){
  if(!base||process.env.APP_ENV!=="test")throw Error("R4B UI smoke requiere APP_ENV=test y R4B_AUDITS_UI_BASE_URL.");
  const browser=await chromium.launch({args:["--no-sandbox"]});
  const page=await browser.newPage({viewport:{width:1440,height:950}});
  const errors:string[]=[];
  const network:unknown[]=[];
  page.on("request",request=>{if(request.method()==="POST")network.push({event:"action",url:request.url(),data:request.postData()});});
  page.on("response",response=>{if(response.request().method()==="POST"||response.url().includes("type=EXTERNAL"))network.push({event:"response",url:response.url(),status:response.status(),redirect:response.headers()["x-action-redirect"]});});
  page.on("pageerror",error=>errors.push(error.message));
  page.on("console",message=>{if(message.type()==="error"&&/hydration/i.test(message.text())) errors.push(message.text())});
  try{
    await navigate(page,"/audits?q="+encodeURIComponent(marker)+"&planning=OUT_OF_PLAN");
    const filterTypeNav=page.getByRole("navigation",{name:"Filtrar auditorías por tipo"});
    assert.equal(await filterTypeNav.getByRole("link").count(),3,"El selector debe tener todas/internas/externas");
    const externalHref=await filterTypeNav.getByRole("link",{name:"Externas"}).getAttribute("href");
    assert(externalHref && externalHref.includes("type=EXTERNAL") && externalHref.includes("planning=OUT_OF_PLAN"),"Filtro externo preserva la clasificación anual");
    await filterTypeNav.getByRole("link",{name:"Externas"}).click();
    await page.waitForURL(/type=EXTERNAL/);
    assert.equal(await page.getByRole("navigation",{name:"Filtrar auditorías por tipo"}).getByRole("link",{name:"Externas"}).getAttribute("aria-current"),"page");
    await navigate(page,"/audits/plans");
    await page.locator('input[name="year"]').fill("2091");
    await page.locator('select[name="auditType"]').selectOption("INTERNAL");
    await page.locator('input[name="title"]').fill(marker+" interno");
    await submitAndWait(page,"Crear plan",/\/audits\/plans\/[a-f0-9-]+$/);
    const internalId=new URL(page.url()).pathname.split("/").pop()!;
    assert.equal((await prisma.auditAnnualPlan.findUniqueOrThrow({where:{id:internalId}})).auditType,"INTERNAL");
    // R5A: un error de validación no borra lo escrito (alta de plan duplicado y entrada con fecha y período).
    await navigate(page,"/audits/plans");
    await page.locator('input[name="year"]').fill("2091");
    await page.locator('select[name="auditType"]').selectOption("INTERNAL");
    await page.locator('input[name="title"]').fill(marker+" duplicado");
    await page.getByRole("button",{name:"Crear plan",exact:true}).click();
    await page.getByRole("alert").filter({hasText:"Ya existe un plan"}).waitFor();
    assert.equal(await page.locator('input[name="title"]').inputValue(),marker+" duplicado");
    assert.equal(await page.locator('select[name="auditType"]').inputValue(),"INTERNAL");
    await navigate(page,"/audits/plans/"+internalId);
    await page.locator('input[name="subject"]').first().fill("Entrada con error UI");
    await page.locator('input[name="plannedDate"]').first().fill("2091-06-11");
    await page.locator('input[name="plannedPeriodText"]').first().fill("Primer trimestre");
    await page.getByRole("button",{name:"Añadir al plan",exact:true}).click();
    await page.getByRole("alert").filter({hasText:"no ambos"}).waitFor();
    assert.equal(await page.locator('input[name="subject"]').first().inputValue(),"Entrada con error UI");
    assert.equal(await page.locator('input[name="plannedPeriodText"]').first().inputValue(),"Primer trimestre");
    await page.locator('input[name="plannedPeriodText"]').first().fill("");
    const department=await prisma.department.findUniqueOrThrow({where:{code:"GC-00"}});
    const subject=marker+" auditoría prevista";
    await page.locator('input[name="subject"]').fill(subject);
    await page.locator('input[name="plannedDate"]').fill("2091-06-11");
    await page.locator('select[name="departmentId"]').selectOption(department.id);
    await submitAndWait(page,"Añadir al plan",new RegExp("/audits/plans/"+internalId+"$"));
    const entry=await prisma.auditPlanEntry.findFirstOrThrow({where:{planId:internalId,subject}});
    const card=page.locator("article.audit-action-card").filter({hasText:subject});
    assert.equal(await card.count(),1);
    await card.locator("details.audit-editor").first().locator("summary").click();
    await card.locator('input[name="plannedDate"]').fill("2091-07-03");
    await card.locator('details.audit-editor').first().locator('input[name="reason"]').fill("Cambio de calendario ficticio");
    await submitAndWait(page,"Guardar cambios",new RegExp("/audits/plans/"+internalId+"$"));
    assert.equal((await prisma.auditPlanEntry.findUniqueOrThrow({where:{id:entry.id}})).plannedDate?.toISOString().slice(0,10),"2091-07-03");
    await page.locator("article.audit-action-card").filter({hasText:subject}).getByRole("link",{name:"Crear expediente para esta entrada"}).click();
    await page.waitForURL(new RegExp("/audits/new\\?planEntryId="+entry.id+"$"));
    await page.waitForLoadState("networkidle");
    assert.equal(await page.getByLabel("Objeto / título").inputValue(),subject);
    assert.equal(await page.locator('select[name="auditType"]').inputValue(),"INTERNAL");
    assert.equal(await page.locator('select[name="planningStatus"]').inputValue(),"PLANNED");
    assert.equal(await page.locator('select[name="planEntryId"]').inputValue(),entry.id);
    await submitAndWait(page,"Guardar auditoría",/\/audits\/[a-f0-9-]+$/);
    const audit=await prisma.audit.findFirstOrThrow({where:{planEntryId:entry.id}});
    assert.equal(audit.status,"DRAFT");
    await navigate(page,"/audits/plans/"+internalId);
    assert.equal(await page.getByRole("link",{name:/Expediente:/}).count(),1);
    await navigate(page,"/audits?q="+encodeURIComponent(subject)+"&planning=PLANNED&planId="+internalId);
    await page.locator("#audit-list-table tbody tr").first().waitFor();
    assert.equal(await page.locator("#audit-list-table tbody tr").count(),1);
    await navigate(page,"/audits/new");
    await page.getByLabel("Objeto / título").fill(marker+" fuera de plan");
    await page.locator('select[name="planningStatus"]').selectOption("OUT_OF_PLAN");
    await page.getByLabel("Motivo de auditoría fuera de plan").fill("Auditoría extraordinaria ficticia");
    await submitAndWait(page,"Guardar auditoría",/\/audits\/[a-f0-9-]+$/);
    const out=await prisma.audit.findFirstOrThrow({where:{title:marker+" fuera de plan"}});
    assert.equal(out.planningStatus,"OUT_OF_PLAN");
    assert.equal(out.planEntryId,null);
    await navigate(page,"/audits?q="+encodeURIComponent(marker)+"&planning=OUT_OF_PLAN");
    await page.locator("#audit-list-table").waitFor();
    assert.equal(await page.locator("#audit-list-table tbody tr").count(),1);
    await navigate(page,"/audits/plans");
    await page.locator('input[name="year"]').fill("2091");
    await page.locator('select[name="auditType"]').selectOption("EXTERNAL");
    await page.locator('input[name="title"]').fill(marker+" externo");
    await submitAndWait(page,"Crear plan",/\/audits\/plans\/[a-f0-9-]+$/);
    const externalId=new URL(page.url()).pathname.split("/").pop()!;
    assert.notEqual(externalId,internalId);
    await page.locator('input[name="subject"]').fill(marker+" proveedor");
    await page.locator('input[name="targetName"]').fill("Proveedor ficticio");
    await submitAndWait(page,"Añadir al plan",new RegExp("/audits/plans/"+externalId+"$"));
    assert.equal((await prisma.auditPlanEntry.count({where:{planId:externalId,isActive:true}})),1);
    await page.setViewportSize({width:390,height:850});
    await navigate(page,"/audits/plans/"+externalId);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth+2),false,"El detalle del plan desborda el móvil");
    assert.deepEqual(errors,[]);
    console.log("R4B Playwright OK: alta planes internos/externos, entradas, actualización e historial, alta desde plan, fuera de plan, filtros y vista móvil.");
  }catch(e){
    console.error("R4B UI FAIL:",e);
    console.error("URL:",page.url(),"Errores:",errors);
    console.error("R4B HTTP:",JSON.stringify(network));
    console.error((await page.locator("main").innerText().catch(()=>"" )).slice(0,3000));
    throw e;
  }finally{await browser.close();await prisma.$disconnect();}
}
main().catch(()=>{process.exitCode=1});
