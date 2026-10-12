import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "./auth-fixtures/browser";
import { type Page, type Locator } from "playwright";
import { prisma } from "../src/lib/db";
import { saveAudit } from "../src/modules/audits/service";
const base = process.env.R3B_UI_BASE_URL, marker = `R3B-UI-${randomUUID()}`, records:string[]=[];
async function view(page:Page,path:string) { await page.goto(`${base}${path}`); await page.locator("main h1").waitFor(); await page.waitForLoadState("networkidle"); }
async function saveChild(page: Page, form: Locator, button: string) {
  const loaded = page.waitForEvent("domcontentloaded");
  await form.getByRole("button",{name:button,exact:true}).click();
  await loaded;
  await page.waitForLoadState("networkidle");
}
async function main() {
  if (process.env.APP_ENV !== "test" || !base) throw new Error("Usar APP_ENV=test y R3B_UI_BASE_URL con servidor/BD aislados.");
  const department=await prisma.department.findUniqueOrThrow({where:{code:"GC-00"}});
  const audit=await saveAudit({actor:"UI ficticio",status:"OPEN",auditType:"INTERNAL",scenario:"INTERNAL_COVEX",title:marker,scope:"UI",plannedDate:"2095-10-07",departmentIds:[department.id],codingDepartmentId:department.id,participants:[{displayName:"Auditor ficticio",role:"AUDITOR",sortOrder:0}]}); records.push(audit.qmsRecordId);
  const target=async(type:"DEVIATION"|"CAPA")=>{const q=await prisma.qmsRecord.create({data:{recordType:type,businessCode:`${marker}-${type}`}});records.push(q.id);if(type==="CAPA") return {q,entity:await prisma.capa.create({data:{qmsRecordId:q.id,actionType:"CORRECTIVE",status:"OPEN",defectDescription:"UI"}})};return {q,entity:await prisma.deviation.create({data:{qmsRecordId:q.id,status:"OPEN",whatHappened:"UI"}})};};
  const capa=await target("CAPA"), deviation=await target("DEVIATION");
  const browser=await chromium.launch({executablePath:process.env.R3B_UI_CHROMIUM_PATH || undefined,args:["--no-sandbox"]}), page=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:"Europe/Madrid"}), errors:string[]=[];
  page.on("pageerror",e=>errors.push(e.message)); page.on("console",m=>{if(m.type()==="error" && /hydrat|server rendered/i.test(m.text())) errors.push(m.text());});
  try {
    await view(page,`/audits/${audit.id}?tab=findings`);
    await page.locator("summary").filter({hasText:"+ Añadir hallazgo / recomendación"}).click();
    let form=page.locator(".audit-child-form").first(); await form.locator('[name="description"]').fill(`OBS UI ${marker}`); await form.locator('[name="criticality"]').selectOption("MAJOR"); await saveChild(page,form,"Guardar hallazgo");
    await page.getByRole("heading",{name:"OBS 01",exact:true}).waitFor();
    const obs=await prisma.auditFinding.findFirstOrThrow({where:{auditId:audit.id,reference:"OBS 01"}});
    await page.locator("summary").filter({hasText:"+ Añadir hallazgo / recomendación"}).click();
    form=page.locator(".audit-child-form").first(); await form.locator('[name="findingType"]').selectOption("RECOMMENDATION"); await form.locator('[name="description"]').fill("Recomendación UI"); await saveChild(page,form,"Guardar hallazgo"); await page.getByRole("heading",{name:"Rk 01",exact:true}).waitFor();
    const rk=await prisma.auditFinding.findFirstOrThrow({where:{auditId:audit.id,reference:"Rk 01"}});
    let card=page.locator(`#audit-finding-${obs.id}`);
    await card.locator("summary").filter({hasText:"Ver / editar hallazgo"}).click();
    form=card.locator(".audit-child-form").first(); await form.locator('[name="description"]').fill(`OBS editada ${marker}`); await form.locator('[name="sortOrder"]').fill("30"); await saveChild(page,form,"Guardar"); await page.locator("p.prose-value").filter({hasText:`OBS editada ${marker}`}).waitFor();
    assert.equal((await prisma.auditFinding.findUniqueOrThrow({where:{id:obs.id}})).reference,"OBS 01");
    card=page.locator(`#audit-finding-${obs.id}`); await card.locator("summary").filter({hasText:"+ Añadir acción"}).click();
    form=card.locator("details").filter({has:page.locator('summary', {hasText:"+ Añadir acción"})}).last().locator(".audit-child-form");
    await form.locator('[name="description"]').fill("Acción UI persistente"); await form.locator('[name="responsible"]').fill("Responsable ficticio"); await form.locator('[name="status"]').selectOption("CLOSED");
    await form.getByRole("button",{name:"Guardar acción",exact:true}).click(); await form.getByRole("alert").waitFor();
    assert.equal(await form.locator('[name="description"]').inputValue(),"Acción UI persistente"); assert.equal(await form.locator('[name="responsible"]').inputValue(),"Responsable ficticio"); assert.equal(await form.locator('[name="status"]').inputValue(),"CLOSED");
    await form.locator('[name="closedAt"]').fill("2026-10-07"); await form.locator('[name="evidenceReference"]').fill("REF-UI"); await saveChild(page,form,"Guardar acción"); await page.getByRole("heading",{name:"Acción UI persistente",exact:true}).waitFor();
    const action=await prisma.auditFindingAction.findFirstOrThrow({where:{findingId:obs.id}}); assert.equal(action.status,"CLOSED");
    const link=async(findingId:string,type:"CAPA"|"DEVIATION",code:string)=>{
      await view(page,`/audits/${audit.id}?tab=findings`);const c=page.locator(`#audit-finding-${findingId}`);await c.locator("summary").filter({hasText:"Vincular Desviación / CAPA existente"}).click();const r=c.locator(".relation-form");await r.locator('[name="recordType"]').selectOption(type);await r.getByRole("combobox",{name:"Buscar expediente existente",exact:true}).fill(code);await r.getByRole("option").filter({hasText:code}).click();await r.getByRole("button",{name:"Vincular al hallazgo",exact:true}).click();await c.getByText("Expediente vinculado al hallazgo.",{exact:true}).waitFor();
    };
    await link(obs.id,"CAPA",capa.q.businessCode!); await link(rk.id,"CAPA",capa.q.businessCode!); await link(obs.id,"DEVIATION",deviation.q.businessCode!);
    assert.equal(await prisma.qmsRelation.count({where:{sourceRecordId:audit.qmsRecordId,targetRecordId:capa.q.id}}),1);
    await view(page,`/capa/${capa.entity.id}?tab=relations`);await page.locator(".audit-origin-panel").getByRole("link",{name:"OBS 01",exact:true}).click();await page.waitForURL(new RegExp(`audit-finding-${obs.id}`)); await page.locator(`#audit-finding-${obs.id}`).waitFor();
    await view(page,`/deviations/${deviation.entity.id}?tab=relations`);assert(await page.locator(".audit-origin-panel").getByRole("link",{name:"OBS 01",exact:true}).count());
    await view(page,`/audits/${audit.id}?tab=followup`);await page.locator("summary").filter({hasText:"+ Añadir seguimiento"}).click();form=page.locator(".audit-child-form").first();await form.locator('[name="followupDate"]').fill("2026-10-07");await form.locator('[name="completedByText"]').fill("Responsable UI");await form.locator('[name="description"]').fill("Seguimiento general UI");await form.locator('[name="nextReviewDate"]').fill("2026-11-10");await saveChild(page,form,"Guardar seguimiento");await page.locator("p.prose-value").filter({hasText:/^Seguimiento general UI$/}).waitFor();
    await page.locator("summary").filter({hasText:"+ Añadir seguimiento"}).click();form=page.locator(".audit-child-form").first();await form.locator('[name="findingId"]').selectOption(obs.id);await form.locator('[name="followupDate"]').fill("2026-10-08");await form.locator('[name="completedByText"]').fill("Responsable OBS UI");await form.locator('[name="description"]').fill("Seguimiento OBS UI");await saveChild(page,form,"Guardar seguimiento");await page.locator("p.prose-value").filter({hasText:/^Seguimiento OBS UI$/}).waitFor();
    for(const width of [1440,768,390]) {
      await page.setViewportSize({width,height:1000});
      await view(page,`/audits/${audit.id}?tab=information`);
      const info=page.locator(".audit-info-layout");
      assert.equal(await info.locator(".audit-info-section").count(),5,"La ficha organiza información y participantes en cinco bloques");
      for(const heading of ["Información","Alcance y referencias","Entidades y áreas","Fechas y control","Equipo y participantes"]) {
        assert.equal(await info.getByRole("heading",{name:heading,exact:true}).count(),1,`Falta bloque ${heading}`);
      }
      assert.equal(await page.locator("#review-audit-scope").count()>0,true,"El anclaje de alcance no debe desaparecer");
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,`Información desborda ${width}`);

      for(const tab of ["findings","followup","relations"]) {
        await view(page,`/audits/${audit.id}?tab=${tab}`);await page.getByRole("heading",{name:tab==="findings"?"Hallazgos y CAPA Plan":tab==="followup"?"Seguimiento":"Relaciones",exact:true}).waitFor();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,`${tab} desborda ${width}`);
        if(tab==="findings") {await page.locator(`#audit-finding-${obs.id}`).locator("summary").filter({hasText:"Ver / editar hallazgo"}).click();for(const field of await page.locator(".audit-child-form input:not([type=hidden]), .audit-child-form select, .audit-child-form textarea").all()){const b=await field.boundingBox();if(b)assert(b.x>=0&&b.x+b.width<=width+2,`Campo fuera de ${width}`);}}
      }
    }
    await view(page,`/audits?q=${encodeURIComponent(marker)}&findings=yes&relatedCapa=yes&criticality=MAJOR`);await page.locator("#audit-list-table").waitFor();assert.equal(await page.locator("#audit-list-table tbody tr").count(),1);await page.locator(".column-menu summary").click();await page.locator(".column-menu").getByRole("checkbox",{name:"Nº hallazgos",exact:true}).check();await page.locator('td[data-column-key="findings"]').waitFor({state:"visible"});assert.equal(await page.locator('td[data-column-key="findings"]').innerText(),"1");
    // Retirement/withdrawal must refresh the dynamic detail after the transaction completes.
    await view(page,`/audits/${audit.id}?tab=findings`);
    card=page.locator(`#audit-finding-${obs.id}`);
    let relationCard=card.locator(".relation-card").filter({hasText:deviation.q.businessCode!});
    await relationCard.locator("summary").filter({hasText:"Retirar atribución"}).click();
    form=relationCard.locator("form");await form.locator('[name="reason"]').fill("Atribución UI retirada");await saveChild(page,form,"Retirar solo atribución");
    assert.equal(await page.locator(`#audit-finding-${obs.id}`).locator(".relation-card").filter({hasText:deviation.q.businessCode!}).count(),0);
    assert.equal((await prisma.qmsRelation.findFirstOrThrow({where:{sourceRecordId:audit.qmsRecordId,targetRecordId:deviation.q.id}})).isActive,true);
    await view(page,`/audits/${audit.id}?tab=relations`);
    relationCard=page.locator("article.relation-card").filter({hasText:deviation.q.businessCode!});await relationCard.locator("summary").click();
    form=relationCard.locator("form");await form.locator('[name="reason"]').fill("Vínculo global UI retirado");await saveChild(page,form,"Desvincular globalmente");
    assert.equal(await page.locator("article.relation-card").filter({hasText:deviation.q.businessCode!}).count(),0);
    assert.equal((await prisma.qmsRelation.findFirstOrThrow({where:{sourceRecordId:audit.qmsRecordId,targetRecordId:deviation.q.id}})).isActive,false);
    await view(page,`/audits/${audit.id}?tab=findings`);
    const actionCard=page.locator(`#audit-action-${action.id}`);await actionCard.locator("summary").filter({hasText:"Editar acción"}).click();await actionCard.locator("summary").filter({hasText:/^Retirar acción$/}).click();
    form=actionCard.locator("form").filter({has:page.getByRole("button",{name:"Retirar acción",exact:true})});await form.locator('[name="reason"]').fill("Acción UI retirada");await saveChild(page,form,"Retirar acción");
    assert.equal(await page.locator(`#audit-action-${action.id}`).count(),0);assert.equal((await prisma.auditFindingAction.findUniqueOrThrow({where:{id:action.id}})).isActive,false);
    await view(page,`/audits/${audit.id}?tab=findings`);card=page.locator(`#audit-finding-${obs.id}`);await card.locator("summary").filter({hasText:"Ver / editar hallazgo"}).click();await card.locator("summary").filter({hasText:/^Retirar hallazgo$/}).click();form=card.locator("form").filter({has:page.getByRole("button",{name:"Retirar hallazgo",exact:true})});await form.locator('[name="reason"]').fill("Retirada UI ficticia");await saveChild(page,form,"Retirar hallazgo");await page.locator(`#audit-finding-${obs.id}`).waitFor({state:"detached"});await page.reload();await page.waitForLoadState("networkidle");assert.equal(await page.getByRole("heading",{name:"OBS 01",exact:true}).count(),0);await page.getByRole("link",{name:"Mostrar retirados",exact:true}).click();await page.getByRole("heading",{name:"OBS 01 · Retirado",exact:true}).waitFor();
    await view(page,`/audits/${audit.id}?tab=history`);await page.getByText("Retirada UI ficticia",{exact:true}).waitFor();assert(await page.getByRole("button",{name:"Cerrar auditoría",exact:true}).isDisabled());assert.equal(await page.getByRole("link",{name:"Revisión",exact:true}).count(),1);assert.deepEqual(errors,[]);
    console.log("R3B UI OK: alta/edición OBS/Rk, acción/cierre/error conservado, buscador UUID compartido, inversa CAPA/Desviación, seguimiento, filtros/columnas, retirada/historial, 1440/768/390, UTC/Madrid sin hidratación.");
  } catch(e) {console.error("R3B UI errors",errors);console.error("R3B UI URL",page.url());console.error(await page.evaluate(()=>Array.from(document.querySelectorAll("body *")).filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.x<0||r.right>innerWidth+2);}).slice(0,20).map(e=>({tag:e.tagName,class:e.className,width:e.getBoundingClientRect().width}))));console.error(await page.locator("main").ariaSnapshot().catch(()=>"Sin snapshot"));throw e;} finally {await browser.close();}
}
main().finally(async()=>{
  const ids=(await prisma.audit.findMany({where:{qmsRecordId:{in:records}},select:{id:true}})).map(a=>a.id);
  await prisma.auditFindingRelation.deleteMany({where:{finding:{auditId:{in:ids}}}});await prisma.auditFollowup.deleteMany({where:{auditId:{in:ids}}});await prisma.auditFindingAction.deleteMany({where:{finding:{auditId:{in:ids}}}});await prisma.auditFinding.deleteMany({where:{auditId:{in:ids}}});await prisma.qmsRelation.deleteMany({where:{OR:[{sourceRecordId:{in:records}},{targetRecordId:{in:records}}]}});await prisma.changeHistory.deleteMany({where:{qmsRecordId:{in:records}}});await prisma.qmsRecordVersion.deleteMany({where:{qmsRecordId:{in:records}}});await prisma.auditParticipant.deleteMany({where:{auditId:{in:ids}}});await prisma.auditDepartment.deleteMany({where:{auditId:{in:ids}}});await prisma.audit.deleteMany({where:{id:{in:ids}}});await prisma.capa.deleteMany({where:{qmsRecordId:{in:records}}});await prisma.deviation.deleteMany({where:{qmsRecordId:{in:records}}});await prisma.qmsRecord.deleteMany({where:{id:{in:records}}});await prisma.$disconnect();
}).catch(e=>{console.error(e);process.exitCode=1;});
