import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import foundation from "../ops/backup/audit-contract-b2.json";
import { auditCapturePolicy, auditCapturePolicySql } from "./audit-capture-policy";
import { canonicalAuditJson } from "../src/lib/audit/canonical-json";

export const captureMigration = "prisma/migrations/20261013000300_b2_sql_capture/migration.sql";
const additions = ["AuditAdministrationRoot", "AuditEventAdditionalTarget", "AuditBusinessContext", "AuditMutationWitness", "AuditRootBinding", "AuditCaptureTablePolicy", "AuditCaptureFieldPolicy", "AuditOperationEvidence"];
export const privateCaptureTables = ["AuditBusinessContext", "AuditMutationWitness", "AuditRootBinding"];
function previousFunction(file: string, name: string) {
  const sql = readFileSync(file, "utf8"), match = sql.match(new RegExp(`CREATE FUNCTION ${name}\\([\\s\\S]*?\\$\\$;`));
  if (!match) throw Error("Previous audit function missing: " + name);
  return match[0].replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION");
}
export function auditCaptureMigration() {
  let sql = readFileSync(captureMigration, "utf8");
  sql = sql.slice(0, sql.indexOf("-- ENGINE_REPLACEMENTS:"));
  const policyStart = sql.indexOf("-- CAPTURE_POLICY_ROWS:");
  sql = sql.slice(0,policyStart) + "-- CAPTURE_POLICY_ROWS: fixed release metadata; never an application input.\n" + auditCapturePolicySql() + "\n\n" + sql.slice(sql.indexOf("CREATE FUNCTION covex_b2_entity_key",policyStart));
  const b1Path = "prisma/migrations/20261013000100_audit_engine_b1/migration.sql";
  const typed = previousFunction(b1Path,"covex_audit_value_valid").replace("  IF jsonb_typeof(value->'value')<>'string'", "  IF kind='JSON' THEN RETURN true; END IF;\n  IF jsonb_typeof(value->'value')<>'string'");
  const coverage = previousFunction(b1Path,"covex_audit_require_events").replace("BEGIN\n", "BEGIN\n  -- General B2 coverage is independently enforced by the private command lease.\n  IF NEW.\"policyVersion\"='QMS_B2_ENGINE_V1' THEN RETURN NULL; END IF;\n");
  const guard = previousFunction("prisma/migrations/20261013000200_b2_audit_requirement/migration.sql","covex_b2_required_guard").replace("BEGIN\n", () => `BEGIN
  IF current_database() ~ '^covex_phase4b1_test_[a-z0-9_]+$' AND EXISTS(
    SELECT 1 FROM public."AuditBusinessContext" WHERE "transactionId"=txid_current() AND "backendPid"=pg_backend_pid() AND "databasePrincipal"=session_user) THEN
    PERFORM public.covex_b2_before(TG_TABLE_NAME,TG_OP,CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END,CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END);
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
`);
  sql += "-- ENGINE_REPLACEMENTS: additive replacements preserve the B1 branch exactly.\n" + [typed,coverage,guard].join("\n") + "\n";
  sql += "-- ENGINE_TRIGGERS_AND_GRANTS: generated hooks and explicit non-public grants.\n";
  for (const table of foundation.guardTables) {
    sql += `CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "${table}" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();\n`;
    sql += `CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "${table}" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();\n`;
  }
  for (const table of additions.filter(t => !privateCaptureTables.includes(t))) {
    sql += `CREATE TRIGGER audit_b2_immutable BEFORE UPDATE OR DELETE ON "${table}" FOR EACH ROW EXECUTE FUNCTION covex_audit_immutable();\n`;
    sql += `CREATE TRIGGER audit_b2_no_truncate BEFORE TRUNCATE ON "${table}" FOR EACH STATEMENT EXECUTE FUNCTION covex_audit_immutable();\n`;
  }
  sql += `DO $$
DECLARE function_id regprocedure; object_name TEXT; owner_role TEXT:=pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public."AuditOperation"'::regclass));
BEGIN
  FOREACH object_name IN ARRAY ARRAY[${additions.map(t => "'"+t+"'").join(",")}] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',object_name);
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='covex_app') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM covex_app',object_name);
      IF object_name NOT IN ('AuditBusinessContext','AuditMutationWitness','AuditRootBinding') THEN EXECUTE format('GRANT SELECT ON public.%I TO covex_app',object_name); END IF;
    END IF;
    EXECUTE format('ALTER TABLE public.%I OWNER TO %I',object_name,owner_role);
  END LOOP;
  -- Root resolution reads only versioned business tables, not sessions/secrets.
  FOR object_name IN SELECT "entityType" FROM public."AuditCaptureTablePolicy" LOOP EXECUTE format('GRANT SELECT ON public.%I TO %I',object_name,owner_role); END LOOP;
  EXECUTE format('GRANT REFERENCES ON public."ChangeHistory",public."ConfigurationChange",public."AuthAuthorizationChange",public."AuditPlanChange",public."ControlledDocumentChange" TO %I',owner_role);
  FOR function_id IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'covex_b2_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',function_id);
    EXECUTE format('ALTER FUNCTION %s OWNER TO %I',function_id,owner_role);
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='covex_app') THEN
    GRANT EXECUTE ON FUNCTION covex_b2_begin(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT) TO covex_app;
  END IF;
END;
$$;
COMMIT;
`;
  return sql;
}
export function auditCaptureContract() {
  const sql = auditCaptureMigration();
  const functions: Record<string, { sha256: string; definer: boolean }> = { ...foundation.functions };
  for (const match of sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION (covex_\w+)\([\s\S]*? AS \$\$([\s\S]*?)\$\$;/g)) {
    functions[match[1]] = { sha256: createHash("sha256").update(match[2]).digest("hex"), definer: match[0].includes("SECURITY DEFINER") };
  }
  const triggers = [...foundation.triggers];
  for (const match of sql.matchAll(/CREATE (CONSTRAINT )?TRIGGER (\w+) (BEFORE|AFTER) (INSERT OR UPDATE OR DELETE|UPDATE OR DELETE|TRUNCATE|INSERT) ON "(\w+)" ([\s\S]*?)EXECUTE FUNCTION (\w+)\(\);/g)) {
    const type = match[4] === "TRUNCATE" ? 34 : (match[3] === "BEFORE" ? 2 : 0) + 1 + (match[4].includes("INSERT") ? 4 : 0) + (match[4].includes("UPDATE") ? 16 : 0) + (match[4].includes("DELETE") ? 8 : 0);
    triggers.push({ name: match[2], table: match[5], function: match[7], type, deferred: !!match[1] });
  }
  return { ...foundation, contractVersion: "B2_SQL_CAPTURE_FOUNDATION", tables: [...foundation.tables,...additions], privateTables: ["AuditRuntimeContext",...privateCaptureTables], functions, triggers, capturePolicySha256: createHash("sha256").update(canonicalAuditJson(auditCapturePolicy())).digest("hex") };
}
if (basename(process.argv[1] ?? "") === "audit-capture-build.ts") {
  if (process.argv.includes("--sql")) process.stdout.write(auditCaptureMigration());
  else if (process.argv.includes("--contract")) process.stdout.write(JSON.stringify(auditCaptureContract(),null,2)+"\n");
}
