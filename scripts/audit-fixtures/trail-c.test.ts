import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
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
const idsSql=(ids:string[])=>Prisma.sql`ARRAY[${Prisma.join(ids)}]::uuid[]`;

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

it("includes the exact cutoff operation without admitting newer operations or a forged cutoff timestamp",async()=>{
  const {queryAuditTrail,exactAuditTrailOperationSelection,exactAuditTrailSelection}=await import("../../src/lib/audit/trail");
  const {operations}=await asUser(qa,()=>queryAuditTrail({module:"DEVIATION"},{pageSize:2}));
  expect(operations).toHaveLength(2);
  const [newer,boundary]=operations,cutoff={id:boundary.id,occurredAt:boundary.occurredAt};
  const selected=await asUser(qa,()=>exactAuditTrailOperationSelection({module:"DEVIATION"},cutoff,[boundary.id]));
  expect(selected.operationIds).toEqual([boundary.id]);
  const [stored]=await inspector.$queryRaw<{exact:string}[]>(Prisma.sql`SELECT to_char("occurredAt" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS exact FROM "AuditOperation" WHERE id=${boundary.id}::uuid`);
  expect(selected.cutoff.occurredAt).toBe(stored.exact);
  const exported=await asUser(qa,()=>exactAuditTrailSelection({module:"DEVIATION"},cutoff));
  expect(exported.operations.some(operation=>operation.id===boundary.id)).toBe(true);
  expect(exported.operations.some(operation=>operation.id===newer.id)).toBe(false);
  await expect(asUser(qa,()=>exactAuditTrailOperationSelection({module:"DEVIATION"},cutoff,[boundary.id,newer.id]))).rejects.toMatchObject({status:403});
  await expect(asUser(qa,()=>exactAuditTrailOperationSelection({module:"DEVIATION"},{...cutoff,occurredAt:new Date(cutoff.occurredAt.valueOf()+1)},[boundary.id]))).rejects.toMatchObject({status:403});
  await expect(asUser(qa,()=>exactAuditTrailOperationSelection({module:"DEVIATION"},{...cutoff,id:randomUUID()},[boundary.id]))).rejects.toMatchObject({status:403});
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
  expect(await asUser(qa,()=>redirectResult(()=>recordAuditTrailReviewAction(reviewForm)))).toContain(receipt.id);
  expect(await inspector.auditTrailReview.count({where:{reviewerUserId:qa.id,requestId}})).toBe(1);
  reviewForm.set("notes","Conflicting retry must not rewrite the receipt");
  await expect(asUser(qa,()=>recordAuditTrailReviewAction(reviewForm))).rejects.toThrow(/Review request conflict/);
  expect(receipt.reviewerName).toBe(qa.name);expect(receipt.operations.map(item=>item.operationId)).toEqual([operation.id]);expect(receipt.events.map(item=>item.eventId).sort()).toEqual(operation.events.map(event=>event.id).sort());
  const manifest=receipt.scopeManifest as {cutoff:{occurredAt:string};operationIds:string[];eventIds:string[]};
  const [precision]=await inspector.$queryRaw<{same:boolean}[]>(Prisma.sql`SELECT r."cutoffOccurredAt"=o."occurredAt" AS same FROM "AuditTrailReview" r JOIN "AuditOperation" o ON o.id=r."cutoffOperationId" WHERE r.id=${receipt.id}::uuid`);
  expect(precision.same).toBe(true);
  const rawReview=(actorId=qa.id,cutoffTime:Date|string=manifest.cutoff.occurredAt,scope:unknown=receipt.scopeManifest,eventIds=manifest.eventIds)=>inspector.$queryRaw(Prisma.sql`SELECT covex_c_record_review(${randomUUID()}::uuid,${randomUUID()}::uuid,${receipt.requestDigest},${actorId}::uuid,${receipt.result},${receipt.notes},${JSON.stringify(scope)}::jsonb,${cutoffTime}::timestamptz,${receipt.cutoffOperationId}::uuid,${idsSql(manifest.operationIds)},${idsSql(eventIds)},NULL::uuid)`);
  await expect(rawReview(reader.id)).rejects.toThrow(/Explicit audit review permission required/);
  await expect(rawReview(admin.id)).rejects.toThrow(/Explicit audit review permission required/);
  await expect(rawReview(qa.id,new Date(receipt.cutoffOccurredAt.valueOf()-1))).rejects.toThrow(/exceeds cut/);
  await expect(rawReview(qa.id,manifest.cutoff.occurredAt,receipt.scopeManifest,[randomUUID()])).rejects.toThrow(/Review event scope mismatch/);
  await expect(rawReview(qa.id,manifest.cutoff.occurredAt,{...manifest,eventIds:[]})).rejects.toThrow(/Review manifest/);
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
  expect(await asUser(qa,()=>redirectResult(()=>createAuditTrailExportAction(exportForm)))).toContain(item.id);
  exportForm.set("filters",JSON.stringify({module:"CAPA"}));
  await expect(asUser(qa,()=>createAuditTrailExportAction(exportForm))).rejects.toThrow(/Export request conflict/);
  expect(item.actorName).toBe(qa.name);expect(item.rowCount).toBe(item.events.length);expect(item.events.length).toBeGreaterThan(0);expect(item.contentSha256).toBe(createHash("sha256").update(item.fileData).digest("hex"));
  expect(item.scopeManifest).toMatchObject({version:"COVEX_AUDIT_EXPORT_MANIFEST_V1",contentSha256:item.contentSha256,eventCount:item.rowCount});
  const manifest=item.scopeManifest as {cutoff:{occurredAt:string};operationIds:string[];eventIds:string[]};
  const rawExport=({actorId=qa.id,nonce=randomUUID(),digest=item.requestDigest,rowCount=item.rowCount,scope=item.scopeManifest,cutoffTime=manifest.cutoff.occurredAt}:{actorId?:string;nonce?:string;digest?:string;rowCount?:number;scope?:unknown;cutoffTime?:string}={})=>inspector.$queryRaw<{id:string}[]>(Prisma.sql`SELECT covex_c_record_export(${randomUUID()}::uuid,${nonce}::uuid,${digest},${actorId}::uuid,${item.format},${item.fileName},${new Uint8Array(item.fileData)}::bytea,${JSON.stringify(scope)}::jsonb,${cutoffTime}::timestamptz,${item.cutoffOperationId}::uuid,${idsSql(manifest.operationIds)},${idsSql(manifest.eventIds)},${rowCount}::integer) AS id`);
  expect(await rawExport({nonce:requestId})).toEqual([{id:item.id}]);
  expect(await inspector.auditTrailExport.count({where:{actorUserId:qa.id,requestId}})).toBe(1);
  await expect(rawExport({nonce:requestId,digest:"0".repeat(64)})).rejects.toThrow(/Export request conflict/);
  await expect(rawExport({actorId:reader.id})).rejects.toThrow(/Explicit audit export permission required/);
  await expect(rawExport({actorId:admin.id})).rejects.toThrow(/Explicit audit export permission required/);
  await expect(rawExport({rowCount:item.rowCount+1})).rejects.toThrow(/Bounded exact export scope required/);
  await expect(rawExport({scope:{...manifest,eventIds:[]}})).rejects.toThrow(/Export manifest/);
  await expect(rawExport({cutoffTime:"2000-01-01T00:00:00.000000Z"})).rejects.toThrow(/exceeds cut/);
  const [precision]=await inspector.$queryRaw<{same:boolean}[]>(Prisma.sql`SELECT x."cutoffOccurredAt"=o."occurredAt" AS same FROM "AuditTrailExport" x JOIN "AuditOperation" o ON o.id=x."cutoffOperationId" WHERE x.id=${item.id}::uuid`);
  expect(precision.same).toBe(true);
  await expect(inspector.auditTrailExport.update({where:{id:item.id},data:{fileName:"forbidden.csv"}})).rejects.toThrow();
  const params={params:Promise.resolve({id:item.id})},request=new Request(`http://127.0.0.1/api/audit-trail/exports/${item.id}`);
  const download=await asUser(qa,()=>GET(request,params));expect(download.status).toBe(200);expect(download.headers.get("X-COVEX-Content-SHA256")).toBe(item.contentSha256);expect(Buffer.from(await download.arrayBuffer())).toEqual(Buffer.from(item.fileData));
  expect((await asUser(reader,()=>GET(request,params))).status).toBe(403);expect((await asUser(admin,()=>GET(request,params))).status).toBe(403);
});

it("fails closed for weakened C triggers, public RPC access and an unsafe application writer",async()=>{
  const {prisma}=await import("../../src/lib/db");
  const {assertAuditProtection,assertAuditApplicationRole}=await import("../../src/lib/audit/protection");
  const {createAuditTrailExportAction}=await import("../../src/lib/audit/trail-actions");
  await prisma.$transaction(async tx=>{await assertAuditProtection(tx);await assertAuditApplicationRole(tx);});
  const count=await inspector.auditTrailExport.count();
  await inspector.$executeRawUnsafe('ALTER TABLE "AuditTrailExport" DISABLE TRIGGER audit_c_export_immutable');
  try{await expect(asUser(qa,()=>createAuditTrailExportAction(form({filters:"{}",_covexAuditRequestId:randomUUID()})))).rejects.toMatchObject({code:"PROTECTION"});}finally{await inspector.$executeRawUnsafe('ALTER TABLE "AuditTrailExport" ENABLE TRIGGER audit_c_export_immutable');}
  await inspector.$executeRawUnsafe('GRANT EXECUTE ON FUNCTION covex_c_has_permission(UUID,TEXT) TO PUBLIC');
  try{await expect(prisma.$transaction(tx=>assertAuditProtection(tx))).rejects.toMatchObject({code:"PROTECTION"});}finally{await inspector.$executeRawUnsafe('REVOKE EXECUTE ON FUNCTION covex_c_has_permission(UUID,TEXT) FROM PUBLIC');}
  const [connection]=await prisma.$queryRaw<{role:string}[]>`SELECT current_user AS role`;
  expect(connection.role).toMatch(/^covex4b3_[a-z0-9_]+$/);
  await inspector.$executeRawUnsafe(`GRANT UPDATE ON "AuditTrailReview" TO "${connection.role}"`);
  try{await expect(prisma.$transaction(tx=>assertAuditApplicationRole(tx))).rejects.toMatchObject({code:"PROTECTION"});}finally{await inspector.$executeRawUnsafe(`REVOKE UPDATE ON "AuditTrailReview" FROM "${connection.role}"`);}
  expect(await inspector.auditTrailExport.count()).toBe(count);
  await prisma.$transaction(async tx=>{await assertAuditProtection(tx);await assertAuditApplicationRole(tx);});
});

it("replays an unchanged pending-review command after its own receipt changes the review filter",async()=>{
  const {queryAuditTrail,auditTrailCutoff}=await import("../../src/lib/audit/trail");
  const {recordAuditTrailReviewAction}=await import("../../src/lib/audit/trail-actions");
  const selection=await asUser(qa,()=>queryAuditTrail({review:"UNREVIEWED"},{pageSize:1})),cutoff=(await auditTrailCutoff())!;
  expect(selection.operations).toHaveLength(1);
  const requestId=randomUUID(),review=form({filters:JSON.stringify({review:"UNREVIEWED"}),cutoffOccurredAt:cutoff.occurredAt.toISOString(),cutoffOperationId:cutoff.id,result:"NO_OBSERVATIONS",_covexAuditRequestId:requestId},[selection.operations[0].id]);
  const first=await asUser(qa,()=>redirectResult(()=>recordAuditTrailReviewAction(review)));
  expect(await asUser(qa,()=>redirectResult(()=>recordAuditTrailReviewAction(review)))).toBe(first);
  expect(await inspector.auditTrailReview.count({where:{reviewerUserId:qa.id,requestId}})).toBe(1);
  review.set("notes","Changed command with same request must still conflict");
  await expect(asUser(qa,()=>recordAuditTrailReviewAction(review))).rejects.toThrow(/Review request conflict/);
});
