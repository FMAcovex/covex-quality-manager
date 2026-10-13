import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import contract from "../../../ops/backup/audit-contract.json";
import { AuditEngineError } from "./domain";

export async function assertAuditProtection(tx: Prisma.TransactionClient) {
  const tables = await tx.$queryRaw<{ name: string; owner: string }[]>`SELECT c.relname AS name,pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY(${contract.tables}::text[])`;
  if (tables.length !== contract.tables.length || new Set(tables.map(t=>t.owner)).size !== 1) throw new AuditEngineError("PROTECTION");
  const functions = await tx.$queryRaw<{ name: string; body: string; definer: boolean; config: string[] | null; owner: string; publicExecute: boolean }[]>`SELECT p.proname AS name,p.prosrc AS body,p.prosecdef AS definer,p.proconfig AS config,pg_get_userbyid(p.proowner) AS owner,EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS "publicExecute" FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'covex_audit_%'`;
  if (functions.length !== Object.keys(contract.functions).length) throw new AuditEngineError("PROTECTION");
  for (const [name, expected] of Object.entries(contract.functions)) {
    const actual = functions.find(f=>f.name===name);
    if (!actual || createHash("sha256").update(actual.body).digest("hex")!==expected.sha256 || actual.definer!==expected.definer || actual.owner!==tables[0].owner || actual.publicExecute || actual.config?.join()!=="search_path=pg_catalog, public") throw new AuditEngineError("PROTECTION");
  }
  const triggers = await tx.$queryRaw<{ name: string; table: string; function: string; enabled: string; type: number; deferred: boolean; deferrable: boolean }[]>`SELECT t.tgname AS name,c.relname AS "table",p.proname AS function,t.tgenabled::text AS enabled,t.tgtype::integer AS type,t.tginitdeferred AS deferred,t.tgdeferrable AS deferrable FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid WHERE n.nspname='public' AND c.relname=ANY(${contract.tables}::text[]) AND NOT t.tgisinternal`;
  if (triggers.length!==contract.triggers.length) throw new AuditEngineError("PROTECTION");
  for (const expected of contract.triggers) {
    const actual = triggers.find(t=>t.name===expected.name && t.table===expected.table);
    if (!actual || actual.enabled!=="O" || actual.function!==expected.function || actual.type!==expected.type || actual.deferred!==expected.deferred || actual.deferrable!==expected.deferred) throw new AuditEngineError("PROTECTION");
  }
}

export async function assertAuditApplicationRole(tx: Prisma.TransactionClient) {
  const [result] = await tx.$queryRaw<{ unsafe: boolean }[]>`SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolcreaterole)) OR has_schema_privilege(current_user,'public','CREATE') OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY(${["AuditOperation","AuditEvent","AuditOperationTarget","AuditAggregateCursor","AuditRuntimeContext"]}::text[]) AND (pg_has_role(current_user,c.relowner,'USAGE') OR has_table_privilege(current_user,c.oid,'DELETE,TRUNCATE') OR has_any_column_privilege(current_user,c.oid,'INSERT') OR has_any_column_privilege(current_user,c.oid,'UPDATE'))) AS unsafe`;
  if (!result || result.unsafe) throw new AuditEngineError("PROTECTION");
}
