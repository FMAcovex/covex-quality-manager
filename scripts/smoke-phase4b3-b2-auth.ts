import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { copyFileSync, cpSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Prisma, PrismaClient } from "@prisma/client";
import { isolatedTestEnvironment } from "../src/lib/auth/config";

async function stop(child:ChildProcess|undefined) {
  if(!child?.pid) return;
  try {process.kill(-child.pid,"SIGTERM");} catch {}
  if(child.exitCode!==null) return;
  await Promise.race([new Promise<void>(resolve=>child.once("exit",()=>resolve())),new Promise<void>(resolve=>setTimeout(resolve,5000))]);
  if(child.exitCode===null) {try {process.kill(-child.pid,"SIGKILL");} catch {}}
}
async function main() {
  assert(isolatedTestEnvironment(),"Isolated synthetic environment required");
  const parent=new PrismaClient({log:[]}),url=new URL(process.env.DATABASE_URL!);
  assert(["127.0.0.1","localhost"].includes(url.hostname));
  const name="covex_phase4b1_test_b2_auth_"+randomBytes(8).toString("hex");url.pathname="/"+name;
  // Fixed, exclusively loopback test endpoints. Refuse to reuse an existing app.
  const origin="http://127.0.0.1:3009",issuer="http://127.0.0.1:5461";
  for(const endpoint of [origin,issuer]) {
    let connected=false;
    try {await fetch(endpoint,{signal:AbortSignal.timeout(1000)});connected=true;} catch {}
    assert(!connected,"Dedicated synthetic test port already in use");
  }
  let created=false,app:ChildProcess|undefined,provider:ChildProcess|undefined,runtime:string|undefined;
  try {
    await parent.$executeRawUnsafe(`CREATE DATABASE "${name}" TEMPLATE template0`);created=true;
    const env={...process.env,DATABASE_URL:url.href,AUTH_ORIGIN:origin,AUTH_TEST_ISSUER:issuer};
    for(const command of ["db:deploy","db:seed","auth:fixtures"]) {
      const result=spawnSync("pnpm",[command],{env,encoding:"utf8",timeout:120000});
      assert.equal(result.status,0,"Synthetic authentication setup failed: "+command);
    }
    // Disposable runtime projection of this checkout, not a Git checkout/worktree.
    // Next may write generated config/cache only here, keeping .next intact.
    runtime=mkdtempSync(join(tmpdir(),"covex-b2-auth-runtime-"));
    for(const entry of readdirSync(process.cwd())) {
      if(entry.startsWith(".")||entry.endsWith(".tsbuildinfo")) continue;
      const source=join(process.cwd(),entry),destination=join(runtime,entry);
      if(entry==="src") cpSync(source,destination,{recursive:true});
      else if(["tsconfig.json","next-env.d.ts","next.config.ts"].includes(entry)) copyFileSync(source,destination);
      else symlinkSync(source,destination);
    }
    provider=spawn("node",["--import","tsx","scripts/auth-fixtures/provider.ts"],{env,stdio:"ignore",detached:true});
    app=spawn("node",[join(process.cwd(),"node_modules/next/dist/bin/next"),"dev","--hostname","127.0.0.1","--port","3009"],{env:{...env,NODE_ENV:"development",NEXT_TELEMETRY_DISABLED:"1"},stdio:"ignore",cwd:runtime,detached:true});
    const deadline=Date.now()+120000;
    let ready=false;
    while(Date.now()<deadline) {
      assert(app.exitCode===null&&provider.exitCode===null,"Synthetic test process exited");
      try {
        const response=await fetch(origin+"/api/health",{signal:AbortSignal.timeout(2000)});
        const oidc=await fetch(issuer+"/.well-known/openid-configuration",{signal:AbortSignal.timeout(2000)});
        if(response.ok&&oidc.ok){ready=true;break;}
      } catch {}
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    assert(ready,"Synthetic local app readiness failed");
    const result=spawnSync("pnpm",["phase4b1:smoke"],{env,encoding:"utf8",timeout:300000});
    assert.equal(result.status,0,"Full authentication regression failed; no rejected payload/credentials printed");
    console.log("B2 compatibility with full 4B1 authentication smoke OK: own disposable database, current local Next.js application, signed synthetic OIDC and existing seven-module scope/global-read/identity/administration checks. Local processes stopped; no corporate data/provider/deployment.");
  } finally {
    await stop(app);await stop(provider);
    if(runtime) rmSync(runtime,{recursive:true,force:true});
    if(created){await parent.$queryRaw(Prisma.sql`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=${name} AND pid<>pg_backend_pid()`);await parent.$executeRawUnsafe(`DROP DATABASE "${name}"`);}
    await parent.$disconnect();
  }
}
main().catch(error=>{console.error("Isolated B2 authentication proof failed",error?.name,error?.code,error?.stack?.split("\n").filter((line:string)=>line.trim().startsWith("at ")&&!line.includes("node_modules")).slice(0,3));process.exitCode=1;});
