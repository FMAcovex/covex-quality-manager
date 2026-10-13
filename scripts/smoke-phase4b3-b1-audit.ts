import assert from "node:assert/strict";
import { randomBytes,randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { PrismaClient,Prisma } from "@prisma/client";
import { isolatedTestEnvironment } from "../src/lib/auth/config";
import { identityContext } from "../src/lib/auth/context";
import { fixtureUsers } from "./auth-fixtures/constants";
import { auditApplicationFixture } from "./audit-fixtures/database";

async function main(){
  assert(isolatedTestEnvironment(),"Isolated synthetic environment required");
  const parent=new PrismaClient({log:[]}),id=randomBytes(8).toString("hex"),name="covex_phase4b1_test_audit_"+id,role="covex4b3_app_"+id;
  const url=new URL(process.env.DATABASE_URL!);assert(["127.0.0.1","localhost"].includes(url.hostname));url.pathname="/"+name;
  const ownerRole="covex4b3_owner_"+id,migratorRole="covex4b3_migrator_"+id,migratorSecret=randomBytes(32).toString("hex");
  let source:PrismaClient|undefined,app:PrismaClient|undefined,globalClient:PrismaClient|undefined;
  const previous=process.env.DATABASE_URL;
  try{
    await parent.$executeRawUnsafe(`CREATE ROLE "${ownerRole}" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`);
    await parent.$executeRawUnsafe(`CREATE ROLE "${migratorRole}" LOGIN PASSWORD '${migratorSecret}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`);
    await parent.$executeRawUnsafe(`GRANT "${ownerRole}" TO "${migratorRole}"`);
    await parent.$executeRawUnsafe(`CREATE DATABASE "${name}" OWNER "${migratorRole}" TEMPLATE template0`);
    await parent.$executeRawUnsafe(`ALTER DATABASE "${name}" SET "covex.audit_owner_role" TO '${ownerRole}'`);
    url.username=migratorRole;url.password=migratorSecret;
    process.env.DATABASE_URL=url.href;
    for(const cmd of ["db:deploy","db:seed","auth:fixtures"]){const result=spawnSync("pnpm",[cmd],{env:process.env,encoding:"utf8",timeout:120000});assert.equal(result.status,0,`Synthetic setup failed: ${cmd}; ${result.stdout?.slice(-1500)}`);}
    source=new PrismaClient({datasourceUrl:url.href,log:[]}); app=await auditApplicationFixture(source,url,role,parent);
    const department=await source.department.findFirstOrThrow();
    const roots:string[]=[];
    for(let n=0;n<2;n++){
      const record=await source.deviation.create({data:{department:{connect:{id:department.id}},status:"OPEN",qmsRecord:{create:{recordType:"DEVIATION",businessCode:`SYNTHETIC-AUDIT-${id}-${n}`,year:2026}}}});
      await source.auditPilotRecord.create({data:{qmsRecordId:record.qmsRecordId}});roots.push(record.qmsRecordId);
    }
    const {updateAuditPilot,withAuditedOperation}=await import("../src/lib/audit/service");
    const {assertAuditProtection}=await import("../src/lib/audit/protection");
    const {issueSession,sessionFromToken}=await import("../src/lib/auth/session");
    globalClient=(await import("../src/lib/db")).prisma;
    const qaSession=await issueSession(fixtureUsers.qa.id),readerSession=await issueSession(fixtureUsers.reader.id);
    const qa=(await sessionFromToken(qaSession.token)).principal,reader=(await sessionFromToken(readerSession.token)).principal;
    const asQa=<T>(fn:()=>Promise<T>)=>identityContext.run({principal:qa},fn);
    const command=(value:number,root=roots[0])=>({requestId:randomUUID(),reason:"Synthetic audit test",changes:[{qmsRecordId:root,value}]});
    const application=app,owner=source;
    await assert.rejects(identityContext.run({principal:reader},()=>updateAuditPilot(command(1),application)));
    await assert.rejects(asQa(()=>updateAuditPilot({...command(1),actorUserId:reader.id},application)));
    await assert.rejects(asQa(()=>updateAuditPilot({...command(1),occurredAt:"1900-01-01"},application)));
    await assert.rejects(asQa(()=>updateAuditPilot(command(1),owner)),"Owner is not runtime app");
    const first=command(10),beforeTime=Date.now();
    const receipt=await asQa(()=>updateAuditPilot(first,application));
    const operation=await owner.auditOperation.findUniqueOrThrow({where:{id:receipt.operationId},include:{events:{orderBy:{eventOrdinal:"asc"}},targets:true}});
    assert.equal(operation.actorUserId,qa.id);assert.equal(operation.actorName,qa.name);assert.equal(operation.databasePrincipal,role);
    assert(operation.occurredAt.getTime()>=beforeTime-1000);assert.equal(operation.events.length,2);
    assert.deepEqual(operation.events[0].oldValue,{present:true,type:"INTEGER",value:"0"});assert.deepEqual(operation.events[0].newValue,{present:true,type:"INTEGER",value:"10"});
    assert(operation.events.every(e=>e.capturedAt>=operation.occurredAt));assert.equal(await owner.auditRuntimeContext.count(),0);
    assert.equal((await owner.changeHistory.findFirstOrThrow({where:{qmsRecordId:roots[0]}})).authenticatedUserId,qa.id);
    assert.equal((await asQa(()=>updateAuditPilot(first,application))).operationId,receipt.operationId);
    await assert.rejects(asQa(()=>updateAuditPilot({...first,reason:"Changed"},application)));
    await assert.rejects(application.auditPilotRecord.update({where:{qmsRecordId:roots[0]},data:{value:11}}),"No optional-helper bypass");
    await assert.rejects(application.$transaction(async tx=>{await tx.$executeRaw(Prisma.sql`SELECT set_config('covex.audit.operation_id',${receipt.operationId},true)`);await tx.auditPilotRecord.update({where:{qmsRecordId:roots[0]},data:{value:11}});}));
    const counts=async()=>[await owner.auditOperation.count(),await owner.auditEvent.count(),await owner.changeHistory.count(),...(await owner.auditPilotRecord.findMany({orderBy:{qmsRecordId:"asc"}})).flatMap(r=>[r.value,r.revision])];
    const initial=await counts();
    await assert.rejects(application.$transaction(async tx=>{
      await tx.$queryRaw(Prisma.sql`SELECT * FROM covex_audit_begin(${reader.id}::uuid,${randomUUID()}::uuid,${"a".repeat(64)},'Synthetic SQL authorization negative',${JSON.stringify([{kind:"QMS_RECORD",id:roots[0]}])}::jsonb)`);
    }),"SQL pilot also rejects read-only actor");
    await assert.rejects(asQa(()=>withAuditedOperation(command(12),async()=>{},application)),"Mandatory event absent");
    await assert.rejects(asQa(()=>withAuditedOperation({requestId:randomUUID(),reason:"Synthetic interrupted multi-root",changes:roots.map(qmsRecordId=>({qmsRecordId,value:20}))},async tx=>{await tx.auditPilotRecord.update({where:{qmsRecordId:roots[0]},data:{value:20}});throw Error("Synthetic interruption");},application)));
    assert.deepEqual(await counts(),initial,"State/history/events roll back together");
    await assert.rejects(asQa(()=>withAuditedOperation(command(21),async tx=>{
      await tx.auditPilotRecord.update({where:{qmsRecordId:roots[0]},data:{value:21}});
      const [backend]=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() AS pid`;
      await parent.$queryRaw(Prisma.sql`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid=${backend.pid} AND datname=${name} AND usename=${role}`);
    },application)),"Terminated backend rolls back the entire transaction");
    assert.deepEqual(await counts(),initial);
    await owner.$executeRawUnsafe('ALTER TABLE "AuditEvent" ADD CONSTRAINT synthetic_event_failure CHECK ("fieldPath"<>\'value\') NOT VALID');
    await assert.rejects(asQa(()=>updateAuditPilot(command(12),application)));assert.deepEqual(await counts(),initial);
    await owner.$executeRawUnsafe('ALTER TABLE "AuditEvent" DROP CONSTRAINT synthetic_event_failure');
    const multi=await asQa(()=>updateAuditPilot({requestId:randomUUID(),reason:"Synthetic multi-root",changes:roots.map(qmsRecordId=>({qmsRecordId,value:30}))},application));
    assert.equal(await owner.auditOperationTarget.count({where:{operationId:multi.operationId}}),2);
    assert.equal(await owner.auditEvent.count({where:{operationId:multi.operationId}}),4);
    const revision=(await owner.auditPilotRecord.findUniqueOrThrow({where:{qmsRecordId:roots[0]}})).revision;
    const conflicts=await Promise.allSettled([31,32].map(value=>asQa(()=>updateAuditPilot({...command(value),changes:[{qmsRecordId:roots[0],value,expectedRevision:revision}]},application))));
    assert.equal(conflicts.filter(x=>x.status==="fulfilled").length,1);
    await Promise.all(Array.from({length:6},(_,n)=>asQa(()=>updateAuditPilot(command(100+n),application))));
    const chain=await owner.auditOperationTarget.findMany({where:{rootKey:"QMS_RECORD:"+roots[0]},orderBy:{aggregateSequence:"asc"},include:{events:{where:{fieldPath:"value"}}}});
    for(let n=0;n<chain.length;n++){assert.equal(chain[n].aggregateSequence,BigInt(n+1));if(n)assert.deepEqual(chain[n].events[0].oldValue,chain[n-1].events[0].newValue);}
    const duplicate=command(200);const duplicates=await Promise.all(Array.from({length:4},()=>asQa(()=>updateAuditPilot(duplicate,application))));
    assert.equal(new Set(duplicates.map(x=>x.operationId)).size,1);
    for(const table of ["AuditOperation","AuditEvent","AuditOperationTarget"]){
      for(const query of [`UPDATE "${table}" SET ${table==="AuditOperation"?'"reason"=\'forged\'':table==="AuditEvent"?'"fieldPath"=\'forged\'':'"aggregateSequence"=999'}`,`DELETE FROM "${table}"`,`TRUNCATE "${table}" CASCADE`])await assert.rejects(application.$executeRawUnsafe(query));
    }
    await assert.rejects(application.$executeRawUnsafe('INSERT INTO "AuditEvent" SELECT * FROM "AuditEvent" LIMIT 1'));
    await assert.rejects(application.$executeRawUnsafe('ALTER TABLE "AuditEvent" DISABLE TRIGGER audit_event_immutable'));
    // Owner is also rejected while triggers are enabled, but can disable them.
    await assert.rejects(owner.$executeRawUnsafe('UPDATE "AuditEvent" SET "fieldPath"=\'forged\''));
    await owner.$executeRawUnsafe('ALTER TABLE "AuditEvent" DISABLE TRIGGER audit_event_immutable');
    const event=await owner.auditEvent.findFirstOrThrow();await owner.auditEvent.update({where:{id:event.id},data:{fieldPath:"DBA_CAN_ALTER"}});
    await assert.rejects(owner.$transaction(tx=>assertAuditProtection(tx)),"Disabled protection detected");
    await assert.rejects(asQa(()=>updateAuditPilot(command(201),application)));
    await owner.auditEvent.update({where:{id:event.id},data:{fieldPath:event.fieldPath}});
    await owner.$executeRawUnsafe('ALTER TABLE "AuditEvent" ENABLE TRIGGER audit_event_immutable');
    await owner.$transaction(tx=>assertAuditProtection(tx));
    const [typed]=await owner.$queryRaw<{valid:boolean;invalid:boolean;decimal:boolean}[]>`SELECT covex_audit_value_valid('{"present":true,"type":"INTEGER","value":"9007199254740993"}'::jsonb) AS valid,covex_audit_value_valid('{"present":true,"type":"DATE","value":"2026-02-30"}'::jsonb) AS invalid,covex_audit_value_valid('{"present":true,"type":"DECIMAL","value":"1.000000000000000001"}'::jsonb) AS decimal`;
    assert(typed.valid&&typed.decimal&&!typed.invalid,"Typed values preserve precision and reject invalid dates");
    await owner.authSession.updateMany({where:{userId:qa.id},data:{revokedAt:new Date()}});
    await assert.rejects(sessionFromToken(qaSession.token));
    await owner.authUser.update({where:{id:qa.id},data:{active:false}});
    await assert.rejects(asQa(()=>updateAuditPilot(command(201),application)));
    assert.equal(await owner.auditRuntimeContext.count(),0);
    console.log("B1 audit engine OK: authenticated synthetic session; real old/new and PostgreSQL UTC; multi-root correlation; mandatory capture and rollback; no journal CRUD/TRUNCATE/INSERT or GUC bypass; owner separation and demonstrated DBA limit; idempotency, concurrency, CAS and continuous sequence; existing history and revocation preserved. No GMP policy activated.");
  }finally{
    await app?.$disconnect();await source?.$disconnect();await globalClient?.$disconnect();process.env.DATABASE_URL=previous;
    await parent.$executeRaw(Prisma.sql`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=${name} AND pid<>pg_backend_pid()`);
    await parent.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}"`);
    for(const name of [role,migratorRole,ownerRole])await parent.$executeRawUnsafe(`DROP ROLE IF EXISTS "${name}"`);
    await parent.$disconnect();
  }
}
main().catch(error=>{console.error("Synthetic B1 audit test failed; inspect isolated diagnostics privately",error?.name,error?.code,error?.stack?.split("\n").filter((line:string)=>line.trim().startsWith("at ")&&!line.includes("node_modules")).slice(0,4));process.exitCode=1;});
