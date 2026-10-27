import { PrismaClient, Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import businessContract from "../../ops/backup/audit-contract-pnt-assignments.json";

// All callers create their own disposable database; never run against habitual data.
export async function auditApplicationFixture(source: PrismaClient, url: URL, role: string, provisioner: PrismaClient = source, connection?: (url: URL) => void) {
  if (!/^covex_phase4b1_test_[a-z0-9_]+$/.test(url.pathname.slice(1)) || !["127.0.0.1","localhost"].includes(url.hostname) || !/^covex4b3_[a-z0-9_]+$/.test(role)) throw Error("Disposable audit fixture required");
  const secret=randomBytes(32).toString("hex");
  await provisioner.$executeRawUnsafe(`CREATE ROLE "${role}" LOGIN PASSWORD '${secret}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`);
  await source.$executeRawUnsafe(`GRANT CONNECT ON DATABASE "${url.pathname.slice(1)}" TO "${role}"`);
  await source.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
  await source.$executeRawUnsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${role}"`);
  await source.$executeRawUnsafe(`REVOKE ALL ON "AuditRuntimeContext" FROM "${role}"`);
  const privateTables = await source.$queryRaw<{ name: string }[]>`SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('AuditBusinessContext','AuditMutationWitness','AuditRootBinding','AuditTechnicalContext','AuditRootMaturity')`;
  for (const table of privateTables) await source.$executeRawUnsafe(`REVOKE ALL ON "${table.name}" FROM "${role}"`);
  await source.$executeRawUnsafe(`GRANT UPDATE(value) ON "AuditPilotRecord" TO "${role}"`);
  await source.$executeRawUnsafe(`GRANT INSERT ON "ChangeHistory" TO "${role}"`);
  await source.$executeRawUnsafe(`GRANT EXECUTE ON FUNCTION covex_audit_begin(UUID,UUID,TEXT,TEXT,JSONB) TO "${role}"`);
  const [review]=await source.$queryRaw<{present:boolean}[]>`SELECT to_regclass('public."AuditTrailReview"') IS NOT NULL AS present`;
  if(review.present)await source.$executeRawUnsafe(`GRANT EXECUTE ON FUNCTION covex_c_record_review(UUID,UUID,TEXT,UUID,TEXT,TEXT,JSONB,TIMESTAMPTZ,UUID,UUID[],UUID[],UUID),covex_c_record_export(UUID,UUID,TEXT,UUID,TEXT,TEXT,BYTEA,JSONB,TIMESTAMPTZ,UUID,UUID[],UUID[],INTEGER) TO "${role}"`);
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

/** Fixture-local preparation, not operational role provisioning. */
export async function businessApplicationGrantsFixture(owner: PrismaClient, role: string) {
  if (!/^covex4b3_[a-z0-9_]+$/.test(role)) throw Error("Synthetic role required");
  await owner.$executeRawUnsafe(`GRANT INSERT,UPDATE,DELETE ON ${businessContract.guardTables.filter(t => t !== "SignedDocumentCustody").map(t => '"' + t + '"').join(",")} TO "${role}"`);
  await owner.$executeRawUnsafe(`GRANT EXECUTE ON FUNCTION covex_b2_begin(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT),covex_b2_command_outcome(JSONB,JSONB),covex_b2_check_claims(UUID,JSONB),covex_b2_retain_signed_original(UUID,TEXT,TEXT,TEXT,BYTEA,TEXT,TEXT,TEXT,TEXT),covex_b2_expire_staging(UUID) TO "${role}"`);
}

export async function businessSqlFixture(app: PrismaClient, actorId: string, requestId: string,
  operation: string, module: string, permission: string, reason: string | null,
  write: (tx: Prisma.TransactionClient) => Promise<void>) {
  return app.$transaction(async tx => {
    const [started] = await tx.$queryRaw<{ operation_id: string | null; replayed: boolean }[]>(Prisma.sql`SELECT * FROM covex_b2_begin(${actorId}::uuid,${requestId}::uuid,${"b".repeat(64)},${operation},${module},${permission},${reason})`);
    if (!started.replayed) {
      await write(tx);
      await tx.$executeRaw`SELECT covex_b2_command_outcome('{"kind":"RETURN","value":{"synthetic":true}}'::jsonb,'[]'::jsonb)`;
    }
    const result = await tx.auditOperation.findUniqueOrThrow({ where: { actorUserId_origin_requestId: { actorUserId: actorId, origin: "QMS_SERVER", requestId } } });
    return result.id;
  }, { timeout: 30000 });
}
