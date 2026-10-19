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
let qa: Principal, reader: Principal, admin: Principal;
beforeAll(async () => {
  const { issueSession, sessionFromToken } = await import("../../src/lib/auth/session");
  qa = (await sessionFromToken((await issueSession(fixtureUsers.qa.id)).token)).principal;
  reader = (await sessionFromToken((await issueSession(fixtureUsers.reader.id)).token)).principal;
  admin = (await sessionFromToken((await issueSession(fixtureUsers.admin.id)).token)).principal;
});
afterAll(async () => { await inspector.$disconnect(); await (await import("../../src/lib/db")).prisma.$disconnect(); });
const asUser = <T>(user: Principal, execute: () => Promise<T>) => identityContext.run({ principal: user, testHarness: true }, execute);
const form = (values: Record<string,string>) => { const fd = new FormData(); Object.entries(values).forEach(([key,value]) => fd.set(key,value)); return fd; };
const settled = async (execute: () => Promise<unknown>) => { try { return await execute(); } catch (error) { if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT;")) return { redirect: error.digest }; throw error; } };

it("captures original report issuance/closure and retained document generation with scoped authorization and replay",async()=>{
  const {prisma}=await import("../../src/lib/db");
  const {businessSqlFixture}=await import("./database");
  const {createHash}=await import("node:crypto");
  const {syntheticAuditReport,syntheticAuditCapaPlan}=await import("../audits-r3c-fixtures");
  await asUser(qa,()=>businessSqlFixture(prisma,qa.id,randomUUID(),"TR04","AUDIT","MANAGE_CONFIGURATION",null,async tx=>{
    for(const [documentType,bytes] of [["AUDIT_INTERNAL_REPORT",syntheticAuditReport()],["AUDIT_CAPA_PLAN",syntheticAuditCapaPlan()]] as const) {
      await tx.templateVersion.create({data:{module:"AUDIT",documentType,versionCode:"SYNTHETIC-B2-REPORT",effectiveFrom:new Date("2099-01-01"),fileName:"synthetic-template",fileData:new Uint8Array(bytes),fileSize:bytes.length,checksum:createHash("sha256").update(bytes).digest("hex")}});
    }
  }));
  const {saveAuditAction}=await import("../../src/modules/audits/actions");
  const {saveAuditReportAction,issueAuditReportAction,closeAuditAction}=await import("../../src/modules/audits/report-actions");
  const department=await inspector.department.findUniqueOrThrow({where:{code:"GC-00"}}),title="Synthetic B2 formal-report fixture";
  const opened=await settled(()=>asUser(qa,()=>saveAuditAction(null,{error:null},form({...operationalValues("AUDIT",department.id),title,performedDate:"2026-10-10",_covexAuditRequestId:randomUUID()}))));
  expect(opened).toHaveProperty("error",null);
  const audit=await inspector.audit.findFirstOrThrow({where:{title}});
  expect(await asUser(qa,()=>saveAuditReportAction(audit.id,{error:null},form({reportDate:"2026-10-11",conclusion:"Synthetic supported audit conclusion",preparedBy:"External nominal preparer",reviewedBy:"External nominal reviewer",_covexAuditRequestId:randomUUID()})))).toHaveProperty("error",null);
  const issueId=randomUUID();
  await expect(asUser(reader,()=>issueAuditReportAction(audit.id,{error:null},form({_covexAuditRequestId:issueId})))).rejects.toMatchObject({status:403});
  const issued=await asUser(qa,()=>issueAuditReportAction(audit.id,{error:null},form({_covexAuditRequestId:issueId})));expect(issued.error).toBeNull();
  const version=await inspector.qmsRecordVersion.findFirstOrThrow({where:{qmsRecordId:audit.qmsRecordId},orderBy:{sequenceNumber:"desc"}});
  expect(version.frozenAt).not.toBeNull();expect(version.createdByText).toBe(qa.name);
  expect(await asUser(qa,()=>issueAuditReportAction(audit.id,{error:null},form({_covexAuditRequestId:issueId})))).toEqual(issued);
  const {GET}=await import("../../src/app/api/audits/[id]/documents/route");
  const requestId=randomUUID(),request=()=>new Request(`http://127.0.0.1/api/audits/${audit.id}/documents?type=AUDIT_INTERNAL_REPORT&version=${version.sequenceNumber}`,{headers:{"idempotency-key":requestId}}),params={params:Promise.resolve({id:audit.id})};
  expect((await asUser(reader,()=>GET(request(),params))).status).toBe(403);
  await inspector.$executeRawUnsafe('ALTER TABLE "AuditEvent" ADD CONSTRAINT synthetic_document_capture_failure CHECK ("entityType"<>\'GeneratedDocument\') NOT VALID');
  const before={documents:await inspector.generatedDocument.count({where:{qmsRecordId:audit.qmsRecordId}}),histories:await inspector.changeHistory.count({where:{qmsRecordId:audit.qmsRecordId}})};
  try {
    expect((await asUser(qa,()=>GET(request(),params))).status).toBe(409);
    expect({documents:await inspector.generatedDocument.count({where:{qmsRecordId:audit.qmsRecordId}}),histories:await inspector.changeHistory.count({where:{qmsRecordId:audit.qmsRecordId}})}).toEqual(before);
    expect(await inspector.auditOperation.count({where:{requestId}})).toBe(0);
  } finally {await inspector.$executeRawUnsafe('ALTER TABLE "AuditEvent" DROP CONSTRAINT synthetic_document_capture_failure');}
  const downloaded=await asUser(qa,()=>GET(request(),params));expect(downloaded.status).toBe(200);
  const bytes=new Uint8Array(await downloaded.arrayBuffer());
  const original=await inspector.generatedDocument.findFirstOrThrow({where:{qmsRecordId:audit.qmsRecordId,documentType:"AUDIT_INTERNAL_REPORT"}});
  expect(original.fileData).toEqual(bytes);expect(original.generatedByText).toBe(qa.name);expect(original.recordVersionId).toBe(version.id);
  expect(original.checksum).toBe(createHash("sha256").update(bytes).digest("hex"));
  const op=await inspector.auditOperation.findUniqueOrThrow({where:{actorUserId_origin_requestId:{actorUserId:qa.id,origin:"QMS_SERVER",requestId}},include:{events:true,commandResult:true,evidence:true}});
  expect(op.events.some(e=>e.entityType==="GeneratedDocument"&&e.fieldPath==="checksum")).toBe(true);expect(op.evidence.length).toBeGreaterThan(0);
  expect(JSON.stringify(op.commandResult?.outcome)).not.toContain("fileData");
  const replay=await asUser(qa,()=>GET(request(),params));expect(new Uint8Array(await replay.arrayBuffer())).toEqual(bytes);
  expect(await inspector.generatedDocument.count({where:{qmsRecordId:audit.qmsRecordId,documentType:"AUDIT_INTERNAL_REPORT"}})).toBe(1);
  const {withBusinessAudit}=await import("../../src/lib/audit/business-service");
  await expect(asUser(qa,()=>withBusinessAudit({operationCode:"AU06",module:"AUDIT",permission:"GENERATE_DOCUMENT"},{requestId:randomUUID(),digest:"4".repeat(64),reason:"Synthetic forbidden original metadata rewrite"},async tx=>{await tx.generatedDocument.update({where:{id:original.id},data:{fileName:"forbidden-replacement.docx"}});}))).rejects.toThrow();
  expect(await inspector.generatedDocument.findUniqueOrThrow({where:{id:original.id}})).toEqual(original);
  // Working CAPA Plans retain the original archive behavior but do not issue a report version.
  const count=await inspector.qmsRecordVersion.count({where:{qmsRecordId:audit.qmsRecordId}});
  const workRequest=new Request(`http://127.0.0.1/api/audits/${audit.id}/documents?type=AUDIT_CAPA_PLAN`,{headers:{"idempotency-key":randomUUID()}});
  expect((await asUser(qa,()=>GET(workRequest,params))).status).toBe(200);
  expect(await inspector.qmsRecordVersion.count({where:{qmsRecordId:audit.qmsRecordId}})).toBe(count);
  const closureId=randomUUID();
  expect(await asUser(qa,()=>closeAuditAction(audit.id,{error:null},form({closedAt:"2026-10-12",reason:"Synthetic explicit QA closure of completed report",_covexAuditRequestId:closureId})))).toHaveProperty("error",null);
  expect((await inspector.audit.findUniqueOrThrow({where:{id:audit.id}})).status).toBe("CLOSED");
  const closure=await inspector.auditOperation.findUniqueOrThrow({where:{actorUserId_origin_requestId:{actorUserId:qa.id,origin:"QMS_SERVER",requestId:closureId}},include:{assessment:true,events:true}});
  expect(closure.assessment?.proposedCritical).toBe(true);expect(closure.events.some(e=>e.entityType==="Audit"&&e.fieldPath==="status")).toBe(true);
  expect((await inspector.qmsRecordVersion.findUniqueOrThrow({where:{id:version.id}})).snapshot).toEqual(version.snapshot);
},60000);

it("captures the CAPA plan version 00 (AU06) with scoped authorization, replay and download (D-110, R5C1)",async()=>{
  const {createHash}=await import("node:crypto");
  const {saveAuditAction}=await import("../../src/modules/audits/actions");
  const {establishCapaPlanAction}=await import("../../src/modules/audits/capa-plan-actions");
  const department=await inspector.department.findUniqueOrThrow({where:{code:"GC-00"}}),title="Synthetic B2 CAPA plan version fixture";
  expect(await settled(()=>asUser(qa,()=>saveAuditAction(null,{error:null},form({...operationalValues("AUDIT",department.id),title,performedDate:"2026-10-10",_covexAuditRequestId:randomUUID()}))))).toHaveProperty("error",null);
  const audit=await inspector.audit.findFirstOrThrow({where:{title}});
  const operationId=randomUUID(),planRequest=randomUUID(),values={requestId:planRequest,capaPlanDate:"2026-10-12",actor:"Spoofed actor",_covexAuditRequestId:operationId};
  await expect(asUser(reader,()=>establishCapaPlanAction(audit.id,{error:null},form(values)))).rejects.toMatchObject({status:403});
  expect(await inspector.auditCapaPlanVersion.count({where:{auditId:audit.id}})).toBe(0);
  const established=await asUser(qa,()=>establishCapaPlanAction(audit.id,{error:null},form(values)));expect(established.error).toBeNull();
  const version=await inspector.auditCapaPlanVersion.findFirstOrThrow({where:{auditId:audit.id}});
  expect(version.sequenceNumber).toBe(0);expect(version.generatedBy).toBe(qa.name);expect(version.authenticatedUserId).toBe(qa.id);
  const op=await inspector.auditOperation.findUniqueOrThrow({where:{actorUserId_origin_requestId:{actorUserId:qa.id,origin:"QMS_SERVER",requestId:operationId}},include:{events:true,targets:true}});
  expect(op.operation).toBe("AU06");
  expect(op.events.some(e=>e.entityType==="AuditCapaPlanVersion"&&e.fieldPath==="checksum")).toBe(true);
  expect(op.events.some(e=>e.entityType==="AuditCapaPlanVersion"&&e.fieldPath==="fileData")).toBe(false);
  expect(op.events.some(e=>e.entityType==="Audit"&&e.fieldPath==="capaPlanDate")).toBe(true);
  expect(op.targets.some(t=>t.rootKey==="QMS_RECORD:"+audit.qmsRecordId)).toBe(true);
  expect(await asUser(qa,()=>establishCapaPlanAction(audit.id,{error:null},form(values)))).toEqual(established);
  expect(await inspector.auditCapaPlanVersion.count({where:{auditId:audit.id}})).toBe(1);
  const {GET}=await import("../../src/app/api/audits/[id]/documents/route");
  const params={params:Promise.resolve({id:audit.id})},request=()=>new Request(`http://127.0.0.1/api/audits/${audit.id}/documents?capaPlanVersion=0`);
  // A frozen version is a retained file: DOWNLOAD suffices (reader), GENERATE_DOCUMENT is not required; no AUDIT grant → 403.
  expect((await asUser(admin,()=>GET(request(),params))).status).toBe(403);
  for(const user of [reader,qa]){
    const downloaded=await asUser(user,()=>GET(request(),params));expect(downloaded.status).toBe(200);
    expect(createHash("sha256").update(new Uint8Array(await downloaded.arrayBuffer())).digest("hex")).toBe(version.checksum);
  }
  expect(await inspector.auditCapaPlanVersion.count({where:{auditId:audit.id}})).toBe(1);
  expect((await asUser(qa,()=>GET(new Request(`http://127.0.0.1/api/audits/${audit.id}/documents?capaPlanVersion=x`),params))).status).toBe(400);
  // R5C2: el seguimiento (AU04, FOLLOWUP) cierra la acción y emite la versión 01 en la misma operación.
  const {saveAuditChildAction}=await import("../../src/modules/audits/finding-actions");
  const {recordCapaPlanFollowupAction}=await import("../../src/modules/audits/capa-plan-actions");
  expect(await asUser(qa,()=>saveAuditChildAction(audit.id,"finding",undefined,undefined,{error:null},form({findingType:"FINDING",criticality:"MINOR",description:"Synthetic follow-up finding",actor:"x",_covexAuditRequestId:randomUUID()})))).toHaveProperty("error",null);
  const finding=await inspector.auditFinding.findFirstOrThrow({where:{auditId:audit.id}});
  expect(await asUser(qa,()=>saveAuditChildAction(audit.id,"action",finding.id,undefined,{error:null},form({description:"Synthetic follow-up action",status:"OPEN",actor:"x",_covexAuditRequestId:randomUUID()})))).toHaveProperty("error",null);
  const action=await inspector.auditFindingAction.findFirstOrThrow({where:{findingId:finding.id}});
  const followupId=randomUUID(),followup=form({requestId:randomUUID(),followupDate:"2026-10-13",actor:"x",changeReason:"Synthetic closure on follow-up",observations:"",[`a.${action.id}.status`]:"CLOSED",[`a.${action.id}.closedAt`]:"2026-10-13",[`a.${action.id}.targetDate`]:"",[`a.${action.id}.evidenceReference`]:"REG-SYN",[`a.${action.id}.evidence`]:"",[`a.${action.id}.updatedAt`]:action.updatedAt.toISOString(),_covexAuditRequestId:followupId});
  await expect(asUser(reader,()=>recordCapaPlanFollowupAction(audit.id,{error:null},followup))).rejects.toMatchObject({status:403});
  expect(await asUser(qa,()=>recordCapaPlanFollowupAction(audit.id,{error:null},followup))).toHaveProperty("error",null);
  const followupOp=await inspector.auditOperation.findUniqueOrThrow({where:{actorUserId_origin_requestId:{actorUserId:qa.id,origin:"QMS_SERVER",requestId:followupId}},include:{events:true}});
  expect(followupOp.operation).toBe("AU04");expect(followupOp.reason).toBe("Synthetic closure on follow-up");
  expect(followupOp.events.some(e=>e.entityType==="AuditFindingAction"&&e.fieldPath==="status")).toBe(true);
  expect(followupOp.events.some(e=>e.entityType==="AuditCapaPlanVersion"&&e.fieldPath==="checksum")).toBe(true);
  expect((await inspector.auditCapaPlanVersion.findFirstOrThrow({where:{auditId:audit.id,sequenceNumber:1}})).kind).toBe("FOLLOWUP");
},60000);
