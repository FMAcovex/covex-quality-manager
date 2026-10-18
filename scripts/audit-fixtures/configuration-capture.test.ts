import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { isolatedTestEnvironment } from "../../src/lib/auth/config";
import { identityContext, type Principal } from "../../src/lib/auth/context";
import { fixtureUsers } from "../auth-fixtures/constants";

vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("server-only",()=>({}));
const url=new URL(process.env.DATABASE_URL!), inspectorUrl=new URL(process.env.B2_CAPTURE_INSPECTOR_URL!);
if(!isolatedTestEnvironment()||!["localhost","127.0.0.1"].includes(url.hostname)||url.pathname!==inspectorUrl.pathname||!/^\/covex_phase4b1_test_b2_capture_[a-f0-9]+$/.test(url.pathname)) throw Error("Own disposable capture fixture required");
const inspector=new PrismaClient({datasourceUrl:inspectorUrl.href,log:[]});
let qa:Principal;
beforeAll(async()=>{
  const {issueSession,sessionFromToken}=await import("../../src/lib/auth/session");
  qa=(await sessionFromToken((await issueSession(fixtureUsers.qa.id)).token)).principal;
});
afterAll(async()=>{await inspector.$disconnect();await(await import("../../src/lib/db")).prisma.$disconnect();});
const asQa=<T>(run:()=>Promise<T>)=>identityContext.run({principal:qa,testHarness:true},run);
const form=(values:Record<string,string>)=>{const f=new FormData();for(const [key,value] of Object.entries(values)) f.set(key,value);return f;};

it("integrates actual authorized configuration actions, typed evidence, rollback and no-op without changing history",async()=>{
  const {createDepartmentAction,updateDepartmentAction}=await import("../../src/modules/configuration/admin-actions");
  await asQa(()=>createDepartmentAction(form({code:"SYNTH_CAPTURE",name:"Synthetic capture department",actor:"Spoofed executor"})));
  const department=await inspector.department.findUniqueOrThrow({where:{code:"SYNTH_CAPTURE"}});
  const history=await inspector.configurationChange.findFirstOrThrow({where:{entityKey:department.code}});
  expect(history.authenticatedUserId).toBe(qa.id);expect(history.changedByText).toBe(qa.name);
  const evidence=await inspector.auditOperationEvidence.findFirstOrThrow({where:{configurationChangeId:history.id},include:{operation:{include:{events:true}}}});
  expect(evidence.operation.actorUserId).toBe(qa.id);expect(evidence.operation.reason).toBeNull();
  expect(evidence.operation.events.every(e=>e.entityType==="Department")).toBe(true);
  expect(evidence.operation.events.some(e=>e.fieldPath==="name"&&JSON.stringify(e.newValue).includes(department.name))).toBe(true);
  const before={department,operations:await inspector.auditOperation.count(),events:await inspector.auditEvent.count(),evidence:await inspector.auditOperationEvidence.count(),history:await inspector.configurationChange.count()};
  await asQa(()=>updateDepartmentAction(department.id,form({name:department.name,isActive:"true"})));
  expect(await inspector.auditOperation.count()).toBe(before.operations);
  expect(await inspector.auditEvent.count()).toBe(before.events);
  expect(await inspector.auditOperationEvidence.count()).toBe(before.evidence);
  expect(await inspector.configurationChange.count(),"Existing operational no-op history is preserved").toBe(before.history+1);
  await inspector.$executeRawUnsafe('ALTER TABLE "ConfigurationChange" ADD CONSTRAINT b2_capture_history_failure CHECK (action=\'NEVER_SUCCESS\') NOT VALID');
  try {
    await expect(asQa(()=>updateDepartmentAction(department.id,form({name:"Must roll back",isActive:"true"})))).rejects.toThrow();
    expect(await inspector.department.findUniqueOrThrow({where:{id:department.id}})).toEqual(department);
    expect(await inspector.auditOperation.count()).toBe(before.operations);
    expect(await inspector.auditEvent.count()).toBe(before.events);
    expect(await inspector.auditOperationEvidence.count()).toBe(before.evidence);
  } finally {await inspector.$executeRawUnsafe('ALTER TABLE "ConfigurationChange" DROP CONSTRAINT b2_capture_history_failure');}
  const requestId=randomUUID();
  const save=()=>asQa(()=>updateDepartmentAction(department.id,form({name:"Actual committed update",isActive:"true",_covexAuditRequestId:requestId})));
  await save();const count=await inspector.auditOperation.count();const historyCount=await inspector.configurationChange.count();
  await save();expect(await inspector.auditOperation.count()).toBe(count);expect(await inspector.configurationChange.count()).toBe(historyCount);
});

it("covers catalog children, parameters, alert rules and form/template activation without blanket administrative reasons",async()=>{
  const actions=await import("../../src/modules/configuration/admin-actions");
  await asQa(()=>actions.createCatalogAction(form({key:"SYNTH_CAPTURE",label:"Synthetic catalog",module:"DEVIATION"})));
  const catalog=await inspector.lookupCatalog.findUniqueOrThrow({where:{key:"SYNTH_CAPTURE"}});
  await asQa(()=>actions.updateCatalogAction(catalog.id,form({label:"Changed synthetic label",isActive:"true"})));
  await asQa(()=>actions.createCatalogItemAction(catalog.id,form({key:"SYNTH",label:"Synthetic item"})));
  const item=await inspector.lookupCatalogItem.findFirstOrThrow({where:{catalogId:catalog.id}});
  await asQa(()=>actions.updateCatalogItemAction(item.id,form({label:"Changed item label",isActive:"true"})));
  const display=await inspector.appParameter.findFirstOrThrow({where:{key:"DATE_FORMAT"}});
  await asQa(()=>actions.updateParameterAction(display.id,form({value:"yyyy-MM-dd",isActive:"true"})));
  const critical=await inspector.appParameter.findFirstOrThrow({where:{key:"ALLOW_CLOSED_RECORD_EDIT"}});
  await expect(asQa(()=>actions.updateParameterAction(critical.id,form({value:"false",isActive:"true"})))).rejects.toThrow();
  expect((await inspector.appParameter.findUniqueOrThrow({where:{id:critical.id}})).value).toBe(true);
  await asQa(()=>actions.updateParameterAction(critical.id,form({value:"false",isActive:"true",reason:"Synthetic policy parameter correction"})));
  const alert=await inspector.alertRule.findFirstOrThrow();
  await asQa(()=>actions.updateAlertRuleAction(alert.id,form({leadDays:String(alert.leadDays+1),isActive:"true"})));
  const source=await inspector.formVersion.findFirstOrThrow({where:{module:"DEVIATION",status:"ACTIVE"}});
  await asQa(()=>actions.cloneFormVersionAction(source.id,form({versionCode:"SYNTH_CAPTURE",effectiveFrom:"2099-01-01"})));
  const cloned=await inspector.formVersion.findFirstOrThrow({where:{module:"DEVIATION",versionCode:"SYNTH_CAPTURE"}});
  const field=await inspector.formFieldConfig.findFirstOrThrow({where:{formVersionId:cloned.id}});
  await asQa(()=>actions.updateFormFieldConfigAction(field.id,form({label:"Synthetic draft field",listAvailable:"true"})));
  const versions=await inspector.formVersion.findMany({where:{module:"DEVIATION"},orderBy:{id:"asc"}});
  await expect(asQa(()=>actions.activateFormVersionAction(cloned.id,form({})))).rejects.toThrow();
  expect(await inspector.formVersion.findMany({where:{module:"DEVIATION"},orderBy:{id:"asc"}})).toEqual(versions);
  await asQa(()=>actions.activateFormVersionAction(cloned.id,form({reason:"Synthetic official version activation"})));
  expect((await inspector.formVersion.findUniqueOrThrow({where:{id:source.id}})).status).toBe("RETIRED");
  expect((await inspector.formVersion.findUniqueOrThrow({where:{id:cloned.id}})).status).toBe("ACTIVE");
  const bytes=new Uint8Array([80,75,3,4,83,89,78,84,72]);
  const registration=form({module:"DEVIATION",documentType:"DEVIATION_ANNEX_III",versionCode:"SYNTH_CAPTURE",effectiveFrom:"2099-01-01"});
  registration.set("file",new File([bytes],"synthetic-template.docx",{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}));
  await asQa(()=>actions.registerTemplateVersionAction(registration));
  const template=await inspector.templateVersion.findFirstOrThrow({where:{module:"DEVIATION",versionCode:"SYNTH_CAPTURE"}});
  await expect(asQa(()=>actions.activateTemplateVersionAction(template.id,form({})))).rejects.toThrow();
  await asQa(()=>actions.activateTemplateVersionAction(template.id,form({reason:"Synthetic controlled template activation"})));
  const history=await inspector.configurationChange.findFirstOrThrow({where:{entityType:"TemplateVersion",action:"ACTIVATE",entityKey:{contains:"SYNTH_CAPTURE"}}});
  const linked=await inspector.auditOperationEvidence.findFirstOrThrow({where:{configurationChangeId:history.id},include:{operation:{include:{events:true}}}});
  expect(linked.operation.events.some(e=>e.entityType==="TemplateVersion"&&e.entityId===template.id)).toBe(true);
  expect(linked.operation.events.every(e=>!e.fieldPath.includes("fileData"))).toBe(true);
  const {withBusinessAudit}=await import("../../src/lib/audit/business-service");
  await expect(asQa(()=>withBusinessAudit({operationCode:"TR04",module:"DEVIATION",permission:"MANAGE_CONFIGURATION"},{requestId:randomUUID(),digest:"f".repeat(64),reason:"Synthetic forged binary proof"},async tx=>{
    await tx.templateVersion.update({where:{id:template.id},data:{fileData:new Uint8Array([0,1,2])}});
  }))).rejects.toThrow();
  expect(Array.from((await inspector.templateVersion.findUniqueOrThrow({where:{id:template.id}})).fileData!)).toEqual(Array.from(bytes));
},20000);

it("captures the bulk department creation from the PNT index (D-097) as one TR02 operation, skipping existing codes and replaying idempotently",async()=>{
  const {createDepartmentAction,createIndexDepartmentsAction}=await import("../../src/modules/configuration/admin-actions");
  await asQa(()=>createDepartmentAction(form({code:"ZZ-91",name:"Synthetic existing"})));
  const requestId=randomUUID(), state={error:null,created:[],skipped:[]};
  const departments=JSON.stringify([{code:"ZZ-91",name:"Must not overwrite"},{code:"zz-92",name:"Synthetic index department"}]);
  const run=()=>asQa(()=>createIndexDepartmentsAction(state,form({departments,_covexAuditRequestId:requestId})));
  expect(await run()).toEqual({error:null,created:["ZZ-92"],skipped:["ZZ-91"]});
  expect((await inspector.department.findUniqueOrThrow({where:{code:"ZZ-91"}})).name).toBe("Synthetic existing");
  const created=await inspector.department.findUniqueOrThrow({where:{code:"ZZ-92"}});
  expect(created).toMatchObject({name:"Synthetic index department",isActive:true});
  const history=await inspector.configurationChange.findFirstOrThrow({where:{entityKey:"ZZ-92"}});
  expect(history.changedByText).toBe(qa.name);expect(history.reason).toBe("Alta desde el índice de PNT de Garantía de Calidad");
  const evidence=await inspector.auditOperationEvidence.findFirstOrThrow({where:{configurationChangeId:history.id},include:{operation:{include:{events:true}}}});
  expect(evidence.operation.operation).toBe("TR02");expect(evidence.operation.actorUserId).toBe(qa.id);
  expect(evidence.operation.events.some(e=>e.entityType==="Department"&&e.fieldPath==="code"&&JSON.stringify(e.newValue).includes("ZZ-92"))).toBe(true);
  const count={operations:await inspector.auditOperation.count(),departments:await inspector.department.count()};
  await run();
  expect({operations:await inspector.auditOperation.count(),departments:await inspector.department.count()}).toEqual(count);
  expect((await asQa(()=>createIndexDepartmentsAction(state,form({departments:"[]"})))).error).toMatch(/al menos un departamento/);
});
