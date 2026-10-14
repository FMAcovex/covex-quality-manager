import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { identityContext, type Principal } from "../../src/lib/auth/context";
import { isolatedTestEnvironment } from "../../src/lib/auth/config";
import { fixtureUsers } from "../auth-fixtures/constants";
import { operationalValues } from "./operational-values";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;` }); } }));
const url = new URL(process.env.DATABASE_URL!), ownerUrl = new URL(process.env.B2_CAPTURE_INSPECTOR_URL!);
if (!isolatedTestEnvironment() || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== ownerUrl.pathname || !/^\/covex_phase4b1_test_b2_capture_[a-f0-9]+$/.test(url.pathname)) throw Error("Own disposable capture fixture required");
const inspector = new PrismaClient({ datasourceUrl: ownerUrl.href, log: [] });
let qa: Principal, reader: Principal;
beforeAll(async () => {
  const { issueSession, sessionFromToken } = await import("../../src/lib/auth/session");
  qa = (await sessionFromToken((await issueSession(fixtureUsers.qa.id)).token)).principal;
  reader = (await sessionFromToken((await issueSession(fixtureUsers.reader.id)).token)).principal;
});
afterAll(async () => { await inspector.$disconnect(); await (await import("../../src/lib/db")).prisma.$disconnect(); });
const asUser = <T>(user: Principal, execute: () => Promise<T>) => identityContext.run({ principal: user, testHarness: true }, execute);
const form = (values: Record<string,string>) => { const fd = new FormData(); Object.entries(values).forEach(([key,value]) => fd.set(key,value)); return fd; };
const settled = async (execute: () => Promise<unknown>) => { try { return await execute(); } catch (error) { if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT;")) return { redirect: error.digest }; throw error; } };
type Action = (...args: unknown[]) => Promise<unknown>;
const modules = [
  ["DEVIATION","deviation","../../src/modules/deviations/actions","createDeviationAction","updateDeviationAction"],
  ["CAPA","capa","../../src/modules/capa/actions","createCapaAction","updateCapaAction"],
  ["CHANGE_CONTROL","changeControl","../../src/modules/change-control/actions","createChangeControlAction","updateChangeControlAction"],
  ["COMPLAINT","complaint","../../src/modules/complaints/actions","createComplaintAction","updateComplaintAction"],
  ["RETURN","returnRecord","../../src/modules/returns/actions","createReturnAction","updateReturnAction"],
  ["AUDIT","audit","../../src/modules/audits/actions","saveAuditAction","saveAuditAction"],
] as const;

it.each(modules)("captures original %s operational opening and persisted critical correction with enforced authorization", async (module, model, file, createName, editName) => {
  const actions = await import(file) as Record<string,Action>, department = await inspector.department.findUniqueOrThrow({ where: { code: module === "RETURN" ? "LG-00" : "GC-00" } });
  const values = operationalValues(module, department.id), requestId = randomUUID();
  if (module === "CAPA") {
    const origin = await inspector.deviation.findFirstOrThrow({ where: { whatHappened: "Synthetic B2 operational deviation" }, include: { qmsRecord: true } });
    values.originsJson = JSON.stringify([{ id: origin.qmsRecordId, recordType: "DEVIATION", businessCode: origin.qmsRecord.businessCode, year: 2026 }]);
  }
  values._covexAuditRequestId = requestId;
  const args = () => module === "AUDIT" ? [null,{ error: null },form(values)] : [{ error: null },form(values)];
  await expect(asUser(reader, () => actions[createName](...args()))).rejects.toMatchObject({ status: 403 });
  const response = await settled(() => asUser(qa, () => actions[createName](...args())));
  if (response && typeof response === "object" && "error" in response && response.error) throw Error("Synthetic operational opening rejected: " + JSON.stringify(response));
  const op = await inspector.auditOperation.findUniqueOrThrow({ where: { actorUserId_origin_requestId: { actorUserId: qa.id, origin: "QMS_SERVER", requestId } }, include: { events: true, targets: true, evidence: true } });
  expect(op.actorUserId).toBe(qa.id); expect(op.reason).toBeNull();
  const entityEvent = op.events.find(event => event.entityType === model[0].toUpperCase() + model.slice(1) && event.fieldPath === "id")!;
  expect(entityEvent).toBeDefined();
  type Entity = { id: string; qmsRecordId: string; status?: string; finalStatus?: string; updatedAt: Date; rootCause?: string | null; classification?: string | null; observations?: string | null; internalObservations?: string | null; decisionObservations?: string | null; scope?: string | null };
  const entity = await (inspector as unknown as Record<string,{ findUniqueOrThrow(args:object):Promise<Entity> }>)[model].findUniqueOrThrow({ where: { id: entityEvent.entityId } });
  expect(entity.status ?? entity.finalStatus).toBe("OPEN");
  const root = await inspector.qmsRecord.findUniqueOrThrow({ where: { id: entity.qmsRecordId } }); expect(root.businessCode).toBeTruthy();
  expect(op.targets.some(target => target.rootKey === "QMS_RECORD:" + root.id)).toBe(true);
  const field = module === "CHANGE_CONTROL" ? "classification" : ["RETURN","AUDIT"].includes(module) ? "internalObservations" : "rootCause";
  const newValue = field === "classification" ? "MAJOR" : "Synthetic persisted operational correction";
  const updateId = randomUUID(), update = { ...values, businessCode: root.businessCode!, [field]: newValue, changeReason: "Synthetic documented critical correction", updatedAt: entity.updatedAt.toISOString(), expectedUpdatedAt: entity.updatedAt.toISOString(), _covexAuditRequestId: updateId };
  if (["DEVIATION","CAPA","CHANGE_CONTROL","COMPLAINT"].includes(module)) {
    const before = { events: await inspector.auditEvent.count(), operations: await inspector.auditOperation.count(), versions: await inspector.qmsRecordVersion.count() };
    const rejected = await settled(() => asUser(qa, () => actions[editName](entity.id,{ error: null },form({ ...update, changeReason: "", _covexAuditRequestId: randomUUID() }))));
    expect(rejected).toHaveProperty("error", expect.any(String));
    expect({ events: await inspector.auditEvent.count(), operations: await inspector.auditOperation.count(), versions: await inspector.qmsRecordVersion.count() }).toEqual(before);
    expect(await (inspector as unknown as Record<string,{findUniqueOrThrow(args:object):Promise<Entity>}>)[model].findUniqueOrThrow({where:{id:entity.id}})).toEqual(entity);
  }
  const result = await settled(() => asUser(qa, () => actions[editName](entity.id,{ error: null },form(update))));
  if (result && typeof result === "object" && "error" in result && result.error) throw Error("Synthetic operational correction rejected: " + JSON.stringify(result));
  const edited = await inspector.auditOperation.findUniqueOrThrow({ where: { actorUserId_origin_requestId: { actorUserId: qa.id, origin: "QMS_SERVER", requestId: updateId } }, include: { events: true, evidence: true } });
  expect(edited.reason).toBe(update.changeReason);
  const event = edited.events.find(event => event.entityId === entity.id && event.fieldPath === field)!;
  expect(event.oldValue).toEqual({ present: true, type: entity[field as keyof Entity] == null ? "NULL" : "STRING", value: entity[field as keyof Entity] ?? null });
  expect(event.newValue).toEqual({ present: true, type: "STRING", value: newValue });
  expect(edited.evidence.length).toBeGreaterThan(0);
  if (module === "DEVIATION") {
    expect(op.events.some(event => event.entityType === "DeviationImmediateAction")).toBe(true);
    expect(op.events.some(event => event.entityType === "DeviationCapaPlan")).toBe(true);
  }
  if (module === "COMPLAINT") {
    expect(op.events.some(event => event.entityType === "ComplaintCapaPlan")).toBe(true);
    expect(op.events.some(event => event.entityType === "ComplaintDerivedAction")).toBe(true);
  }
}, 30000);

it("captures original operational followups, versions and retries across the six QMS record modules", async () => {
  const mappings = [
    ["DEVIATION","deviation","whatHappened","Synthetic B2 operational deviation","addDeviationFollowupAction","DeviationFollowup"],
    ["CAPA","capa","defectDescription","Synthetic B2 operational CAPA","addCapaFollowupAction","CapaFollowup"],
    ["CHANGE_CONTROL","changeControl","description","Synthetic B2 operational change","addChangeControlFollowupAction","ChangeControlFollowup"],
    ["COMPLAINT","complaint","description","Synthetic B2 operational complaint","addComplaintFollowupAction","ComplaintFollowup"],
    ["RETURN","returnRecord","reasonObservations","Synthetic B2 operational return","addReturnFollowupAction","ReturnFollowup"],
    ["AUDIT","audit","title","Synthetic B2 operational audit","saveAuditChildAction","AuditFollowup"],
  ] as const;
  for (const [module, model, marker, value, actionName, eventModel] of mappings) {
    type Entity = { id: string; qmsRecordId: string; updatedAt: Date };
    const delegate = (inspector as unknown as Record<string,{findFirstOrThrow(args:object):Promise<Entity>}>)[model];
    let entity = await delegate.findFirstOrThrow({ where: { [marker]: value } });
    const actions = await import(modules.find(row => row[0] === module)![2]) as Record<string,Action>;
    let fields: Record<string,string> = { followupDate: "2026-10-10", completedByText: "External synthetic business executor", comment: "Synthetic operational followup", description: "Synthetic operational followup", reason: "Synthetic explicit continued followup", nextFollowupDate: "2099-10-30", evidenceReference: "SYNTHETIC-EVIDENCE" };
    if (module === "CHANGE_CONTROL") {
      const department = await inspector.department.findUniqueOrThrow({ where: { code: "GC-00" } });
      const root = await inspector.qmsRecord.findUniqueOrThrow({ where: { id: entity.qmsRecordId } });
      const values = { ...operationalValues(module, department.id), businessCode: root.businessCode!, classification: "MAJOR", requestDecision: "ACCEPTED", requestDecisionResponsible: "External nominal decision owner", requestDecisionRole: "External business role", requestDecisionDate: "2026-10-03", dictamenResult: "APPROVED", dictamenDate: "2026-10-03", dictamenObservations: "Synthetic documented opinion", followupResponsible: "External followup owner", nextFollowupDate: "2099-10-30", tasksJson: JSON.stringify([{ departmentId: department.id, description: "Synthetic implementation task", responsible: "External task responsible", plannedDate: "2026-10-15" }]), changeReason: "Synthetic explicit operational opinion", updatedAt: entity.updatedAt.toISOString(), _covexAuditRequestId: randomUUID() };
      const result = await settled(() => asUser(qa, () => actions.updateChangeControlAction(entity.id,{error:null},form(values))));
      if (result && typeof result === "object" && "error" in result && result.error) throw Error("Synthetic opinion rejected: " + JSON.stringify(result));
      entity = await delegate.findFirstOrThrow({ where: { id: entity.id } });
      const task = await inspector.changeControlTask.findFirstOrThrow({ where: { changeControlId: entity.id } });
      expect(task.responsible).toBe("External task responsible");
      fields = { ...fields, responsible: "External followup responsible", executionStatus: "NOT_EXECUTED", effectivenessStatus: "PENDING", closeChange: "false", remainOpenReason: "Synthetic controlled implementation still pending", tasksJson: JSON.stringify([{ taskId: task.id, description: task.description, status: "PENDING" }]) };
    }
    if (module === "AUDIT") fields.nextReviewDate = "2099-10-30";
    const source = module === "AUDIT" ? await import("../../src/modules/audits/finding-actions") as unknown as Record<string,Action> : actions;
    const requestId = randomUUID(); fields._covexAuditRequestId = requestId;
    const args = () => module === "AUDIT" ? [entity.id,"followup",undefined,undefined,{error:null},form(fields)] : [entity.id,{error:null},form(fields)];
    await expect(asUser(reader, () => source[actionName](...args()))).rejects.toMatchObject({status:403});
    const response = await settled(() => asUser(qa, () => source[actionName](...args())));
    if (response && typeof response === "object" && "error" in response && response.error) throw Error("Synthetic followup rejected: " + JSON.stringify(response));
    const operation = await inspector.auditOperation.findUniqueOrThrow({ where: { actorUserId_origin_requestId: { actorUserId: qa.id, origin: "QMS_SERVER", requestId } }, include: { events:true, evidence:true, targets:true } });
    expect(operation.actorUserId).toBe(qa.id); expect(operation.reason).toBe(fields.reason);
    expect(operation.events.some(event => event.entityType === eventModel && event.fieldPath === "followupDate" && JSON.stringify(event.newValue).includes("2026-10-10"))).toBe(true);
    expect(operation.evidence.some(e => e.changeHistoryId)).toBe(true);
    expect(operation.targets.some(target => target.rootKey === "QMS_RECORD:"+entity.qmsRecordId)).toBe(true);
    const totals = {events:await inspector.auditEvent.count(), versions:await inspector.qmsRecordVersion.count()};
    expect(await settled(() => asUser(qa, () => source[actionName](...args())))).toEqual(response);
    expect({events:await inspector.auditEvent.count(), versions:await inspector.qmsRecordVersion.count()}).toEqual(totals);
  }
}, 60000);

it("captures original audit findings, actions, verification, relationships, attribution and withdrawal", async () => {
  const actions = await import("../../src/modules/audits/finding-actions");
  const audit = await inspector.audit.findFirstOrThrow({ where: { title: "Synthetic B2 operational audit" } });
  const invoke = async (kind: "finding"|"action"|"followup", findingId: string|undefined, entityId: string|undefined, fields: Record<string,string>) => {
    const requestId = randomUUID();
    const args = [audit.id,kind,findingId,entityId,{error:null},form({...fields,_covexAuditRequestId:requestId})] as Parameters<typeof actions.saveAuditChildAction>;
    await expect(asUser(reader, () => actions.saveAuditChildAction(...args))).rejects.toMatchObject({status:403});
    const result = await asUser(qa, () => actions.saveAuditChildAction(...args));
    expect(result.error).toBeNull();
    const operation = await inspector.auditOperation.findUniqueOrThrow({ where:{actorUserId_origin_requestId:{actorUserId:qa.id,origin:"QMS_SERVER",requestId}},include:{events:true,evidence:true} });
    expect(operation.actorUserId).toBe(qa.id); expect(operation.evidence.some(e=>e.changeHistoryId)).toBe(true);
    const events = await inspector.auditEvent.count();
    expect(await asUser(qa, () => actions.saveAuditChildAction(...args))).toEqual(result); expect(await inspector.auditEvent.count()).toBe(events);
    return operation;
  };
  const findingFields = { findingType:"FINDING",criticality:"MINOR",description:"Synthetic B2 operational finding",criterionReference:"SYNTHETIC-CRITERION",objectiveEvidence:"Synthetic observation",treatment:"Synthetic treatment",treatmentStatus:"OPEN" };
  const created = await invoke("finding",undefined,undefined,findingFields);
  const finding = await inspector.auditFinding.findUniqueOrThrow({where:{id:created.events.find(e=>e.entityType==="AuditFinding"&&e.fieldPath==="id")!.entityId}});
  const correction = await invoke("finding",undefined,finding.id,{...findingFields,criticality:"MAJOR",changeReason:"Synthetic documented finding reassessment",expectedUpdatedAt:finding.updatedAt.toISOString()});
  expect(correction.events.some(e=>e.fieldPath==="criticality"&&JSON.stringify(e.oldValue).includes("MINOR")&&JSON.stringify(e.newValue).includes("MAJOR"))).toBe(true);
  const actionFields = { description:"Synthetic finding action",responsible:"External nominal action owner",targetDate:"2026-10-15",status:"OPEN" };
  const actionCreated = await invoke("action",finding.id,undefined,actionFields);
  expect(actionCreated.operation).toBe("AU03");
  const action = await inspector.auditFindingAction.findUniqueOrThrow({where:{id:actionCreated.events.find(e=>e.entityType==="AuditFindingAction"&&e.fieldPath==="id")!.entityId}});
  expect(action.responsible).toBe(actionFields.responsible);
  const verified = await invoke("action",finding.id,action.id,{...actionFields,status:"CLOSED",closedAt:"2026-10-11",evidenceReference:"SYNTHETIC-VERIFICATION",verificationResult:"CONFORMING",verifiedAt:"2026-10-11",verifiedBy:"External nominal verifier",changeReason:"Synthetic documented action closure and verification",expectedUpdatedAt:action.updatedAt.toISOString()});
  expect(verified.events.some(e=>e.fieldPath==="verificationResult"&&JSON.stringify(e.newValue).includes("CONFORMING"))).toBe(true);
  const capa = await inspector.capa.findFirstOrThrow({where:{defectDescription:"Synthetic B2 operational CAPA"}}), requestId = randomUUID();
  const linkForm = () => form({targetRecordId:capa.qmsRecordId,_covexAuditRequestId:requestId});
  await expect(asUser(reader, () => actions.linkAuditFindingAction(audit.id,finding.id,{error:null},linkForm()))).rejects.toMatchObject({status:403});
  expect(await asUser(qa, () => actions.linkAuditFindingAction(audit.id,finding.id,{error:null},linkForm()))).toHaveProperty("error",null);
  const relation = await inspector.qmsRelation.findUniqueOrThrow({where:{sourceRecordId_targetRecordId_relationType:{sourceRecordId:audit.qmsRecordId,targetRecordId:capa.qmsRecordId,relationType:"GENERATES"}}});
  const attribution = await inspector.auditFindingRelation.findUniqueOrThrow({where:{findingId_qmsRelationId:{findingId:finding.id,qmsRelationId:relation.id}}});
  const link = await inspector.auditOperation.findUniqueOrThrow({where:{actorUserId_origin_requestId:{actorUserId:qa.id,origin:"QMS_SERVER",requestId}},include:{targets:true,events:true}});
  expect(link.operation).toBe("AU05"); expect(link.targets.map(t=>t.rootKey)).toEqual(expect.arrayContaining(["QMS_RECORD:"+audit.qmsRecordId,"QMS_RECORD:"+capa.qmsRecordId]));
  expect(link.events.some(e=>e.entityType==="AuditFindingRelation")).toBe(true);
  expect(await asUser(qa, () => actions.retireAuditAttributionAction(audit.id,finding.id,attribution.id,{error:null},form({reason:"Synthetic attribution withdrawal",_covexAuditRequestId:randomUUID()})))).toHaveProperty("error",null);
  expect((await inspector.qmsRelation.findUniqueOrThrow({where:{id:relation.id}})).isActive).toBe(true);
  expect(await asUser(qa, () => actions.unlinkAuditRecordAction(audit.id,capa.qmsRecordId,{error:null},form({reason:"Synthetic global relation withdrawal",_covexAuditRequestId:randomUUID()})))).toHaveProperty("error",null);
  expect((await inspector.qmsRelation.findUniqueOrThrow({where:{id:relation.id}})).isActive).toBe(false);
  expect(await asUser(qa, () => actions.retireAuditChildAction(audit.id,finding.id,action.id,{error:null},form({reason:"Synthetic retired action retains its verification",_covexAuditRequestId:randomUUID()})))).toHaveProperty("error",null);
  expect((await inspector.auditFindingAction.findUniqueOrThrow({where:{id:action.id}})).verificationResult).toBe("CONFORMING");
  expect(await asUser(qa, () => actions.retireAuditChildAction(audit.id,finding.id,undefined,{error:null},form({reason:"Synthetic finding retirement",_covexAuditRequestId:randomUUID()})))).toHaveProperty("error",null);
  expect((await inspector.auditFinding.findUniqueOrThrow({where:{id:finding.id}})).isActive).toBe(false);
},60000);

it("requires an explicit motive for an original operational closure even when established conclusions remain unchanged", async () => {
  const { updateDeviationAction } = await import("../../src/modules/deviations/actions");
  const entity = await inspector.deviation.findFirstOrThrow({where:{whatHappened:"Synthetic B2 operational deviation"},include:{qmsRecord:true}});
  const before = {entity,events:await inspector.auditEvent.count(),operations:await inspector.auditOperation.count(),versions:await inspector.qmsRecordVersion.findMany({where:{qmsRecordId:entity.qmsRecordId},orderBy:{sequenceNumber:"asc"}})};
  const values = { ...operationalValues("DEVIATION",entity.departmentId!),businessCode:entity.qmsRecord.businessCode!,rootCause:entity.rootCause!,status:"CLOSED",saveIntent:"",closedAt:"2026-10-11",changeReason:"",_covexAuditRequestId:randomUUID() };
  const response = await settled(() => asUser(qa, () => updateDeviationAction(entity.id,{error:null},form(values))));
  expect(response).toHaveProperty("error",expect.any(String));
  expect({entity:await inspector.deviation.findUniqueOrThrow({where:{id:entity.id},include:{qmsRecord:true}}),events:await inspector.auditEvent.count(),operations:await inspector.auditOperation.count(),versions:await inspector.qmsRecordVersion.findMany({where:{qmsRecordId:entity.qmsRecordId},orderBy:{sequenceNumber:"asc"}})}).toEqual(before);
  const closureId=randomUUID(),closureReason="Synthetic explicit closure and new version";
  const closed=await settled(()=>asUser(qa,()=>updateDeviationAction(entity.id,{error:null},form({...values,saveMode:"new-version",changeReason:closureReason,_covexAuditRequestId:closureId}))));
  expect(closed).toHaveProperty("redirect");
  expect((await inspector.deviation.findUniqueOrThrow({where:{id:entity.id}})).status).toBe("CLOSED");
  const closedVersion=await inspector.qmsRecordVersion.findFirstOrThrow({where:{qmsRecordId:entity.qmsRecordId},orderBy:{sequenceNumber:"desc"}});
  const reopenId=randomUUID(),reopenReason="Synthetic explicit reopening in a new version";
  const reopened=await settled(()=>asUser(qa,()=>updateDeviationAction(entity.id,{error:null},form({...values,status:"OPEN",closedAt:"",saveMode:"new-version",changeReason:reopenReason,_covexAuditRequestId:reopenId}))));
  expect(reopened).toHaveProperty("redirect");
  const current=await inspector.deviation.findUniqueOrThrow({where:{id:entity.id}});expect(current.status).toBe("OPEN");expect(current.closedAt).toBeNull();
  const frozen=await inspector.qmsRecordVersion.findUniqueOrThrow({where:{id:closedVersion.id}});
  expect(frozen.snapshot).toEqual(closedVersion.snapshot);expect(frozen.frozenAt).not.toBeNull();
  const latest=await inspector.qmsRecordVersion.findFirstOrThrow({where:{qmsRecordId:entity.qmsRecordId},orderBy:{sequenceNumber:"desc"}});expect(latest.kind).toBe("REOPENING");expect(latest.sequenceNumber).toBe(closedVersion.sequenceNumber+1);
  for(const requestId of [closureId,reopenId]) {
    const operation=await inspector.auditOperation.findUniqueOrThrow({where:{actorUserId_origin_requestId:{actorUserId:qa.id,origin:"QMS_SERVER",requestId}},include:{assessment:true,events:true}});
    expect(operation.assessment?.proposedCritical).toBe(true);expect(operation.assessment?.reasonRequired).toBe(true);
    expect(operation.events.some(event=>event.fieldPath==="status"&&event.entityType==="Deviation")).toBe(true);
  }
},30000);

it("keeps reason optional for persisted critical draft fields, including Change Control's finalStatus",async()=>{
  const {createChangeControlAction,updateChangeControlAction}=await import("../../src/modules/change-control/actions");
  const marker="Synthetic owned draft criticality "+randomUUID();
  const department=await inspector.department.findUniqueOrThrow({where:{code:"GC-00"}});
  await settled(()=>asUser(qa,()=>createChangeControlAction({error:null},form({finalStatus:"DRAFT",departmentId:department.id,classification:"MINOR",internalObservations:marker,tasksJson:"[]",_covexAuditRequestId:randomUUID()}))));
  const record=await inspector.changeControl.findFirstOrThrow({where:{finalStatus:"DRAFT",internalObservations:marker}});
  for(const classification of ["MINOR","MAJOR"]) {
    const current=await inspector.changeControl.findUniqueOrThrow({where:{id:record.id}});
    const result=await settled(()=>asUser(qa,()=>updateChangeControlAction(record.id,{error:null},form({finalStatus:"DRAFT",classification,tasksJson:"[]",internalObservations:current.internalObservations??"",_covexAuditRequestId:randomUUID()}))));
    expect(result).toHaveProperty("redirect");
  }
  expect((await inspector.changeControl.findUniqueOrThrow({where:{id:record.id}})).classification).toBe("MAJOR");
},30000);

it("allows equivalent child regeneration without a blanket motive and rejects a changed responsible without one",async()=>{
  const {updateCapaAction}=await import("../../src/modules/capa/actions");
  const current=await inspector.capa.findFirstOrThrow({where:{defectDescription:"Synthetic B2 operational CAPA"},include:{qmsRecord:true,plannedActions:true}});
  const origins=await inspector.qmsRelation.findMany({where:{targetRecordId:current.qmsRecordId,isActive:true,relationType:"GENERATES"},include:{sourceRecord:true}});
  const fields={...operationalValues("CAPA",current.departmentId!),businessCode:current.qmsRecord.businessCode!,originsJson:JSON.stringify(origins.map(origin=>({id:origin.sourceRecord.id,recordType:origin.sourceRecord.recordType,businessCode:origin.sourceRecord.businessCode,year:origin.sourceRecord.year}))),rootCause:current.rootCause!,internalObservations:"Synthetic noncritical edit with unchanged planned content",updatedAt:current.updatedAt.toISOString(),_covexAuditRequestId:randomUUID()};
  const result=await settled(()=>asUser(qa,()=>updateCapaAction(current.id,{error:null},form(fields))));
  if(result&&typeof result==="object"&&"error" in result&&result.error)throw Error("Equivalent original save rejected: "+JSON.stringify(result));
  const updated=await inspector.capa.findUniqueOrThrow({where:{id:current.id},include:{qmsRecord:true,plannedActions:true}});
  expect(updated.plannedActions.map(p=>[p.description,p.responsible,p.plannedExecutionDate,p.impact])).toEqual(current.plannedActions.map(p=>[p.description,p.responsible,p.plannedExecutionDate,p.impact]));
  const before={entity:updated,operations:await inspector.auditOperation.count(),events:await inspector.auditEvent.count()};
  const rejected=await settled(()=>asUser(qa,()=>updateCapaAction(current.id,{error:null},form({...fields,updatedAt:updated.updatedAt.toISOString(),plannedActionsJson:JSON.stringify([{description:current.plannedActions[0].description,responsible:"Different external business responsible",plannedExecutionDate:"2026-10-15",impact:current.plannedActions[0].impact}]),_covexAuditRequestId:randomUUID()}))));
  expect(rejected).toHaveProperty("error",expect.stringContaining("motivo"));
  expect({entity:await inspector.capa.findUniqueOrThrow({where:{id:current.id},include:{qmsRecord:true,plannedActions:true}}),operations:await inspector.auditOperation.count(),events:await inspector.auditEvent.count()}).toEqual(before);
},30000);

it("captures original complaint/return closure and CAPA operational/effectiveness decisions with a motive",async()=>{
  const {updateComplaintAction}=await import("../../src/modules/complaints/actions");
  const {updateReturnAction}=await import("../../src/modules/returns/actions");
  const {addCapaFollowupAction}=await import("../../src/modules/capa/actions");
  const complaint=await inspector.complaint.findFirstOrThrow({where:{description:"Synthetic B2 operational complaint"},include:{qmsRecord:true}});
  const cId=randomUUID();
  const cResult=await settled(()=>asUser(qa,()=>updateComplaintAction(complaint.id,{error:null},form({...operationalValues("COMPLAINT",complaint.departmentId!),businessCode:complaint.qmsRecord.businessCode!,rootCause:complaint.rootCause!,status:"CLOSED",partIIRequired:"false",closedAt:"2026-10-11",nextFollowupDate:"",changeReason:"Synthetic explicit Part I closure",_covexAuditRequestId:cId}))));
  if(cResult&&typeof cResult==="object"&&"error" in cResult&&cResult.error)throw Error("Original complaint closure rejected: "+JSON.stringify(cResult));
  expect((await inspector.complaint.findUniqueOrThrow({where:{id:complaint.id}})).status).toBe("CLOSED");
  const returned=await inspector.returnRecord.findFirstOrThrow({where:{reasonObservations:"Synthetic B2 operational return"},include:{qmsRecord:true}}),rId=randomUUID();
  const rResult=await settled(()=>asUser(qa,()=>updateReturnAction(returned.id,{error:null},form({...operationalValues("RETURN",returned.departmentId!),businessCode:returned.qmsRecord.businessCode!,internalObservations:returned.internalObservations??"",status:"CLOSED",decision:"ACCEPTED",decisionDate:"2026-10-11",closedAt:"2026-10-11",finalDestination:"Synthetic authorised reintegration",traceabilityUpdated:"YES",changeReason:"Synthetic explicit disposition and return closure",_covexAuditRequestId:rId}))));
  if(rResult&&typeof rResult==="object"&&"error" in rResult&&rResult.error)throw Error("Original return closure rejected: "+JSON.stringify(rResult));
  expect((await inspector.returnRecord.findUniqueOrThrow({where:{id:returned.id}})).status).toBe("CLOSED");
  const capa=await inspector.capa.findFirstOrThrow({where:{defectDescription:"Synthetic B2 operational CAPA"}}),ids=[cId,rId];
  for(const effectivenessStatus of ["PENDING","CONFORMING"] as const) {
    const id=randomUUID();ids.push(id);
    const fields={followupDate:"2026-10-12",completedByText:"External business executor",description:"Synthetic controlled closure/efficacy followup",status:"CLOSED",operationalClosedAt:"2026-10-11",conclusion:capa.conclusion!,effectivenessStatus,evidenceReference:"SYNTHETIC-EXECUTION",reason:"Synthetic explicit "+effectivenessStatus+" decision",...(effectivenessStatus==="PENDING"?{nextFollowupDate:"2099-10-30"}:{effectivenessAssessment:"Synthetic documented absence of recurrence",effectivenessEvidence:"SYNTHETIC-EFFICACY",effectiveClosedAt:"2026-10-12"}),_covexAuditRequestId:id};
    const result=await asUser(qa,()=>addCapaFollowupAction(capa.id,{},form(fields)));
    if(result.error)throw Error("Original CAPA closure rejected: "+JSON.stringify(result));
  }
  const resolved=await inspector.capa.findUniqueOrThrow({where:{id:capa.id}});expect(resolved.status).toBe("CLOSED");expect(resolved.effectivenessStatus).toBe("CONFORMING");
  for(const requestId of ids) {
    const operation=await inspector.auditOperation.findUniqueOrThrow({where:{actorUserId_origin_requestId:{actorUserId:qa.id,origin:"QMS_SERVER",requestId}},include:{assessment:true,events:true}});
    expect(operation.assessment?.proposedCritical).toBe(true);expect(operation.reason).not.toBeNull();expect(operation.events.length).toBeGreaterThan(0);
  }
},60000);

it("captures the original Change Control closure through a completed task followup",async()=>{
  const {addChangeControlFollowupAction}=await import("../../src/modules/change-control/actions");
  const record=await inspector.changeControl.findFirstOrThrow({where:{description:"Synthetic B2 operational change"},include:{tasks:true}}),requestId=randomUUID();
  const result=await settled(()=>asUser(qa,()=>addChangeControlFollowupAction(record.id,{},form({followupDate:"2026-10-20",responsible:"External business followup owner",executionStatus:"EXECUTED",executionDate:"2026-10-20",effectivenessStatus:"ACCEPTABLE",effectivenessObservations:"Synthetic evidence of acceptable outcome",closeChange:"true",conclusion:"Synthetic completed implementation",approvalByText:"External nominal closing approver",reason:"Synthetic explicit closure and verification",tasksJson:JSON.stringify(record.tasks.map(task=>({taskId:task.id,description:task.description,status:"COMPLETED",actualDate:"2026-10-20",evidenceComment:"SYNTHETIC-EVIDENCE"}))),_covexAuditRequestId:requestId}))));
  if(result&&typeof result==="object"&&"error" in result&&result.error)throw Error("Original Change Control closure rejected: "+JSON.stringify(result));
  const updated=await inspector.changeControl.findUniqueOrThrow({where:{id:record.id}});expect(updated.finalStatus).toBe("CLOSED");
  const operation=await inspector.auditOperation.findUniqueOrThrow({where:{actorUserId_origin_requestId:{actorUserId:qa.id,origin:"QMS_SERVER",requestId}},include:{assessment:true,events:true}});
  expect(operation.assessment?.proposedCritical).toBe(true);expect(operation.events.some(e=>e.fieldPath==="finalStatus"&&JSON.stringify(e.newValue).includes("CLOSED"))).toBe(true);
},30000);

it("rejects rewriting a frozen snapshot through a valid audited application command", async () => {
  const { withBusinessAudit } = await import("../../src/lib/audit/business-service");
  const capa = await inspector.capa.findFirstOrThrow({where:{defectDescription:"Synthetic B2 operational CAPA"}});
  const version = await inspector.qmsRecordVersion.findFirstOrThrow({where:{qmsRecordId:capa.qmsRecordId,frozenAt:{not:null}}});
  const before = {operations:await inspector.auditOperation.count(),events:await inspector.auditEvent.count()};
  await expect(asUser(qa, () => withBusinessAudit({operationCode:"CA02",module:"CAPA",permission:"EDIT"},{requestId:randomUUID(),digest:"7".repeat(64),reason:"Synthetic attempted frozen snapshot rewrite"},async tx => {
    await tx.qmsRecordVersion.update({where:{id:version.id},data:{snapshot:{synthetic:"must not rewrite frozen history"}}});
  }))).rejects.toThrow();
  expect(await inspector.qmsRecordVersion.findUniqueOrThrow({where:{id:version.id}})).toEqual(version);
  expect({operations:await inspector.auditOperation.count(),events:await inspector.auditEvent.count()}).toEqual(before);
},30000);


it("captures original annual planning, approvers and immutable issuance, including failure rollback and replay",async()=>{
  const {prisma}=await import("../../src/lib/db");
  const {businessSqlFixture}=await import("./database");
  const {syntheticAnnualProgramme}=await import("../audits-annual-programme-fixtures");
  const {createHash}=await import("node:crypto");
  const {createPlanAction,addPlanEntryAction,updatePlanEntryAction,retirePlanEntryAction}=await import("../../src/modules/audits/plan-actions");
  const {saveProgrammeApproversAction,issueAnnualProgrammeAction}=await import("../../src/modules/audits/annual-programme/actions");
  const {getProgrammePreview,getAnnualProgrammeFile}=await import("../../src/modules/audits/annual-programme/service");
  const bytes=syntheticAnnualProgramme(true),templateId=randomUUID();
  await asUser(qa,()=>businessSqlFixture(prisma,qa.id,randomUUID(),"TR04","AUDIT","MANAGE_CONFIGURATION",null,async tx=>{
    await tx.templateVersion.create({data:{id:templateId,module:"AUDIT",documentType:"AUDIT_ANNUAL_INTERNAL_PROGRAMME",versionCode:"SYNTHETIC-B2-ANNUAL",effectiveFrom:new Date("2026-10-13"),fileName:"synthetic.docx",fileData:new Uint8Array(bytes),fileSize:bytes.length,checksum:createHash("sha256").update(bytes).digest("hex")}});
  }));
  const title="Synthetic original B2 annual programme",createId=randomUUID();
  const input={year:"2089",auditType:"INTERNAL",title,notes:"Synthetic planning scope",actor:"Spoofed executor",_covexAuditRequestId:createId};
  await expect(asUser(reader,()=>createPlanAction(form(input)))).rejects.toMatchObject({status:403});
  expect(await settled(()=>asUser(qa,()=>createPlanAction(form(input))))).toHaveProperty("redirect");
  const plan=await inspector.auditAnnualPlan.findFirstOrThrow({where:{title}});
  const entryInput={subject:"Synthetic annual entry",targetName:"Synthetic corporate area",departmentId:"",plannedDate:"",plannedPeriodText:"Synthetic scheduling period",plannedAuditorsText:"External business auditor",plannedScope:"Synthetic scope",plannedModality:"REMOTE",programmeArea:"Quality",notes:"Synthetic initial notes",actor:"Spoofed executor",_covexAuditRequestId:randomUUID()};
  await settled(()=>asUser(qa,()=>addPlanEntryAction(plan.id,form(entryInput))));
  const entry=await inspector.auditPlanEntry.findFirstOrThrow({where:{planId:plan.id}});
  const editId=randomUUID();
  await settled(()=>asUser(qa,()=>updatePlanEntryAction(plan.id,entry.id,form({...entryInput,notes:"Synthetic changed notes",reason:"Synthetic documented planning correction",_covexAuditRequestId:editId}))));
  const edited=await inspector.auditOperation.findUniqueOrThrow({where:{actorUserId_origin_requestId:{actorUserId:qa.id,origin:"QMS_SERVER",requestId:editId}},include:{events:true,targets:true,evidence:true}});
  expect(edited.events.find(e=>e.entityId===entry.id&&e.fieldPath==="notes")?.oldValue).toEqual({present:true,type:"STRING",value:"Synthetic initial notes"});
  expect(edited.targets.some(t=>t.rootKey==="AUDIT_PLAN:"+plan.id)).toBe(true);expect(edited.evidence.length).toBeGreaterThan(0);
  expect(await asUser(qa,()=>saveProgrammeApproversAction(plan.id,{},form({technicalApproverName:"External nominal technical approver",qualityApproverName:"External nominal quality approver",reason:"Synthetic nominal approvers",_covexAuditRequestId:randomUUID()})))).toHaveProperty("success");
  const preview=await getProgrammePreview(plan.id);expect(preview.blockers).toEqual([]);
  const issueId=randomUUID(),issue={requestId:randomUUID(),expectedFingerprint:preview.fingerprint,reason:"",_covexAuditRequestId:issueId};
  await inspector.$executeRawUnsafe('ALTER TABLE "AuditEvent" ADD CONSTRAINT synthetic_annual_capture_failure CHECK ("entityType"<>\'AuditAnnualProgrammeVersion\') NOT VALID');
  try {
    const failed=await asUser(qa,()=>issueAnnualProgrammeAction(plan.id,{},form(issue)));expect(failed).toHaveProperty("error");
    expect(await inspector.auditAnnualProgrammeVersion.count({where:{planId:plan.id}})).toBe(0);
    expect(await inspector.auditOperation.count({where:{requestId:issueId}})).toBe(0);
  } finally {await inspector.$executeRawUnsafe('ALTER TABLE "AuditEvent" DROP CONSTRAINT synthetic_annual_capture_failure');}
  const success=await asUser(qa,()=>issueAnnualProgrammeAction(plan.id,{},form(issue)));expect(success).toHaveProperty("success");
  const original=await inspector.auditAnnualProgrammeVersion.findFirstOrThrow({where:{planId:plan.id}});
  expect((await getAnnualProgrammeFile(plan.id,original.id)).fileData).toEqual(original.fileData);
  expect(await asUser(qa,()=>issueAnnualProgrammeAction(plan.id,{},form(issue)))).toEqual(success);
  expect(await inspector.auditAnnualProgrammeVersion.count({where:{planId:plan.id}})).toBe(1);
  const op=await inspector.auditOperation.findUniqueOrThrow({where:{actorUserId_origin_requestId:{actorUserId:qa.id,origin:"QMS_SERVER",requestId:issueId}},include:{events:true}});
  expect(op.actorName).toBe(qa.name);expect(op.events.some(e=>e.entityType==="AuditAnnualProgrammeVersion")).toBe(true);
  expect(op.events.some(e=>e.fieldPath==="fileData")).toBe(false);
  await expect(inspector.auditAnnualProgrammeVersion.update({where:{id:original.id},data:{reason:"Forbidden rewrite"}})).rejects.toThrow();
  await settled(()=>asUser(qa,()=>retirePlanEntryAction(plan.id,entry.id,form({reason:"Synthetic retirement of unused planned entry",_covexAuditRequestId:randomUUID()}))));
  expect((await inspector.auditPlanEntry.findUniqueOrThrow({where:{id:entry.id}})).isActive).toBe(false);
  expect((await getAnnualProgrammeFile(plan.id,original.id)).fileData).toEqual(original.fileData);
},60000);

it("captures native working annex downloads with explicit generation permission, receipts and no new formal issuance",async()=>{
  const {prisma}=await import("../../src/lib/db"),{businessSqlFixture}=await import("./database"),{createHash}=await import("node:crypto");
  const {syntheticWorkingDocumentTemplate}=await import("./working-document-template");
  const {syntheticComplaintDoc}=await import("../complaints-r4a-doc-fixtures");
  const {syntheticReturnDoc}=await import("../returns-r4b-doc-fixtures");
  const generic=syntheticWorkingDocumentTemplate();
  type AnnexGet=(request:Request,context:{params:Promise<{id:string}>})=>Promise<Response>;
  const loadAnnex=async(path:string,annex:string):Promise<AnnexGet>=>{
    const key=`${path}/${annex}`;
    switch(key){
      case "deviations/annex-iii":return (await import("../../src/app/api/deviations/[id]/annex-iii/route")).GET;
      case "capa/annex-iii":return (await import("../../src/app/api/capa/[id]/annex-iii/route")).GET;
      case "changes/annex-iii":return (await import("../../src/app/api/changes/[id]/annex-iii/route")).GET;
      case "changes/annex-iv":return (await import("../../src/app/api/changes/[id]/annex-iv/route")).GET;
      case "changes/annex-v":return (await import("../../src/app/api/changes/[id]/annex-v/route")).GET;
      case "complaints/annex-iii":return (await import("../../src/app/api/complaints/[id]/annex-iii/route")).GET;
      case "complaints/annex-iv":return (await import("../../src/app/api/complaints/[id]/annex-iv/route")).GET;
      case "returns/annex-iii":return (await import("../../src/app/api/returns/[id]/annex-iii/route")).GET;
      default:throw Error(`Unknown synthetic working annex ${key}`);
    }
  };
  const cases=[
    ["DEVIATION","DEVIATION_ANNEX_III","06","deviation","whatHappened","Synthetic B2 operational deviation","deviations","annex-iii",generic],
    ["CAPA","CAPA_ANNEX_III","05","capa","defectDescription","Synthetic B2 operational CAPA","capa","annex-iii",generic],
    ["CHANGE_CONTROL","CHANGE_ANNEX_III","03","changeControl","description","Synthetic B2 operational change","changes","annex-iii",generic],
    ["CHANGE_CONTROL","CHANGE_ANNEX_IV","03","changeControl","description","Synthetic B2 operational change","changes","annex-iv",generic],
    ["CHANGE_CONTROL","CHANGE_ANNEX_V","03","changeControl","description","Synthetic B2 operational change","changes","annex-v",generic],
    ["COMPLAINT","COMPLAINT_ANNEX_III","03","complaint","description","Synthetic B2 operational complaint","complaints","annex-iii",syntheticComplaintDoc("III")],
    ["COMPLAINT","COMPLAINT_ANNEX_IV","03","complaint","description","Synthetic B2 operational complaint","complaints","annex-iv",syntheticComplaintDoc("IV")],
    ["RETURN","RETURN_ANNEX_III","03","returnRecord","reasonObservations","Synthetic B2 operational return","returns","annex-iii",syntheticReturnDoc("III")],
  ] as const;
  const {Prisma}=await import("@prisma/client");
  for(const [module,type,versionCode,model,marker,value,path,annex,bytes] of cases) {
    await asUser(qa,()=>businessSqlFixture(prisma,qa.id,randomUUID(),"TR04",module,"MANAGE_CONFIGURATION","Synthetic template preparation only in owned test database",async tx=>{
      const where={module_documentType_versionCode:{module,documentType:type,versionCode}};
      const existing=await tx.templateVersion.findUnique({where});
      const data={fileData:new Uint8Array(bytes),fileSize:bytes.length,checksum:createHash("sha256").update(bytes).digest("hex"),fileName:"synthetic-only.docx"};
      if(existing) {
        if(existing.fileData)throw Error("Cannot overwrite an existing fixture original");
        await tx.templateVersion.update({where,data});
      } else await tx.templateVersion.create({data:{...data,module,documentType:type,versionCode,effectiveFrom:new Date("2026-10-13")}});
    }));
    const [entity]=await inspector.$queryRaw<{id:string;qmsRecordId:string}[]>(Prisma.sql`SELECT id,"qmsRecordId" FROM ${Prisma.raw('"'+model[0].toUpperCase()+model.slice(1)+'"')} WHERE ${Prisma.raw('"'+marker+'"')}=${value}`);
    const GET=await loadAnnex(path,annex);
    const requestId=randomUUID(),request=()=>new Request(`http://127.0.0.1/api/${path}/${entity.id}/${annex}`,{headers:{"idempotency-key":requestId}}),params={params:Promise.resolve({id:entity.id})};
    const count=await inspector.qmsRecordVersion.count({where:{qmsRecordId:entity.qmsRecordId}});
    expect((await asUser(reader,()=>GET(request(),params))).status).toBe(403);
    const response=await asUser(qa,()=>GET(request(),params));
    if(response.status!==200)throw Error("Synthetic native working annex rejected: "+module+"/"+annex+" "+response.status+" "+await response.text());
    const output=new Uint8Array(await response.arrayBuffer());
    expect(await inspector.qmsRecordVersion.count({where:{qmsRecordId:entity.qmsRecordId}})).toBe(count);
    const op=await inspector.auditOperation.findUniqueOrThrow({where:{actorUserId_origin_requestId:{actorUserId:qa.id,origin:"QMS_SERVER",requestId}},include:{events:true,targets:true,commandResult:true}});
    expect(op.actorUserId).toBe(qa.id);expect(op.targets.some(t=>t.rootKey==="QMS_RECORD:"+entity.qmsRecordId)).toBe(true);
    const docEvent=op.events.find(e=>e.entityType==="GeneratedDocument"&&e.fieldPath==="id")!;expect(docEvent).toBeDefined();
    const document=await inspector.generatedDocument.findUniqueOrThrow({where:{id:docEvent.entityId}});
    expect(document.generatedByText).toBe(qa.name);expect(document.checksum).toBe(createHash("sha256").update(output).digest("hex"));
    if(module!=="RETURN")expect(document.fileData).toBeNull(); // Metadata receipt, no new official Word original.
    else expect(document.fileData).toEqual(output); // Preserve Return's existing archived download behavior.
    expect(JSON.stringify(op.commandResult?.outcome)).not.toContain("fileData");
    const before=await inspector.generatedDocument.count({where:{qmsRecordId:entity.qmsRecordId}});
    const repeated=await asUser(qa,()=>GET(request(),params));expect(repeated.status).toBe(200);
    expect(new Uint8Array(await repeated.arrayBuffer())).toEqual(output);
    expect(await inspector.generatedDocument.count({where:{qmsRecordId:entity.qmsRecordId}})).toBe(before);
  }
},90000);

it("captures original operational relation adapters across the five QMS modules with both real roots and reversible withdrawal",async()=>{
  const deviation=await inspector.deviation.findFirstOrThrow({where:{whatHappened:"Synthetic B2 operational deviation"},include:{qmsRecord:true}});
  const capa=await inspector.capa.findFirstOrThrow({where:{defectDescription:"Synthetic B2 operational CAPA"},include:{qmsRecord:true}});
  const complaint=await inspector.complaint.findFirstOrThrow({where:{description:"Synthetic B2 operational complaint"},include:{qmsRecord:true}});
  const returned=await inspector.returnRecord.findFirstOrThrow({where:{reasonObservations:"Synthetic B2 operational return"},include:{qmsRecord:true}});
  const change=await inspector.changeControl.findFirstOrThrow({where:{description:"Synthetic B2 operational change"},include:{qmsRecord:true}});
  const {unlinkDeviationCapaAction,addDeviationRelationAction}=await import("../../src/modules/deviations/actions");
  const {addCapaRelationAction}=await import("../../src/modules/capa/actions");
  const {addComplaintRelationAction,unlinkComplaintRelationAction}=await import("../../src/modules/complaints/actions");
  const {addReturnRelationAction,unlinkReturnComplaintAction}=await import("../../src/modules/returns/actions");
  const {addChangeControlRelationAction}=await import("../../src/modules/change-control/actions");
  // Exercise a genuine deactivation/reactivation through the native adapter;
  // its original creation came from CAPA's authenticated opening/provenance.
  const initialRelation=await inspector.qmsRelation.findUniqueOrThrow({where:{sourceRecordId_targetRecordId_relationType:{sourceRecordId:deviation.qmsRecordId,targetRecordId:capa.qmsRecordId,relationType:"GENERATES"}}});
  expect(initialRelation.isActive).toBe(true);
  const unlinkId=randomUUID();
  await settled(()=>asUser(qa,()=>unlinkDeviationCapaAction(deviation.id,capa.qmsRecordId,form({reason:"Synthetic original relation withdrawal",_covexAuditRequestId:unlinkId}))));
  expect((await inspector.qmsRelation.findUniqueOrThrow({where:{id:initialRelation.id}})).isActive).toBe(false);
  expect(await inspector.auditOperation.findUniqueOrThrow({where:{actorUserId_origin_requestId:{actorUserId:qa.id,origin:"QMS_SERVER",requestId:unlinkId}}})).toBeDefined();
  const execute=async(label:string,source:string,target:string,call:(requestId:string)=>Promise<unknown>)=>{
    const requestId=randomUUID();
    const outcome=await settled(()=>call(requestId));
    if(outcome&&typeof outcome==="object"&&"error" in outcome&&outcome.error)throw Error("Native relation rejected: "+JSON.stringify(outcome));
    const op=await inspector.auditOperation.findUnique({where:{actorUserId_origin_requestId:{actorUserId:qa.id,origin:"QMS_SERVER",requestId}},include:{events:true,targets:true}});
    if(!op)throw Error(`Native relation ${label} completed without a durable operation`);
    expect(op.actorName).toBe(qa.name);expect(op.events.some(e=>e.entityType==="QmsRelation")).toBe(true);
    for(const id of [source,target])expect(op.targets.some(t=>t.rootKey==="QMS_RECORD:"+id)).toBe(true);
    const count=await inspector.auditOperation.count();expect(await settled(()=>call(requestId))).toEqual(outcome);expect(await inspector.auditOperation.count()).toBe(count);
  };
  await expect(asUser(reader,()=>addDeviationRelationAction(deviation.id,{error:null},form({businessCode:capa.qmsRecord.businessCode!,recordType:"CAPA"})))).rejects.toMatchObject({status:403});
  await execute("deviation-capa",deviation.qmsRecordId,capa.qmsRecordId,id=>asUser(qa,()=>addDeviationRelationAction(deviation.id,{error:null},form({businessCode:capa.qmsRecord.businessCode!,recordType:"CAPA",reason:"Synthetic reinstatement",_covexAuditRequestId:id}))));
  await execute("complaint-capa",complaint.qmsRecordId,capa.qmsRecordId,id=>asUser(qa,()=>addCapaRelationAction(capa.id,{error:null},form({businessCode:complaint.qmsRecord.businessCode!,recordType:"COMPLAINT",reason:"Synthetic additional native CAPA provenance",_covexAuditRequestId:id}))));
  await execute("complaint-return",complaint.qmsRecordId,returned.qmsRecordId,id=>asUser(qa,()=>addComplaintRelationAction(complaint.id,{error:null},form({businessCode:returned.qmsRecord.businessCode!,recordType:"RETURN",targetRecordId:returned.qmsRecordId,reason:"Synthetic explicit derived return",_covexAuditRequestId:id}))));
  await settled(()=>asUser(qa,()=>unlinkReturnComplaintAction(returned.id,complaint.qmsRecordId,form({reason:"Synthetic original Return relation withdrawal",_covexAuditRequestId:randomUUID()}))));
  await execute("return-complaint",complaint.qmsRecordId,returned.qmsRecordId,id=>asUser(qa,()=>addReturnRelationAction(returned.id,{error:null},form({businessCode:complaint.qmsRecord.businessCode!,recordType:"COMPLAINT",targetRecordId:complaint.qmsRecordId,reason:"Synthetic native return provenance reinstatement",_covexAuditRequestId:id}))));
  // Change Control still exposes a legacy generic-relation adapter, while the
  // approved operational matrix deliberately contains no Change Control pair.
  // Prove that the adapter fails closed and cannot manufacture an audited
  // operation for an unsupported business relationship.
  const unsupportedId=randomUUID(),unsupportedBefore=await inspector.auditOperation.count();
  expect(await inspector.qmsRelation.findUnique({where:{sourceRecordId_targetRecordId_relationType:{sourceRecordId:change.qmsRecordId,targetRecordId:deviation.qmsRecordId,relationType:"ASSOCIATED_WITH"}}})).toBeNull();
  const unsupported=await settled(()=>asUser(qa,()=>addChangeControlRelationAction(change.id,form({businessCode:deviation.qmsRecord.businessCode!,relationType:"ASSOCIATED_WITH",reason:"Synthetic unsupported cross-module change relation",_covexAuditRequestId:unsupportedId}))));
  expect(unsupported).toHaveProperty("redirect",expect.stringContaining("relationError="));
  expect(await inspector.auditOperation.count()).toBe(unsupportedBefore);
  expect(await inspector.qmsRelation.findUnique({where:{sourceRecordId_targetRecordId_relationType:{sourceRecordId:change.qmsRecordId,targetRecordId:deviation.qmsRecordId,relationType:"ASSOCIATED_WITH"}}})).toBeNull();
  await settled(()=>asUser(qa,()=>unlinkComplaintRelationAction(complaint.id,returned.qmsRecordId,form({reason:"Synthetic native Complaint relation withdrawal",_covexAuditRequestId:randomUUID()}))));
  expect((await inspector.qmsRelation.findUniqueOrThrow({where:{sourceRecordId_targetRecordId_relationType:{sourceRecordId:complaint.qmsRecordId,targetRecordId:returned.qmsRecordId,relationType:"GENERATES"}}})).isActive).toBe(false);
},60000);

it("keeps historical imports and backfill blocked under mandatory capture until an IT-controlled identity/provenance protocol exists",async()=>{
  const {writeZip}=await import("../../src/lib/ooxml/zip"),{spawnSync}=await import("node:child_process");
  // Both original parsers accept these sheets. Even an empty source must not
  // create a nominally successful unauthenticated historical-import batch.
  const workbook=writeZip([
    {name:"xl/workbook.xml",data:Buffer.from('<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="2025" sheetId="1" r:id="rId1"/><sheet name="2026" sheetId="2" r:id="rId2"/><sheet name="Base_KPI" sheetId="3" r:id="rId3"/></sheets></workbook>')},
    {name:"xl/_rels/workbook.xml.rels",data:Buffer.from('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Target="worksheets/sheet3.xml"/></Relationships>')},
    ...[1,2,3].map(i=>({name:`xl/worksheets/sheet${i}.xml`,data:Buffer.from('<worksheet><sheetData/></worksheet>')})),
  ]);
  const {applyHistoricalImport}=await import("../../src/modules/deviations/import/import-service");
  const {applyHistoricalCapaImport}=await import("../../src/modules/capa/import/import-service");
  const counts=async()=>({batches:await inspector.historicalImportBatch.count(),rows:await inspector.historicalImportRow.count(),versions:await inspector.qmsRecordVersion.count(),records:await inspector.qmsRecord.count(),operations:await inspector.auditOperation.count(),events:await inspector.auditEvent.count()});
  const before=await counts();
  for(const execute of [()=>applyHistoricalImport(workbook,"SYNTHETIC-BLOCKED.xlsx","Untrusted nominal console actor",[2025,2026]),()=>applyHistoricalCapaImport(workbook,"SYNTHETIC-BLOCKED.xlsx","Untrusted nominal console actor")]) {
    await expect(asUser<unknown>(qa,execute)).rejects.toThrow();expect(await counts()).toEqual(before);
  }
  const {prisma}=await import("../../src/lib/db"),{businessSqlFixture}=await import("./database");
  await asUser(qa,()=>businessSqlFixture(prisma,qa.id,randomUUID(),"DV01","DEVIATION","CREATE",null,async tx=>{
    const root=await tx.qmsRecord.create({data:{recordType:"DEVIATION"}});
    await tx.deviation.create({data:{qmsRecordId:root.id,status:"DRAFT",internalObservations:"Synthetic own legacy backfill candidate"}});
  }));
  const afterFixture=await counts();
  const result=spawnSync(process.execPath,["--conditions=react-server","--import","tsx","scripts/backfill-record-versions.ts"],{env:{...process.env},encoding:"utf8",timeout:30000});
  expect(result.status).not.toBe(0);expect(result.error).toBeUndefined();
  expect(await counts()).toEqual(afterFixture);
},60000);
