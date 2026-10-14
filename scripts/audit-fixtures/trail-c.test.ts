import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { identityContext, type Principal } from "../../src/lib/auth/context";
import { isolatedTestEnvironment } from "../../src/lib/auth/config";
import { fixtureUsers } from "../auth-fixtures/constants";

vi.mock("server-only",()=>({}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:(url:string)=>{throw Object.assign(new Error("NEXT_REDIRECT"),{digest:`NEXT_REDIRECT;replace;${url};307;`});}}));
const url=new URL(process.env.B2_CAPTURE_INSPECTOR_URL!);
if(!isolatedTestEnvironment()||!["localhost","127.0.0.1"].includes(url.hostname)||!/^\/covex_phase4b1_test_b2_capture_[a-f0-9]+$/.test(url.pathname))throw Error("Own disposable C fixture required");
const inspector=new PrismaClient({datasourceUrl:url.href,log:[]});
let qa:Principal,reader:Principal,admin:Principal;
beforeAll(async()=>{const {issueSession,sessionFromToken}=await import("../../src/lib/auth/session");qa=(await sessionFromToken((await issueSession(fixtureUsers.qa.id)).token)).principal;reader=(await sessionFromToken((await issueSession(fixtureUsers.reader.id)).token)).principal;admin=(await sessionFromToken((await issueSession(fixtureUsers.admin.id)).token)).principal;});
afterAll(async()=>{await inspector.$disconnect();await (await import("../../src/lib/db")).prisma.$disconnect();});
const asUser=<T>(user:Principal,run:()=>Promise<T>)=>identityContext.run({principal:user,testHarness:true},run);
const redirectResult=async(run:()=>Promise<unknown>)=>{try{return await run();}catch(error){if(error&&typeof error==="object"&&"digest" in error&&String(error.digest).startsWith("NEXT_REDIRECT;"))return String(error.digest);throw error;}};
const form=(values:Record<string,string>,operations:string[]=[])=>{const result=new FormData();for(const [key,value] of Object.entries(values))result.set(key,value);for(const id of operations)result.append("operationId",id);return result;};

it("preserves global business reads, server pagination and a separately protected sensitive stream",async()=>{
  const {queryAuditTrail}=await import("../../src/lib/audit/trail");
  const first=await asUser(reader,()=>queryAuditTrail({}, {page:1,pageSize:1}));
  expect(first.operations).toHaveLength(1);expect(first.total).toBeGreaterThan(1);expect(first.hasNext).toBe(true);
  const second=await asUser(reader,()=>queryAuditTrail({}, {page:2,pageSize:1}));
  expect(second.operations).toHaveLength(1);expect(second.operations[0].id).not.toBe(first.operations[0].id);
  expect(first.operations[0].events.length).toBeGreaterThan(0);
  expect(first.operations[0].rootKeys.every(key=>key.startsWith("QMS_RECORD:")||key.startsWith("PNT:"))).toBe(true);
  await expect(asUser(reader,()=>queryAuditTrail({sensitive:true},{page:1}))).rejects.toMatchObject({status:403});
  const sensitive=await asUser(qa,()=>queryAuditTrail({sensitive:true},{page:1}));
  expect(sensitive.operations.every(operation=>operation.rootKeys.every(key=>key.startsWith("ADMINISTRATION:")))).toBe(true);
});

it("records exact append-only QA review scopes and corrections without changing source events",async()=>{
  const {auditTrailCutoff,queryAuditTrail}=await import("../../src/lib/audit/trail");
  const {recordAuditTrailReviewAction}=await import("../../src/lib/audit/trail-actions");
  const cutoff=(await auditTrailCutoff())!,selection=await asUser(qa,()=>queryAuditTrail({}, {page:1,pageSize:1})),operation=selection.operations[0];
  const denied=form({filters:"{}",cutoffOccurredAt:cutoff.occurredAt.toISOString(),cutoffOperationId:cutoff.id,result:"NO_OBSERVATIONS",notes:"",_covexAuditRequestId:randomUUID()},[operation.id]);
  await expect(asUser(reader,()=>recordAuditTrailReviewAction(denied))).rejects.toMatchObject({status:403});
  await expect(asUser(admin,()=>recordAuditTrailReviewAction(denied))).rejects.toMatchObject({status:403});
  const requestId=randomUUID(),reviewForm=form({filters:"{}",cutoffOccurredAt:cutoff.occurredAt.toISOString(),cutoffOperationId:cutoff.id,result:"OBSERVATIONS_RECORDED",notes:"Synthetic technical observation; no GMP approval.",_covexAuditRequestId:requestId},[operation.id]);
  expect(await asUser(qa,()=>redirectResult(()=>recordAuditTrailReviewAction(reviewForm)))).toContain("/audit-trail?reviewed=");
  const receipt=await inspector.auditTrailReview.findUniqueOrThrow({where:{reviewerUserId_requestId:{reviewerUserId:qa.id,requestId}},include:{operations:true,events:true}});
  expect(receipt.reviewerName).toBe(qa.name);expect(receipt.operations.map(item=>item.operationId)).toEqual([operation.id]);expect(receipt.events.map(item=>item.eventId).sort()).toEqual(operation.events.map(event=>event.id).sort());
  expect(await inspector.auditEvent.count({where:{id:{in:receipt.events.map(item=>item.eventId)}}})).toBe(receipt.events.length);
  await expect(inspector.auditTrailReview.update({where:{id:receipt.id},data:{notes:"Forbidden rewrite"}})).rejects.toThrow();
  await expect(inspector.auditTrailReviewEvent.deleteMany({where:{reviewId:receipt.id}})).rejects.toThrow();
  const correctionId=randomUUID(),correction=form({filters:"{}",cutoffOccurredAt:cutoff.occurredAt.toISOString(),cutoffOperationId:cutoff.id,result:"NO_OBSERVATIONS",notes:"Synthetic correction by additional append-only receipt.",supersedesId:receipt.id,_covexAuditRequestId:correctionId},[operation.id]);
  await asUser(qa,()=>redirectResult(()=>recordAuditTrailReviewAction(correction)));
  expect((await inspector.auditTrailReview.findUniqueOrThrow({where:{reviewerUserId_requestId:{reviewerUserId:qa.id,requestId:correctionId}}})).supersedesId).toBe(receipt.id);
  expect((await asUser(reader,()=>queryAuditTrail({review:"REVIEWED"},{page:1,pageSize:50}))).operations.some(item=>item.id===operation.id)).toBe(true);
});

it("creates a cut, hash and immutable event manifest for controlled exports and protects downloads",async()=>{
  const {createAuditTrailExportAction}=await import("../../src/lib/audit/trail-actions");
  const {GET}=await import("../../src/app/api/audit-trail/exports/[id]/route");
  const denied=form({filters:"{}",_covexAuditRequestId:randomUUID()});
  await expect(asUser(reader,()=>createAuditTrailExportAction(denied))).rejects.toMatchObject({status:403});
  await expect(asUser(admin,()=>createAuditTrailExportAction(denied))).rejects.toMatchObject({status:403});
  const requestId=randomUUID(),exportForm=form({filters:JSON.stringify({module:"DEVIATION"}),_covexAuditRequestId:requestId});
  const redirected=await asUser(qa,()=>redirectResult(()=>createAuditTrailExportAction(exportForm)));expect(redirected).toContain("/api/audit-trail/exports/");
  const item=await inspector.auditTrailExport.findUniqueOrThrow({where:{actorUserId_requestId:{actorUserId:qa.id,requestId}},include:{events:true}});
  expect(item.actorName).toBe(qa.name);expect(item.rowCount).toBe(item.events.length);expect(item.events.length).toBeGreaterThan(0);expect(item.contentSha256).toBe(createHash("sha256").update(item.fileData).digest("hex"));
  expect(item.scopeManifest).toMatchObject({version:"COVEX_AUDIT_EXPORT_MANIFEST_V1",contentSha256:item.contentSha256,eventCount:item.rowCount});
  await expect(inspector.auditTrailExport.update({where:{id:item.id},data:{fileName:"forbidden.csv"}})).rejects.toThrow();
  const params={params:Promise.resolve({id:item.id})},request=new Request(`http://127.0.0.1/api/audit-trail/exports/${item.id}`);
  const download=await asUser(qa,()=>GET(request,params));expect(download.status).toBe(200);expect(download.headers.get("X-COVEX-Content-SHA256")).toBe(item.contentSha256);expect(Buffer.from(await download.arrayBuffer())).toEqual(Buffer.from(item.fileData));
  expect((await asUser(reader,()=>GET(request,params))).status).toBe(403);expect((await asUser(admin,()=>GET(request,params))).status).toBe(403);
});
