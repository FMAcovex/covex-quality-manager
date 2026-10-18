import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { Prisma, PrismaClient, type QmsRecordType } from "@prisma/client";
import { isolatedTestEnvironment } from "../src/lib/auth/config";
import { identityContext } from "../src/lib/auth/context";
import { fixtureUsers } from "./auth-fixtures/constants";
import { auditApplicationFixture, auditedSqlFixture } from "./audit-fixtures/database";
import { assertAuditProtection } from "../src/lib/audit/protection";
import contract from "../ops/backup/audit-contract-responsible-users.json";
import type { BusinessAuditDescriptor, BusinessAuditCommand } from "../src/lib/audit/business-service";

async function main() {
  assert(isolatedTestEnvironment(),"Isolated synthetic environment required");
  const parent = new PrismaClient({ log: [] }), url = new URL(process.env.DATABASE_URL!);
  assert(["127.0.0.1","localhost"].includes(url.hostname));
  const suffix=randomBytes(8).toString("hex"), name="covex_phase4b1_test_b2_capture_"+suffix;
  const ownerRole="covex4b3_owner_"+suffix, migratorRole="covex4b3_migrator_"+suffix, appRole="covex4b3_capture_"+suffix;
  const secret=randomBytes(32).toString("hex"), roles: string[]=[];
  const previousUrl=process.env.DATABASE_URL;
  let owner: PrismaClient | undefined, app: PrismaClient | undefined, globalClient: PrismaClient | undefined, created=false;
  try {
    await parent.$executeRawUnsafe(`CREATE ROLE "${ownerRole}" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`); roles.push(ownerRole);
    await parent.$executeRawUnsafe(`CREATE ROLE "${migratorRole}" LOGIN PASSWORD '${secret}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`); roles.push(migratorRole);
    await parent.$executeRawUnsafe(`GRANT "${ownerRole}" TO "${migratorRole}"`);
    await parent.$executeRawUnsafe(`CREATE DATABASE "${name}" OWNER "${migratorRole}" TEMPLATE template0`); created=true;
    await parent.$executeRawUnsafe(`ALTER DATABASE "${name}" SET "covex.audit_owner_role" TO '${ownerRole}'`);
    url.pathname="/"+name; url.username=migratorRole; url.password=secret;
    for(const command of ["db:deploy","db:seed","auth:fixtures"]) {
      const setup=spawnSync("pnpm",[command],{ env:{...process.env,DATABASE_URL:url.href},encoding:"utf8",timeout:120000 });
      // Only fixture-local migration output; credentials/row values never printed.
      if(setup.status!==0) console.error("Synthetic setup diagnostic",command,setup.stderr.split("\n").filter(line=>/Error code:|migration|P[0-9]{4}|syntax error|ERROR:/.test(line)).slice(0,6));
      assert.equal(setup.status,0,"Synthetic capture setup failed: "+command);
    }
    owner=new PrismaClient({datasourceUrl:url.href,log:[]});
    let appUrl:URL|undefined;
    app=await auditApplicationFixture(owner,url,appRole,parent,connection=>{appUrl=connection;}); roles.push(appRole);
    for(const table of contract.privateTables) await owner.$executeRawUnsafe(`REVOKE ALL ON "${table}" FROM "${appRole}"`);
    await owner.$executeRawUnsafe(`GRANT INSERT,UPDATE,DELETE ON ${contract.guardTables.filter(table=>table!=="SignedDocumentCustody").map(table=>'"'+table+'"').join(",")} TO "${appRole}"`);
    await owner.$executeRawUnsafe(`GRANT INSERT,UPDATE,DELETE ON "AuthSession","AuthLoginAttempt" TO "${appRole}"`);
    await owner.$executeRawUnsafe(`GRANT EXECUTE ON FUNCTION covex_b2_begin(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT) TO "${appRole}"`);
    await owner.$executeRawUnsafe(`GRANT EXECUTE ON FUNCTION covex_b2_command_outcome(JSONB,JSONB),covex_b2_check_claims(UUID,JSONB) TO "${appRole}"`);
    await owner.$executeRawUnsafe(`GRANT EXECUTE ON FUNCTION covex_b2_retain_signed_original(UUID,TEXT,TEXT,TEXT,BYTEA,TEXT,TEXT,TEXT,TEXT),covex_b2_expire_staging(UUID) TO "${appRole}"`);
    await owner.$transaction(tx=>assertAuditProtection(tx));
    const department=await owner.department.findFirstOrThrow();
    if (!await owner.department.findUnique({where:{code:"LG-00"}})) await owner.department.create({data:{code:"LG-00",name:"Synthetic returns fixture department"}});
    if (!await owner.department.findUnique({where:{code:"GC-00"}})) await owner.department.create({data:{code:"GC-00",name:"Synthetic PNT fixture department"}});
    await owner.authRole.create({data:{key:"B2_CANDIDATE_ROLE_FIXTURE",name:"Synthetic unaccepted policy candidate"}});
    const records: Record<string,{id:string;qmsRecordId:string}>={};
    const definitions=[
      ["DEVIATION","deviation",{}], ["CAPA","capa",{actionType:"CORRECTIVE"}],
      ["CHANGE_CONTROL","changeControl",{}], ["COMPLAINT","complaint",{complaintType:"CUSTOMER"}],
      ["RETURN","returnRecord",{returnType:"COMMERCIAL"}], ["AUDIT","audit",{}],
    ] as const;
    for(const [module,model,additional] of definitions) {
      const root=await owner.qmsRecord.create({data:{recordType:module as QmsRecordType,businessCode:"SYNTHETIC-B2-"+module+"-"+suffix,year:2026}});
      type DomainWriter={create(args:object):Promise<{id:string;qmsRecordId:string}>};
      const data={...additional,qmsRecordId:root.id,...(module!=="AUDIT"?{departmentId:department.id}:{}),...(["DEVIATION","AUDIT"].includes(module)?{status:"OPEN"}:{})};
      // Use real enum defaults for synthetic required fields, not business guesses.
      const modelMeta=Prisma.dmmf.datamodel.models.find(m=>m.name[0].toLowerCase()+m.name.slice(1)===model)!;
      for(const field of modelMeta.fields.filter(f=>f.kind==="enum"&&f.isRequired&&!f.hasDefaultValue)) {
        const enumValue=Prisma.dmmf.datamodel.enums.find(e=>e.name===field.type)!.values[0].name;
        Object.assign(data,{[field.name]:enumValue});
      }
      records[module]=await (owner as unknown as Record<string,DomainWriter>)[model].create({data});
      await owner.qmsRecordVersion.create({data:{qmsRecordId:root.id,sequenceNumber:0,kind:"INITIAL",snapshot:{synthetic:true},createdByText:"Synthetic historical source",reason:"Disposable fixture baseline"}});
    }
    // Genuine pre-policy slots, including one deliberately corrupt fixture. The
    // replacement must observe stored bytes, never manufacture a past identity.
    for (const corrupt of [false,true]) {
      const root=await owner.qmsRecord.create({data:{recordType:"DEVIATION",businessCode:"SYNTHETIC-B2-LEGACY-"+(corrupt?"CORRUPT-":"VALID-")+suffix}});
      await owner.deviation.create({data:{qmsRecordId:root.id,status:"OPEN",departmentId:department.id}});
      const version=await owner.qmsRecordVersion.create({data:{qmsRecordId:root.id,sequenceNumber:0,kind:"INITIAL",snapshot:{synthetic:true},createdByText:"Legacy label",reason:"Legacy fixture"}});
      const bytes=Buffer.from("%PDF-1.7\nGenuinely stored synthetic legacy original\n%%EOF");
      await owner.recordVersionDocument.create({data:{recordVersionId:version.id,kind:"SIGNED_PDF",fileName:"legacy.pdf",fileData:bytes,fileSize:bytes.length,checksum:corrupt?"0".repeat(64):createHash("sha256").update(bytes).digest("hex"),uploadedByText:"Unverified historical uploader",uploadedAt:new Date("2020-01-02T03:04:05Z")}});
    }
    const document=await owner.controlledDocument.create({data:{title:"Synthetic controlled document",createdByText:"Legacy source label",departmentId:department.id}});
    const draft=await owner.deviation.create({data:{status:"DRAFT",investigation:"Existing draft content",qmsRecord:{create:{recordType:"DEVIATION"}}}});
    for (const state of ["PARTIAL","PENDING","CONFIRMED"]) {
      const batch=await owner.controlledDocumentImportBatch.create({data:{fileName:"SYNTHETIC-B2-STAGING-"+state+".xlsx",sha256:"f".repeat(64),analyzedAt:new Date(),actor:"Historical staging label",summary:{synthetic:true},reportMetadata:{synthetic:true},state,expiresAt:new Date(Date.now()+(state==="PENDING"?86400000:-86400000))}});
      for (const confirmed of [false,true]) await owner.controlledDocumentImportRow.create({data:{batchId:batch.id,sourceKey:(confirmed?"d":"e").repeat(64),data:{synthetic:true},...(confirmed?{result:{synthetic:true}}:{})}});
    }
    await owner.auditPilotRecord.create({data:{qmsRecordId:records.DEVIATION.qmsRecordId}});
    await owner.$executeRaw`SELECT covex_b2_require_policy('Synthetic capture tests; no corporate approval')`;
    process.env.DATABASE_URL=url.href;
    const { issueSession,sessionFromToken }=await import("../src/lib/auth/session");
    globalClient=(await import("../src/lib/db")).prisma;
    const principals={qa:(await sessionFromToken((await issueSession(fixtureUsers.qa.id)).token)).principal,
      reader:(await sessionFromToken((await issueSession(fixtureUsers.reader.id)).token)).principal,
      admin:(await sessionFromToken((await issueSession(fixtureUsers.admin.id)).token)).principal,
      manager:(await sessionFromToken((await issueSession(fixtureUsers.manager.id)).token)).principal};
    const {withBusinessAudit}=await import("../src/lib/audit/business-service");
    const command=(reason:string|null=null):BusinessAuditCommand=>({requestId:randomUUID(),digest:"a".repeat(64),reason});
    const edit:BusinessAuditDescriptor={operationCode:"DV02",module:"DEVIATION",permission:"EDIT"};
    const execute=(descriptor:BusinessAuditDescriptor,input:BusinessAuditCommand,write:(tx:Prisma.TransactionClient)=>Promise<unknown>,actor=principals.qa)=>
      identityContext.run({principal:actor},()=>withBusinessAudit(descriptor,input,async tx=>{await write(tx);},app!));
    const state=async()=>({record:await owner!.deviation.findUniqueOrThrow({where:{id:records.DEVIATION.id}}),events:await owner!.auditEvent.count(),operations:await owner!.auditOperation.count(),targets:await owner!.auditOperationTarget.findMany({orderBy:[{rootKey:"asc"},{aggregateSequence:"asc"}]}),cursors:await owner!.auditAggregateCursor.findMany({orderBy:{rootKey:"asc"}})});
    const first=await execute(edit,command(),tx=>tx.deviation.update({where:{id:records.DEVIATION.id},data:{investigation:"First actual incorporation",issueDate:new Date("2026-10-13")}}));
    assert(first.operationId);
    const operation=await owner.auditOperation.findUniqueOrThrow({where:{id:first.operationId}});
    assert.equal(operation.actorUserId,principals.qa.id); assert.equal(operation.actorName,principals.qa.name); assert.equal(operation.reason,null);
    assert.equal(operation.schemaVersion,2);
    const events=await owner.auditEvent.findMany({where:{operationId:first.operationId}});
    const investigation=events.find(e=>e.fieldPath==="investigation")!;
    assert.deepEqual(investigation.oldValue,{present:true,type:"NULL",value:null});
    assert.deepEqual(investigation.newValue,{present:true,type:"STRING",value:"First actual incorporation"});
    assert.deepEqual(events.find(e=>e.fieldPath==="issueDate")!.newValue,{present:true,type:"DATE",value:"2026-10-13"});
    assert(events.every(e=>e.capturedAt>=operation.occurredAt));
    const unchanged=await state();
    await assert.rejects(execute(edit,command(),tx=>tx.deviation.update({where:{id:records.DEVIATION.id},data:{investigation:"Correction without reason"}})));
    assert.deepEqual(await state(),unchanged);
    await execute(edit,command("Critical correction explained"),tx=>tx.deviation.update({where:{id:records.DEVIATION.id},data:{investigation:"Corrected actual content"}}));
    const noopBefore=await owner.auditOperation.count();
    const noop=await execute(edit,command(),tx=>tx.deviation.update({where:{id:records.DEVIATION.id},data:{internalObservations:null}}));
    assert.equal(noop.operationId,null); assert.equal(await owner.auditOperation.count(),noopBefore);
    await execute(edit,command(),tx=>tx.deviation.update({where:{id:draft.id},data:{investigation:"Changed draft; no blanket reason"}}));
    // Engine-level capture of real business tables of all seven modules. These
    // cases do not claim integration/coverage of their existing service writers.
    for(const [descriptor,write] of [
      [{operationCode:"CA02",module:"CAPA",permission:"EDIT"},(tx:Prisma.TransactionClient)=>tx.capa.update({where:{id:records.CAPA.id},data:{rootCause:"First root cause"}})],
      [{operationCode:"CC02",module:"CHANGE_CONTROL",permission:"EDIT"},(tx:Prisma.TransactionClient)=>tx.changeControl.update({where:{id:records.CHANGE_CONTROL.id},data:{evaluation:"First evaluation"}})],
      [{operationCode:"RC02",module:"COMPLAINT",permission:"EDIT"},(tx:Prisma.TransactionClient)=>tx.complaint.update({where:{id:records.COMPLAINT.id},data:{investigation:"First investigation"}})],
      [{operationCode:"DE02",module:"RETURN",permission:"EDIT"},(tx:Prisma.TransactionClient)=>tx.returnRecord.update({where:{id:records.RETURN.id},data:{decisionObservations:"First decision evidence"}})],
      [{operationCode:"AU06",module:"AUDIT",permission:"EDIT"},(tx:Prisma.TransactionClient)=>tx.audit.update({where:{id:records.AUDIT.id},data:{conclusion:"First conclusion"}})],
      [{operationCode:"PN01",module:"PNT",permission:"EDIT"},(tx:Prisma.TransactionClient)=>tx.controlledDocument.update({where:{id:document.id},data:{title:"Changed synthetic title"}})],
    ] as [BusinessAuditDescriptor,(tx:Prisma.TransactionClient)=>Promise<unknown>][]) {
      assert((await execute(descriptor,command(),write)).operationId);
    }
    const batch=await execute({operationCode:"TR07",module:"DEVIATION",permission:"IMPORT"},command(),tx=>tx.historicalImportBatch.create({data:{sourceFileName:"synthetic-source.txt",sourceSha256:createHash("sha256").update("synthetic-source").digest("hex"),years:[2020,2025],importedByText:principals.qa.name}}));
    assert.deepEqual((await owner.auditEvent.findFirstOrThrow({where:{operationId:batch.operationId!,fieldPath:"years"}})).newValue,{present:true,type:"JSON",value:[2020,2025]},"Native integer arrays keep their JSON structure, not a scalar integer tag");
    const relation=await execute({...edit,operationCode:"DV08"},command(),tx=>tx.qmsRelation.create({data:{sourceRecordId:records.DEVIATION.qmsRecordId,targetRecordId:records.CAPA.qmsRecordId,relationType:"GENERATES",createdByText:principals.qa.name}}));
    assert.equal(await owner.auditOperationTarget.count({where:{operationId:relation.operationId!}}),2);
    const relationEvents=await owner.auditEvent.findMany({where:{operationId:relation.operationId!},include:{additionalTargets:true}});
    assert(relationEvents.every(e=>e.additionalTargets.length===1));
    assert.equal(new Set(relationEvents.map(e=>e.fieldPath)).size,relationEvents.length,"Each changed field is one event, not duplicated per root");
    await execute(edit,command(),tx=>tx.deviationImmediateAction.createMany({data:[0,1,2].map(i=>({deviationId:records.DEVIATION.id,description:"Synthetic immediate action "+i}))}));
    const childIds=(await owner.deviationImmediateAction.findMany({where:{deviationId:records.DEVIATION.id}})).map(r=>r.id);
    await assert.rejects(execute(edit,command(),tx=>tx.deviationImmediateAction.deleteMany({where:{id:{in:childIds}}})),"Removing established operational children requires a motive");
    assert.equal(await owner.deviationImmediateAction.count({where:{id:{in:childIds}}}),childIds.length);
    const deletion=await execute(edit,command("Synthetic documented immediate action withdrawal"),tx=>tx.deviationImmediateAction.deleteMany({where:{id:{in:childIds}}}));
    for(const id of childIds) assert(await owner.auditEvent.count({where:{operationId:deletion.operationId!,entityType:"DeviationImmediateAction",entityId:id}})>0);
    // Post-commit retry: same key/content skips the callback and returns receipt.
    const retry=command(); let writes=0;
    const saved=await execute(edit,retry,async tx=>{writes++;return tx.deviation.update({where:{id:records.DEVIATION.id},data:{internalObservations:"Retry proof"}});});
    const eventCount=await owner.auditEvent.count();
    const replay=await execute(edit,retry,async()=>{writes++;throw Error("Replay must skip business writer");});
    assert.equal(writes,1);assert.equal(replay.operationId,saved.operationId);assert(replay.replayed);assert.equal(await owner.auditEvent.count(),eventCount);
    await assert.rejects(execute(edit,{...retry,digest:"b".repeat(64)},async()=>undefined));
    await assert.rejects(execute({...edit,permission:"FOLLOWUP"},retry,async()=>undefined),"A retry cannot change the original permission identity");
    await assert.rejects(execute(edit,command(),tx=>tx.deviation.update({where:{id:records.DEVIATION.id},data:{internalObservations:"Reader attack"}}),principals.reader));
    assert.equal(await app.qmsRecord.count(),await owner.qmsRecord.count(),"Consultation remains global");
    const administer:BusinessAuditDescriptor={operationCode:"TR05",module:"SYSTEM",permission:"MANAGE_USERS"};
    const qaRole=await owner.authRole.findUniqueOrThrow({where:{key:"QUALITY_ASSURANCE"}});
    const grant=await owner.authRolePermission.findFirstOrThrow({where:{roleId:qaRole.id,module:"DEVIATION",permission:"EDIT"}});
    const concurrentBefore=await owner.deviation.findUniqueOrThrow({where:{id:records.DEVIATION.id}});
    const countsBefore=await owner.auditOperation.count({where:{operation:"DV02"}});
    // Begin and write as QA, then commit a separate authenticated administrative
    // revocation while that business transaction remains open. Commit-time SQL
    // reads the current grants and must roll back the pending business change.
    let businessStarted!:()=>void, revocationFinished!:()=>void;
    const started=new Promise<void>(resolve=>{businessStarted=resolve;});
    const revoked=new Promise<void>(resolve=>{revocationFinished=resolve;});
    const pending=execute(edit,command(),async tx=>{
      await tx.deviation.update({where:{id:records.DEVIATION.id},data:{internalObservations:"Concurrent pending change"}});
      businessStarted();await revoked;
    });
    const rejected=assert.rejects(pending);
    await started;
    try {await execute(administer,command("Synthetic concurrent grant revocation"),adminTx=>adminTx.authRolePermission.delete({where:{id:grant.id}}),principals.admin);}
    finally {revocationFinished();}
    await rejected;
    assert.deepEqual(await owner.deviation.findUniqueOrThrow({where:{id:records.DEVIATION.id}}),concurrentBefore);
    assert.equal(await owner.auditOperation.count({where:{operation:"DV02"}}),countsBefore);
    assert.equal(await owner.authRolePermission.count({where:{id:grant.id}}),0,"Independent revocation committed");
    await execute(administer,command("Restore only the synthetic fixture grant"),tx=>tx.authRolePermission.create({data:grant}),principals.admin);
    await execute(administer,command("Synthetic assignment scope fixture"),tx=>tx.authRecordAssignment.create({data:{userId:principals.manager.id,module:"DEVIATION",recordId:records.DEVIATION.qmsRecordId}}),principals.admin);
    const assignedBefore=await owner.auditOperation.count();
    // Reverse direction avoids the unique key of the DEVIATION→CAPA row created above, so only the CAPA endpoint scope can reject it.
    await assert.rejects(execute({...edit,operationCode:"DV08"},command(),tx=>tx.qmsRelation.create({data:{sourceRecordId:records.CAPA.qmsRecordId,targetRecordId:records.DEVIATION.qmsRecordId,relationType:"GENERATES",createdByText:principals.manager.name}}),principals.manager));
    await assert.rejects(execute({operationCode:"CA02",module:"CAPA",permission:"EDIT"},command(),tx=>tx.capa.update({where:{id:records.CAPA.id},data:{internalObservations:null}}),principals.manager),"A scoped no-op cannot update technical timestamps of an unassigned record");
    assert.equal(await owner.auditOperation.count(),assignedBefore,"Both endpoints require current scope");
    let cascadeId="";
    await execute({...edit,operationCode:"DV01",permission:"CREATE"},command(),async tx=>{
      const created=await tx.deviation.create({data:{department:{connect:{id:department.id}},qmsRecord:{create:{recordType:"DEVIATION"}},immediateActions:{create:[{description:"Synthetic cascade child"}]}}});
      cascadeId=created.id;
    });
    const cascadeChildren=await owner.deviationImmediateAction.findMany({where:{deviationId:cascadeId}});
    const cascade=await execute(edit,command("Synthetic documented cascade withdrawal"),tx=>tx.deviation.delete({where:{id:cascadeId}}));
    for(const child of cascadeChildren) assert(await owner.auditEvent.count({where:{operationId:cascade.operationId!,entityType:"DeviationImmediateAction",entityId:child.id}})>0,"Deleted parent binding preserves child ownership");
    // Concurrent writers serialize on the business row/cursor; OLD values and
    // root sequences form a chain even though each command has a different key.
    const concurrent=await Promise.all([0,1,2].map(i=>execute(edit,command(),tx=>tx.deviation.update({where:{id:records.DEVIATION.id},data:{internalObservations:"Concurrent write "+i}}))));
    assert(concurrent.every(r=>r.operationId));
    const ordered=await owner.auditOperationTarget.findMany({where:{operationId:{in:concurrent.map(r=>r.operationId!)}},orderBy:{aggregateSequence:"asc"}});
    const chain=await Promise.all(ordered.map(t=>owner!.auditEvent.findFirstOrThrow({where:{operationId:t.operationId,fieldPath:"internalObservations"}})));
    for(let i=1;i<chain.length;i++) assert.deepEqual(chain[i].oldValue,chain[i-1].newValue);
    const rootTargets=await owner.auditOperationTarget.findMany({where:{rootKey:"QMS_RECORD:"+records.DEVIATION.qmsRecordId},orderBy:{aggregateSequence:"asc"}});
    rootTargets.forEach((t,i)=>assert.equal(t.aggregateSequence,BigInt(i+1)));
    const baseline=await state();
    await assert.rejects(app.deviation.update({where:{id:records.DEVIATION.id},data:{internalObservations:"Independent unaudited client"}}));
    await assert.rejects(app.$transaction(async tx=>{
      await tx.$executeRaw`SELECT set_config('covex.audit.operation_id','00000000-0000-0000-0000-000000000000',true)`;
      await tx.deviation.update({where:{id:records.DEVIATION.id},data:{internalObservations:"Fake GUC"}});
    }));
    assert.deepEqual(await state(),baseline);
    // Bypass server preflight only in a private fixture to demonstrate that SQL
    // deferred coverage itself detects an omitted capture hook at commit.
    const rawWrite=async(write:(tx:Prisma.TransactionClient)=>Promise<unknown>)=>app!.$transaction(async tx=>{
      await tx.$queryRaw(Prisma.sql`SELECT * FROM covex_b2_begin(${principals.qa.id}::uuid,${randomUUID()}::uuid,${"c".repeat(64)},'DV02','DEVIATION','EDIT',NULL)`);
      await write(tx);
    });
    await owner.$executeRawUnsafe('ALTER TABLE "Deviation" DISABLE TRIGGER audit_b2_capture');
    await assert.rejects(rawWrite(tx=>tx.deviation.update({where:{id:records.DEVIATION.id},data:{internalObservations:"Capture omitted"}})));
    await assert.rejects(owner.$transaction(tx=>assertAuditProtection(tx)));
    await owner.$executeRawUnsafe('ALTER TABLE "Deviation" ENABLE TRIGGER audit_b2_capture');
    assert.deepEqual(await state(),baseline);
    await owner.$executeRawUnsafe('ALTER TABLE "Deviation" DISABLE TRIGGER audit_b2_witness');
    await assert.rejects(rawWrite(tx=>tx.deviation.update({where:{id:records.DEVIATION.id},data:{internalObservations:"Witness omitted"}})));
    await owner.$executeRawUnsafe('ALTER TABLE "Deviation" ENABLE TRIGGER audit_b2_witness');
    assert.deepEqual(await state(),baseline);
    await owner.$executeRawUnsafe(`CREATE FUNCTION b2_test_wrong_old() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW."oldValue":='{"present":true,"type":"STRING","value":"wrong OLD"}'::jsonb; RETURN NEW; END $$`);
    await owner.$executeRawUnsafe('CREATE TRIGGER audit_b2_test_wrong_old BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION b2_test_wrong_old()');
    await assert.rejects(rawWrite(tx=>tx.deviation.update({where:{id:records.DEVIATION.id},data:{internalObservations:"Wrong old must roll back"}})));
    await owner.$executeRawUnsafe('DROP TRIGGER audit_b2_test_wrong_old ON "AuditEvent"');
    await owner.$executeRawUnsafe('DROP FUNCTION b2_test_wrong_old()');
    assert.deepEqual(await state(),baseline);
    // Nested writes and multi-row capture are performed by PostgreSQL, not by
    // monkey-patching Prisma delegates. A failed second child rolls back all.
    await assert.rejects(execute(edit,command(),async tx=>{
      await tx.deviation.update({where:{id:records.DEVIATION.id},data:{internalObservations:"Atomic parent",immediateActions:{create:[{description:"Atomic child"}]}}});
      await tx.$executeRawUnsafe('SELECT 1/0');
    }));
    assert.deepEqual(await state(),baseline);
    await owner.$transaction(tx=>assertAuditProtection(tx));
    await auditedSqlFixture(app,principals.qa.id,[records.DEVIATION.qmsRecordId],randomUUID(),2);
    const configuration=spawnSync("pnpm",["exec","vitest","run","--config","scripts/audit-fixtures/vitest-capture.config.ts"],{
      env:{...process.env,DATABASE_URL:appUrl!.href,B2_CAPTURE_INSPECTOR_URL:url.href},encoding:"utf8",timeout:120000,
    });
    if(configuration.status!==0) process.stderr.write(configuration.stdout+configuration.stderr);
    assert.equal(configuration.status,0,"Actual configuration writer capture proof failed");
    for(const table of contract.privateTables) {
      const counts: {count:bigint}[]=await owner.$queryRawUnsafe(`SELECT count(*) AS count FROM "${table}"`);
      assert.equal(counts[0].count,BigInt(0),"No private lease/witness persists after commit");
    }
    console.log("B2 SQL capture foundation OK: seven real module tables; actual typed OLD/NEW and dates; one operation per save; first incorporation/draft/noop; critical reason; relationship endpoints without duplicated events; bulk/cascade child deletion; retry/conflict; authenticated actor; concurrent grant revocation and both-endpoint scope; concurrent SQL chain/sequence; global reads; direct/GUC writes rejected; missing capture/witness and wrong OLD roll back; nested multi-row failure; B1 preserved. Existing module service coverage/corporate activation are not claimed.");
  } finally {
    await app?.$disconnect();await owner?.$disconnect();await globalClient?.$disconnect();process.env.DATABASE_URL=previousUrl;
    if(created){await parent.$queryRaw(Prisma.sql`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=${name} AND pid<>pg_backend_pid()`);await parent.$executeRawUnsafe(`DROP DATABASE "${name}"`);}
    for(const role of roles.reverse()) await parent.$executeRawUnsafe(`DROP ROLE IF EXISTS "${role}"`);
    await parent.$disconnect();
  }
}
main().catch(error=>{console.error("Isolated B2 capture proof failed",error?.name,error?.code,error?.cause?.name,error?.cause?.message?.match(/(?:PostgresError|SqlState|ERROR)[^\n]*/g),error?.cause?.code,Object.keys(error?.cause??{}),error?.cause?.meta?.code,error?.cause?.meta?.message?.split("\n").filter((line:string)=>/^ERROR: (permission denied|column |relation |record |invalid|insert |Business|Invalid|Independent|Mandatory)/i.test(line)).slice(0,1),error?.stack?.split("\n").filter((line:string)=>line.trim().startsWith("at ")&&!line.includes("node_modules")).slice(0,4));process.exitCode=1;});
