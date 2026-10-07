import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium, type Page } from "playwright";
import { prisma } from "../src/lib/db";

const base = process.env.R3A_UI_BASE_URL, marker = `R3A-UI-${randomUUID()}`;
// Wait before filling controlled fields, as well as before submitting them.
async function navigate(page: Page, url: string) { await page.goto(url); await page.waitForLoadState("networkidle"); }
async function submit(page: Page) { await page.waitForLoadState("networkidle"); await page.getByRole("button",{name:"Guardar auditoría",exact:true}).click(); }
async function main() {
  if (!base || process.env.APP_ENV !== "test") throw new Error("Define APP_ENV=test y R3A_UI_BASE_URL para servidor y BD aislados.");
  const browser = await chromium.launch({executablePath:process.env.R3A_UI_CHROMIUM_PATH || undefined,args:["--no-sandbox"]});
  const page = await browser.newPage({viewport:{width:1440,height:1000},timezoneId:"Europe/Madrid"}), errors:string[]=[];
  // GitHub Actions can take more than Playwright\'s 30 s navigation default while a Server Action persists and redirects.\n  // Keep all assertions unchanged; only give the existing navigation checks enough headroom on a cold CI runner.\n  page.setDefaultTimeout(60_000);\n  page.setDefaultNavigationTimeout(90_000);\n  page.on("pageerror",error=>errors.push(error.message));
  page.on("console", message => { if (message.type() === "error" && /hydrat|server rendered/i.test(message.text())) errors.push(message.text()); });
  try {
    await navigate(page,`${base}/audits/new`);
    await page.getByLabel("Objeto / título").fill(marker);
    await submit(page); await page.waitForURL(/\/audits\/[a-f0-9-]+$/);
    const audit = await prisma.audit.findFirstOrThrow({where:{title:marker}});
    await page.getByRole("link",{name:"Editar",exact:true}).click();
    await page.waitForURL(new RegExp(`/audits/${audit.id}/edit$`)); await page.waitForLoadState("networkidle");
    await page.locator('select[name="auditType"]').selectOption("INTERNAL");
    await page.locator('select[name="scenario"]').selectOption("INTERNAL_COVEX");
    const department = await prisma.department.findUniqueOrThrow({where:{code:"GC-00"}});
    await page.locator(`input[name=departmentIds][value="${department.id}"]`).check();
    assert.equal(await page.getByLabel("Área/departamento de referencia para codificación").inputValue(),department.id);
    await page.getByRole("button",{name:"+ Participante",exact:true}).click();
    await page.getByLabel("Nombre y apellidos").fill("Auditor UI ficticio");
    await page.getByLabel("Fecha prevista",{exact:true}).fill("2096-11-10");
    await page.getByLabel("Realizado por",{exact:true}).fill("Actor UI conservado");
    await page.locator('select[name="modality"]').selectOption("REMOTE");
    await page.locator('select[name="status"]').selectOption("OPEN");
    await submit(page); await page.locator(".form-errors").waitFor();
    assert.equal(await page.getByLabel("Objeto / título").inputValue(),marker);
    assert.equal(await page.getByLabel("Nombre y apellidos").inputValue(),"Auditor UI ficticio");
    assert(await page.locator(`input[name=departmentIds][value="${department.id}"]`).isChecked());
    assert.equal(await page.getByLabel("Fecha prevista",{exact:true}).inputValue(),"2096-11-10");
    assert.equal(await page.getByLabel("Realizado por",{exact:true}).inputValue(),"Actor UI conservado");
    assert.equal(await page.locator('select[name="modality"]').inputValue(),"REMOTE");
    await page.locator('textarea[name="scope"]').fill("Alcance UI ficticio");
    await submit(page); await page.waitForURL(new RegExp(`/audits/${audit.id}$`));
    const opened = await prisma.audit.findUniqueOrThrow({where:{id:audit.id},include:{qmsRecord:true,participants:true,departments:true}});
    assert.match(opened.qmsRecord.businessCode!,/^AI\/GC-00\/\d{2}\/2096$/);
    assert(await page.getByRole("button",{name:"Cerrar auditoría",exact:true}).isDisabled());
    assert.equal(await page.getByRole("link",{name:"Revisión",exact:true}).count(),0);
    await navigate(page,`${base}/qms/${opened.qmsRecordId}`); await page.waitForURL(new RegExp(`/audits/${audit.id}$`));
    for (const width of [1440,768,390]) {
      await page.setViewportSize({width,height:1000});
      await navigate(page,`${base}/audits/${audit.id}/edit`);
      assert.equal(await page.getByLabel("Nombre y apellidos").inputValue(),"Auditor UI ficticio");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      assert.equal(overflow,false,`Formulario desborda a ${width}px`);
      for (const field of await page.locator(".audit-form input:not([type=hidden]), .audit-form select, .audit-form textarea").all()) {
        const box = await field.boundingBox(); if (box) assert(box.x >= 0 && box.x + box.width <= width + 2, `Campo fuera de viewport ${width}px`);
      }
      await navigate(page,`${base}/audits?q=${encodeURIComponent(marker)}`);
      await page.locator("#audit-list-table").waitFor(); assert.equal(await page.locator("#audit-list-table tbody tr").count(),1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2),false,`Listado desborda a ${width}px`);
    }
    await page.locator(".column-menu summary").click();
    await page.locator(".column-menu").getByRole("checkbox",{name:"Modalidad",exact:true}).check();
    await page.locator("td[data-column-key=modality]").waitFor({state:"visible"});
    assert(await page.locator("td[data-column-key=modality]").isVisible());
    await page.reload();
    await page.locator("#audit-list-table").waitFor();
    await page.waitForFunction(() => Array.from(document.querySelectorAll(".column-options label")).some(label => label.textContent?.trim() === "Modalidad" && label.querySelector<HTMLInputElement>("input")?.checked));
    assert(await page.locator("td[data-column-key=modality]").isVisible());
    // A scenario change keeps conditional form values, including after a rejected save.
    await navigate(page,`${base}/audits/new`);
    await page.getByLabel("Objeto / título").fill(`${marker}-conditional`);
    await page.locator('select[name="auditType"]').selectOption("EXTERNAL");
    await page.locator('select[name="scenario"]').selectOption("SUPPLIER");
    await page.getByLabel("Entidad auditada / proveedor").fill("Proveedor conservado");
    await page.getByLabel("Dirección / lugar").fill("Dirección conservada");
    await page.locator('select[name="scenario"]').selectOption("CLIENT");
    await page.locator('select[name="scenario"]').selectOption("SUPPLIER");
    assert.equal(await page.getByLabel("Entidad auditada / proveedor").inputValue(),"Proveedor conservado");
    assert.equal(await page.getByLabel("Dirección / lugar").inputValue(),"Dirección conservada");
    await navigate(page,`${base}/audits/${audit.id}`);
    await page.getByRole("button",{name:"Anular expediente",exact:true}).click();
    await page.getByLabel("Motivo",{exact:true}).fill("Anulación UI de fixture");
    await page.locator('[role="dialog"]').getByRole("button",{name:"Anular expediente",exact:true}).click();
    await page.getByText("Expediente anulado",{exact:true}).waitFor();
    await navigate(page,`${base}/audits?q=${encodeURIComponent(marker)}`); await page.locator("#audit-list-table").waitFor(); assert.equal(await page.locator("#audit-list-table tbody tr").count(),0);
    await navigate(page,`${base}/audits?q=${encodeURIComponent(marker)}&administrative=ANNULLED`); await page.locator("#audit-list-table").waitFor(); assert.equal(await page.locator("#audit-list-table tbody tr").count(),1);
    await navigate(page,`${base}/audits/${audit.id}?tab=history`); assert(await page.getByText("Anulación UI de fixture",{exact:true}).count());
    assert.deepEqual(errors,[]);
    console.log("R3A UI: alta/edición/apertura, valores tras error y escenario, UUID, resolver, ColumnSelector, administración e historial; responsive 1440/768/390px sin errores JS/hidratación OK.");
  } catch (error) {
    console.error("R3A UI failure URL:", page.url());
    console.error(await page.evaluate(() => Array.from(document.querySelectorAll("body *")).filter(e => { const r=e.getBoundingClientRect(); return r.width && (r.x < 0 || r.right > window.innerWidth + 2); }).slice(0,15).map(e => ({tag:e.tagName,class:e.className,width:e.getBoundingClientRect().width}))));
    console.error(await page.locator("main").ariaSnapshot().catch(() => "No snapshot"));
    throw error;
  } finally { await browser.close(); }
}
main().finally(async()=>{
  const audits=await prisma.audit.findMany({where:{title:{startsWith:marker}},select:{id:true,qmsRecordId:true}}),ids=audits.map(a=>a.id),records=audits.map(a=>a.qmsRecordId);
  await prisma.auditParticipant.deleteMany({where:{auditId:{in:ids}}}); await prisma.auditDepartment.deleteMany({where:{auditId:{in:ids}}}); await prisma.changeHistory.deleteMany({where:{qmsRecordId:{in:records}}}); await prisma.audit.deleteMany({where:{id:{in:ids}}}); await prisma.qmsRecord.deleteMany({where:{id:{in:records}}}); await prisma.$disconnect();
}).catch(error=>{console.error(error);process.exitCode=1;});
