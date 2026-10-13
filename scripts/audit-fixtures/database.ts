import { PrismaClient, Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";

// All callers create their own disposable database; never run against habitual data.
export async function auditApplicationFixture(source: PrismaClient, url: URL, role: string, provisioner: PrismaClient = source, connection?: (url: URL) => void) {
  if (!/^covex_phase4b1_test_[a-z0-9_]+$/.test(url.pathname.slice(1)) || !["127.0.0.1","localhost"].includes(url.hostname) || !/^covex4b3_[a-z0-9_]+$/.test(role)) throw Error("Disposable audit fixture required");
  const secret=randomBytes(32).toString("hex");
  await provisioner.$executeRawUnsafe(`CREATE ROLE "${role}" LOGIN PASSWORD '${secret}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`);
  await source.$executeRawUnsafe(`GRANT CONNECT ON DATABASE "${url.pathname.slice(1)}" TO "${role}"`);
  await source.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
  await source.$executeRawUnsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${role}"`);
  await source.$executeRawUnsafe(`REVOKE ALL ON "AuditRuntimeContext" FROM "${role}"`);
  const privateTables = await source.$queryRaw<{ name: string }[]>`SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('AuditBusinessContext','AuditMutationWitness','AuditRootBinding')`;
  for (const table of privateTables) await source.$executeRawUnsafe(`REVOKE ALL ON "${table.name}" FROM "${role}"`);
  await source.$executeRawUnsafe(`GRANT UPDATE(value) ON "AuditPilotRecord" TO "${role}"`);
  await source.$executeRawUnsafe(`GRANT INSERT ON "ChangeHistory" TO "${role}"`);
  await source.$executeRawUnsafe(`GRANT EXECUTE ON FUNCTION covex_audit_begin(UUID,UUID,TEXT,TEXT,JSONB) TO "${role}"`);
  const appUrl=new URL(url);appUrl.username=role;appUrl.password=secret;
  connection?.(new URL(appUrl));
  return new PrismaClient({datasourceUrl:appUrl.href,log:[]});
}

export async function auditedSqlFixture(app: PrismaClient, actorId: string, roots: string[], requestId: string, value: number) {
  return app.$transaction(async tx=>{
    const [result]=await tx.$queryRaw<{operation_id:string;replayed:boolean}[]>(Prisma.sql`SELECT * FROM covex_audit_begin(${actorId}::uuid,${requestId}::uuid,${"a".repeat(64)},'Synthetic recovery evidence',${JSON.stringify(roots.map(id=>({kind:"QMS_RECORD",id})))}::jsonb)`);
    if(!result.replayed) for(const id of roots) await tx.auditPilotRecord.update({where:{qmsRecordId:id},data:{value}});
    return result;
  });
}
