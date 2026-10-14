import assert from "node:assert/strict";
import { chromium,authenticatedPage } from "../auth-fixtures/browser";
import { authConfiguration,isolatedTestEnvironment } from "../../src/lib/auth/config";
import { fixtureUsers } from "../auth-fixtures/constants";

async function main(){
  assert(isolatedTestEnvironment());
  const fixtures=JSON.parse(process.env.C_AUDIT_FIXTURES!) as Array<{id:string;path:string;module:string}>;
  assert.equal(fixtures.length,7);
  const base=authConfiguration().origin,browser=await chromium.launch({headless:true});
  const reader=await authenticatedPage(browser,"reader"),qa=await authenticatedPage(browser),admin=await authenticatedPage(browser,"admin");
  const errors:string[]=[];for(const page of [reader,qa,admin]){page.setDefaultTimeout(15000);page.on("pageerror",error=>errors.push(error.message));}
  try{
    for(const fixture of fixtures){
      const response=await reader.goto(`${base}/${fixture.path}/${fixture.id}?tab=audit-trail`);assert(response?.ok(),fixture.module);
      await reader.locator(".audit-trail-operation").first().waitFor();
      assert.equal(await reader.locator('main form:has(input[name="_covexCsrf"])').count(),0,fixture.module+" read-only");
      assert(await reader.locator(".audit-trail-operation-meta").first().innerText().then(text=>text.includes(fixtureUsers.qa.name)));
    }
    assert((await reader.goto(base+"/audit-trail"))?.ok());
    assert.equal(await reader.getByRole("button",{name:"Exportar selección filtrada"}).count(),0);
    assert.equal(await reader.locator('input[name="operationId"]').count(),0);
    assert.equal(await reader.locator('select[name="sensitive"]').count(),0);
    assert((await admin.goto(base+"/audit-trail"))?.ok());
    assert.equal(await admin.getByRole("button",{name:"Exportar selección filtrada"}).count(),0);
    assert.equal(await admin.locator('input[name="operationId"]').count(),0);
    assert((await qa.goto(base+"/audit-trail?module=DEVIATION"))?.ok());
    await qa.locator('input[name="operationId"]').first().check();
    await qa.locator('select[name="result"]').selectOption("NO_OBSERVATIONS");
    await qa.locator('textarea[name="notes"]').fill("Synthetic browser review receipt");
    await qa.getByRole("button",{name:"Registrar revisión seleccionada"}).click();
    await qa.waitForURL(/reviewed=/);await qa.getByRole("status").waitFor();
    assert((await qa.goto(base+"/audit-trail?module=DEVIATION&review=REVIEWED"))?.ok());
    assert(await qa.locator(".audit-trail-operation").count()>0);
    const downloadPromise=qa.waitForEvent("download");
    await qa.getByRole("button",{name:"Exportar selección filtrada"}).click();
    const download=await downloadPromise;assert.equal(await download.failure(),null);assert(download.suggestedFilename().endsWith(".csv"));
    assert((await qa.goto(base+"/audit-trail?sensitive=1"))?.ok());assert(await qa.locator(".audit-trail-operation").count()>0);
    await reader.goto(base+"/audit-trail?sensitive=1");await reader.waitForURL(/login\?error=access/);assert.equal(await reader.locator(".audit-trail-operation").count(),0);
    assert.deepEqual(errors,[]);
    console.log("C browser OK: seven record tabs/global read, reader/IT separation, corporate actor, QA exact review, filter and controlled CSV download, sensitive denial, no browser errors");
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
