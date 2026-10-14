import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createWriteStream } from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";
import { isolatedTestEnvironment } from "../src/lib/auth/config";
import { fixtureUsers } from "./auth-fixtures/constants";
import { auditApplicationFixture, businessApplicationGrantsFixture, businessSqlFixture } from "./audit-fixtures/database";

async function stop(child?:ChildProcess){if(child&&child.exitCode===null){child.kill("SIGTERM");await new Promise<void>(resolve=>{child.once("exit",resolve);setTimeout(()=>{child.kill("SIGKILL");resolve();},5000).unref();});}}
async function main(){
  assert(isolatedTestEnvironment(),"Disposable synthetic environment required");
  assert(!(process.argv.includes("--ui-only")&&process.argv.includes("--database-only")),"Choose one focused verification mode");
  const parent=new PrismaClient({log:[]}),url=new URL(process.env.DATABASE_URL!);
  assert(["127.0.0.1","localhost"].includes(url.hostname));
  const suffix=randomBytes(8).toString("hex"),name="covex_phase4b1_test_b2_capture_"+suffix,role="covex4b3_c_"+suffix;
  let created=false,owner:PrismaClient|undefined,app:PrismaClient|undefined,server:ChildProcess|undefined,provider:ChildProcess|undefined;
  const origin="http://127.0.0.1:3010",issuer="http://127.0.0.1:5463";
  try{
    await parent.$executeRawUnsafe(`CREATE DATABASE "${name}" TEMPLATE template0`);created=true;url.pathname="/"+name;
    const setupEnv={...process.env,DATABASE_URL:url.href,AUTH_ORIGIN:origin,AUTH_TEST_ISSUER:issuer};
    for(const command of ["db:deploy","db:seed","auth:fixtures"]){const result=spawnSync("pnpm",[command],{env:setupEnv,encoding:"utf8",timeout:120000});assert.equal(result.status,0,"Synthetic C setup failed: "+command);}
    owner=new PrismaClient({datasourceUrl:url.href,log:[]});
    let appUrl:URL|undefined;
    app=await auditApplicationFixture(owner,url,role,parent,connection=>{appUrl=connection;});
    await businessApplicationGrantsFixture(owner,role);
    await owner.$executeRawUnsafe(`GRANT INSERT,UPDATE,DELETE ON "AuthSession","AuthLoginAttempt" TO "${role}"`);
    const department=await owner.department.findFirstOrThrow();
    const fixtures:Array<{id:string;rootKey:string;path:string;module:string}>=[];
    for(const [accessModule,model,path] of [["DEVIATION","deviation","deviations"],["CAPA","capa","capa"],["CHANGE_CONTROL","changeControl","changes"],["COMPLAINT","complaint","complaints"],["RETURN","returnRecord","returns"],["AUDIT","audit","audits"]]){
      const meta=Prisma.dmmf.datamodel.models.find(item=>item.name[0].toLowerCase()+item.name.slice(1)===model)!;
      const data:Record<string,unknown>={qmsRecord:{create:{recordType:accessModule,businessCode:"SYNTHETIC-C-"+accessModule+"-"+suffix,year:2026}}};
      if(model!=="audit")data.department={connect:{id:department.id}};
      for(const field of meta.fields.filter(field=>field.kind==="enum"&&field.isRequired&&!field.hasDefaultValue))data[field.name]=Prisma.dmmf.datamodel.enums.find(item=>item.name===field.type)!.values[0].name;
      type Writer={create(args:object):Promise<{id:string;qmsRecordId:string}>};
      const row=await(owner as unknown as Record<string,Writer>)[model].create({data});
      fixtures.push({id:row.id,rootKey:"QMS_RECORD:"+row.qmsRecordId,path,module:accessModule});
    }
    const pnt=await owner.controlledDocument.create({data:{title:"Synthetic C PNT",createdByText:"Legacy synthetic actor",departmentId:department.id}});
    fixtures.push({id:pnt.id,rootKey:"PNT:"+pnt.id,path:"controlled-documents",module:"PNT"});
    await owner.$executeRaw`SELECT covex_b2_require_policy('Synthetic C verification; no corporate activation')`;
    await businessSqlFixture(app,fixtureUsers.qa.id,randomUUID(),"TR04","SYSTEM","MANAGE_CONFIGURATION",null,async tx=>{await tx.department.update({where:{id:department.id},data:{name:"Synthetic C restricted administration"}});});
    const codes=["DV02","CA02","CC02","RC02","DE02","AU01","PN01"];
    for(let i=0;i<fixtures.length;i++){
      const record=fixtures[i],model=["deviation","capa","changeControl","complaint","returnRecord","audit","controlledDocument"][i];
      for(let n=0;n<(i===0?3:1);n++)await businessSqlFixture(app,fixtureUsers.qa.id,randomUUID(),codes[i],record.module,"EDIT","Synthetic C observed correction",async tx=>{
        type Writer={update(args:object):Promise<unknown>};
        await(tx as unknown as Record<string,Writer>)[model].update({where:{id:record.id},data:{[i===5||i===6?"title":"internalObservations"]:`Synthetic C value ${n}`}});
      });
    }
    const env={...setupEnv,DATABASE_URL:appUrl!.href,B2_CAPTURE_INSPECTOR_URL:url.href,C_AUDIT_FIXTURES:JSON.stringify(fixtures)};
    if(!process.argv.includes("--ui-only")){
      const test=spawnSync("pnpm",["exec","vitest","run","--config","scripts/audit-fixtures/vitest-capture.config.ts","scripts/audit-fixtures/trail-c.test.ts"],{env,encoding:"utf8",timeout:120000});
      process.stdout.write(test.stdout);process.stderr.write(test.stderr);assert.equal(test.status,0,"C focused PostgreSQL verification failed");
    }
    if(!process.argv.includes("--database-only")){
      for(const endpoint of [origin,issuer]){let occupied=false;try{await fetch(endpoint,{signal:AbortSignal.timeout(500)});occupied=true;}catch{}assert(!occupied,"Synthetic C port already occupied");}
      provider=spawn("node",["--import","tsx","scripts/auth-fixtures/provider.ts"],{env,stdio:"ignore"});
      const serverLog="/tmp/covex-c-server-"+suffix+".log",log=createWriteStream(serverLog,{mode:0o600});
      console.log("Synthetic C server log:",serverLog);
      server=spawn("node",["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port","3010"],{env,stdio:["ignore","pipe","pipe"]});
      server.stdout?.pipe(log);server.stderr?.pipe(log);server.once("exit",()=>log.end());
      let ready=false;
      for(let i=0;i<120;i++){assert(server.exitCode===null&&provider.exitCode===null);try{if((await fetch(origin+"/api/health")).ok&&(await fetch(issuer+"/.well-known/openid-configuration")).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
      assert(ready,"C local readiness failed");
      const ui=spawnSync("node",["--import","tsx","scripts/audit-fixtures/trail-c-ui.ts"],{env,encoding:"utf8",timeout:180000});process.stdout.write(ui.stdout);process.stderr.write(ui.stderr);assert.equal(ui.status,0,"C seven-module UI verification failed");
    }
    console.log(process.argv.includes("--ui-only")?"C seven-module browser verification completed; database test suite omitted in this explicit diagnostic mode":"C verified: isolated PostgreSQL protection, permissions, exact scope, review/export receipts and integrity"+(process.argv.includes("--database-only")?"":"; authenticated seven-module browser consultation, review and export"));
  }finally{
    await stop(server);await stop(provider);await app?.$disconnect();await owner?.$disconnect();
    if(created){await parent.$queryRaw(Prisma.sql`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=${name} AND pid<>pg_backend_pid()`);await parent.$executeRawUnsafe(`DROP DATABASE "${name}"`);}
    await parent.$executeRawUnsafe(`DROP ROLE IF EXISTS "${role}"`);await parent.$disconnect();
  }
}
main().catch(error=>{console.error("C synthetic verification failed",error.name,error.message);process.exitCode=1;});
