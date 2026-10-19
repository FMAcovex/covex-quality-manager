import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "./auth-fixtures/browser";
import { type Page, type Locator } from "playwright";
import { prisma } from "../src/lib/db";
import { saveAuditFinding, saveAuditFindingAction, retireAuditElement } from "../src/modules/audits/finding-service";
import { readAuditSnapshot } from "../src/modules/audits/report-service";
import { installSyntheticAuditTemplates, cleanupAuditR3cFixtures } from "./audits-r3c-fixtures";
const base=process.env.R3C_UI_BASE_URL,marker=`R3C-UI-${randomUUID()}`, records:string[]=[],templates:string[]=[];
async function view(page:Page,path:string){const url=`${base}${path}`;if(page.url()===url)await page.reload();else await page.goto(url);await page.waitForLoadState('networkidle');}
async function save(page:Page,form:Locator,label:string){await page.waitForLoadState('networkidle');await Promise.all([page.waitForEvent('framenavigated',frame=>frame===page.mainFrame()),form.getByRole('button',{name:label,exact:true}).click()]);await page.waitForLoadState('networkidle');}
async function main(){
 if(process.env.APP_ENV!=='test'||!base)throw new Error('APP_ENV=test y R3C_UI_BASE_URL obligatorios para servidor/BD de test.');
 if(process.env.R3C_OFFICIAL_TEMPLATES!=='1')templates.push(...await installSyntheticAuditTemplates());
 const browser=await chromium.launch({executablePath:process.env.R3C_UI_CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'Europe/Madrid'}),errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/hydrat|server rendered/i.test(m.text()))errors.push(m.text());});
 try{
  await view(page,'/audits/new');await page.getByLabel('Objeto / título').fill(marker);await page.locator('[name="auditType"]').selectOption('INTERNAL');await page.locator('[name="scenario"]').selectOption('INTERNAL_COVEX');
  const department=await prisma.department.findUniqueOrThrow({where:{code:'GC-00'}});await page.locator(`input[name="departmentIds"][value="${department.id}"]`).check();await page.locator('[name="codingDepartmentId"]').selectOption(department.id);await page.locator('[name="scope"]').fill('Alcance ficticio de navegador R3C');await page.locator('[name="plannedDate"]').fill('2096-11-15');await page.locator('[name="performedDate"]').fill('2096-11-15');await page.locator('[name="status"]').selectOption('OPEN');
  await page.getByRole('button',{name:'+ Participante',exact:true}).click();await page.getByLabel('Nombre y apellidos').fill('Auditor ficticio R3C');
  await save(page,page.locator('.audit-form'),'Guardar auditoría');await page.waitForURL(/\/audits\/[a-f0-9-]+$/);await page.waitForLoadState('networkidle');
  const audit=await prisma.audit.findFirstOrThrow({where:{title:marker}});records.push(audit.qmsRecordId);
  const obs=await saveAuditFinding(audit.id,{actor:'Smoke UI',findingType:'FINDING',criticality:'MINOR',description:'OBS histórica UI',treatment:'Acción local'});
  const rk=await saveAuditFinding(audit.id,{actor:'Smoke UI',findingType:'RECOMMENDATION',description:'Rk histórica UI',treatment:'No procede',treatmentStatus:'NOT_APPLICABLE',evidence:'Justificación UI'});
  const action=await saveAuditFindingAction(audit.id,obs.id,{actor:'Smoke UI',description:'Acción UI',status:'OPEN'});
  // D-110 (R5C1): establecer el CAPA plan (versión 00) desde Seguimiento, sin informe emitido.
  await view(page,`/audits/${audit.id}?tab=followup`);const planCard=()=>page.locator('section.card').filter({has:page.getByRole('heading',{name:'CAPA plan',exact:true})});
  const planForm=planCard().locator('form');await planForm.locator('[name="capaPlanDate"]').fill('2096-11-15');await save(page,planForm,'Establecer CAPA plan (versión 00)');
  await planCard().getByText('Versión vigente 00').waitFor();assert.equal(await planCard().getByRole('button',{name:'Establecer CAPA plan (versión 00)'}).count(),0);
  assert.equal(await prisma.auditCapaPlanVersion.count({where:{auditId:audit.id}}),1);
  // R5C2: seguimiento del CAPA plan. Un error conserva lo escrito; después se emite la versión 01.
  await planCard().locator('summary').filter({hasText:'Registrar seguimiento del CAPA plan'}).click();
  let followupForm=planCard().locator('form.capa-plan-followup');
  await followupForm.locator(`[name="a.${action.id}.status"]`).selectOption('CLOSED');await followupForm.locator('[name="changeReason"]').fill('Cierre UI sin fecha');
  await followupForm.getByRole('button',{name:'Registrar seguimiento',exact:true}).click();
  await followupForm.getByRole('alert').filter({hasText:/fecha/}).waitFor();followupForm=planCard().locator('form.capa-plan-followup');
  assert.equal(await followupForm.locator(`[name="a.${action.id}.status"]`).inputValue(),'CLOSED');assert.equal(await followupForm.locator('[name="changeReason"]').inputValue(),'Cierre UI sin fecha');
  await followupForm.locator(`[name="a.${action.id}.status"]`).selectOption('IN_PROGRESS');await followupForm.locator('[name="changeReason"]').fill('');await followupForm.locator('[name="observations"]').fill('Revisión UI del CAPA plan');
  await save(page,followupForm,'Registrar seguimiento');await planCard().getByText('Versión vigente 01').waitFor();
  assert.equal((await prisma.auditFindingAction.findUniqueOrThrow({where:{id:action.id}})).status,'IN_PROGRESS');
  assert.equal((await prisma.auditCapaPlanVersion.findFirstOrThrow({where:{auditId:audit.id,sequenceNumber:1}})).observations,'Revisión UI del CAPA plan');
  await view(page,`/audits/${audit.id}?tab=versions`);const planVersions=page.locator('section.card').filter({has:page.getByRole('heading',{name:'CAPA plan',exact:true})});
  const [planDownload]=await Promise.all([page.waitForEvent('download'),planVersions.getByRole('link',{name:'CAPA plan · 00',exact:true}).click()]);assert.equal(await planDownload.failure(),null);assert.match(planDownload.suggestedFilename(),/_CAPA_PLAN_00\.xlsx$/);
  await view(page,`/audits/${audit.id}?tab=report`);let form=page.locator('form').filter({has:page.locator('[name="reportDate"]')});await form.locator('[name="reportDate"]').fill('2096-11-16');await form.locator('[name="conclusion"]').fill('Conclusión UI versión 00');await form.locator('[name="programme"]').fill('09:00 | Revisión documental');await save(page,form,'Guardar datos del informe');await page.waitForLoadState('networkidle');assert.equal((await prisma.audit.findUniqueOrThrow({where:{id:audit.id}})).conclusion,'Conclusión UI versión 00');
  await view(page,`/audits/${audit.id}?tab=versions`);form=page.locator('form').filter({has:page.getByRole('button',{name:'Emitir informe inicial 00',exact:true})});await save(page,form,'Emitir informe inicial 00');await page.getByRole('heading',{name:'Versión 00',exact:true}).waitFor();
  const v00=await prisma.qmsRecordVersion.findFirstOrThrow({where:{qmsRecordId:audit.qmsRecordId,sequenceNumber:0}}),snapshot00=JSON.stringify(v00.snapshot);
  let section=page.locator('section.card').filter({has:page.getByRole('heading',{name:'Versión 00',exact:true})});
  // D-110 (R5C2): la versión del informe ya no ofrece su propio A4.03.
  assert.equal(await section.getByRole('link',{name:'CAPA Plan · 00',exact:true}).count(),0);
  for(const label of ['Informe de Auditoría Interna · 00']){const [download]=await Promise.all([page.waitForEvent('download'),section.getByRole('link',{name:label,exact:true}).click()]);assert.equal(await download.failure(),null);}
  const signedForm=section.locator('form');await signedForm.locator('[name="file"]').setInputFiles({name:'firmado-00.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\n% Fixture firmado 00')});await save(page,signedForm,'Cargar PDF firmado de esta versión');await page.getByRole('link',{name:'Descargar PDF firmado · 00',exact:true}).waitFor();
  await view(page,`/audits/${audit.id}?tab=findings&review=1`);await page.locator(`#audit-finding-${obs.id} > .review-marker`).click();let drawer=page.locator('.review-drawer');let reviewForm=drawer.locator('.review-form').last();await reviewForm.locator('textarea').fill('Comentario UI histórico sobre OBS');await reviewForm.getByRole('button',{name:'Crear observación',exact:true}).click();await drawer.locator('.review-message').getByText('Comentario UI histórico sobre OBS',{exact:true}).waitFor();
  const thread=await prisma.reviewThread.findFirstOrThrow({where:{qmsRecordId:audit.qmsRecordId,targetEntityId:obs.id}});assert.equal(thread.recordVersionId,v00.id);
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.locator(`#audit-action-${action.id} > .review-marker`).click();drawer=page.locator('.review-drawer');reviewForm=drawer.locator('.review-form').last();await reviewForm.locator('textarea').fill('Comentario UI sobre acción UUID');await reviewForm.getByRole('button',{name:'Crear observación',exact:true}).click();await drawer.locator('.review-message').getByText('Comentario UI sobre acción UUID',{exact:true}).waitFor();await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  await view(page,`/audits/${audit.id}?tab=findings`);const actionCard=page.locator(`#audit-action-${action.id}`);await actionCard.getByRole('link',{name:'Editar',exact:true}).click();form=actionCard.locator('.audit-child-form').first();await form.waitFor();await form.locator('[name="status"]').selectOption('CLOSED');await form.locator('[name="closedAt"]').fill('2096-11-17');await form.locator('[name="evidence"]').fill('Evidencia de eficacia UI');await form.locator('[name="verificationResult"]').selectOption('CONFORMING');await form.locator('[name="verifiedAt"]').fill('2096-11-17');await form.locator('[name="verifiedBy"]').fill('QA ficticio UI');await save(page,form,'Guardar');await page.waitForLoadState('networkidle');assert.equal((await prisma.auditFindingAction.findUniqueOrThrow({where:{id:action.id}})).verificationResult,'CONFORMING');
  await view(page,`/audits/${audit.id}?tab=report`);form=page.locator('form').filter({has:page.locator('[name="reportDate"]')});await form.locator('[name="conclusion"]').fill('Conclusión UI versión 01');await save(page,form,'Guardar datos del informe');
  await retireAuditElement(audit.id,rk.id,{actor:'Smoke UI',reason:'Retirada posterior a 00'});
  await view(page,`/audits/${audit.id}?tab=versions`);form=page.locator('form').filter({has:page.getByRole('button',{name:'Emitir nueva versión del informe',exact:true})});await form.locator('[name="reason"]').fill('Revisión formal UI');await save(page,form,'Emitir nueva versión del informe');await page.getByRole('heading',{name:'Versión 01',exact:true}).waitFor();
  const v01=await prisma.qmsRecordVersion.findFirstOrThrow({where:{qmsRecordId:audit.qmsRecordId,sequenceNumber:1}});assert.equal(JSON.stringify((await prisma.qmsRecordVersion.findUniqueOrThrow({where:{id:v00.id}})).snapshot),snapshot00);assert.equal(readAuditSnapshot(v01.snapshot).audit.conclusion,'Conclusión UI versión 01');
  section=page.locator('section.card').filter({has:page.getByRole('heading',{name:'Versión 01',exact:true})});await section.locator('[name="file"]').setInputFiles({name:'firmado-01.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\n% Fixture firmado 01')});await save(page,section.locator('form'),'Cargar PDF firmado de esta versión');await page.getByRole('link',{name:'Descargar PDF firmado · 01',exact:true}).waitFor();assert.equal(await prisma.recordVersionDocument.count({where:{recordVersion:{qmsRecordId:audit.qmsRecordId}}}),2);
  await view(page,`/audits/${audit.id}?tab=review&review=1&reviewVersion=${v00.id}`);const card=page.locator('.review-thread-card').filter({hasText:'Comentario UI histórico sobre OBS'});await card.getByRole('link',{name:'Ir al campo',exact:true}).click();await page.locator(`#audit-finding-${obs.id}.review-target-highlight`).waitFor();assert.equal(new URL(page.url()).searchParams.get('tab'),'findings');await page.reload();await page.locator(`#audit-finding-${obs.id}.review-target-highlight`).waitFor();
  await retireAuditElement(audit.id,obs.id,{actor:'Smoke UI',reason:'Retirado para probar target histórico'});await view(page,`/audits/${audit.id}?tab=findings&review=1&thread=${thread.id}#audit-finding-${obs.id}`);await page.locator(`#audit-finding-${obs.id}`).getByRole('heading',{name:/OBS 01 · Retirado/}).waitFor();
  for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});for(const tab of ['versions','documents','review','findings','report']){await view(page,`/audits/${audit.id}?tab=${tab}&review=1`);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2),false,`${tab} desborda a ${width}px`);}}
  // Keep an active, justified element while consulting the retired historical target.
  const remaining=await saveAuditFinding(audit.id,{actor:'Smoke UI',findingType:'FINDING',criticality:'MINOR',description:'OBS de cierre',treatment:'No procede documentado',treatmentStatus:'NOT_APPLICABLE',evidence:'Justificación final'});assert(remaining.id);
  await view(page,`/audits/${audit.id}?tab=report`);form=page.locator('form').filter({has:page.locator('[name="closedAt"]')});await form.locator('[name="closedAt"]').fill('2096-11-20');await save(page,form,'Confirmar cierre definitivo');await page.getByText('Cerrada · 20/11/2096',{exact:true}).waitFor();assert.equal((await prisma.audit.findUniqueOrThrow({where:{id:audit.id}})).status,'CLOSED');
  assert.equal((await prisma.reviewThread.findUniqueOrThrow({where:{id:thread.id}})).recordVersionId,v00.id);assert.deepEqual(errors,[]);
  console.log('R3C UI OK: alta/apertura real, informe 00/01, documentos/descargas, PDF por versión, Review OBS/acción UUID e histórico/deep link/retirado, cierre backend, 1440/768/390 Madrid sin errores JS/hidratación.');
 } catch(e){console.error('R3C UI failure URL:',page.url());console.error(errors);console.error(await page.locator('main').ariaSnapshot().catch(()=>''));throw e;}
 finally{await browser.close();await cleanupAuditR3cFixtures(records,templates);}
}
main().finally(()=>prisma.$disconnect()).catch(e=>{console.error(e);process.exitCode=1;});
