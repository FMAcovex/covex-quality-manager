import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import previous from "../ops/backup/audit-contract-b2-critical.json";

const signatures:Record<string,string>={
  covex_c_has_permission:"uuid, text",
  covex_c_record_review:"uuid, uuid, text, uuid, text, text, jsonb, timestamp with time zone, uuid, uuid[], uuid[], uuid",
  covex_c_record_export:"uuid, uuid, text, uuid, text, text, bytea, jsonb, timestamp with time zone, uuid, uuid[], uuid[], integer",
};
export function auditCContract() {
  const sql=readFileSync("prisma/migrations/20261014000100_c_audit_review_export/migration.sql","utf8");
  const functions:Record<string,{sha256:string;definer:boolean;arguments?:string}>={...previous.functions};
  for(const match of sql.matchAll(/CREATE FUNCTION (covex_\w+)\([\s\S]*? AS \$\$([\s\S]*?)\$\$;/g)) functions[match[1]]={sha256:createHash("sha256").update(match[2]).digest("hex"),definer:match[0].includes("SECURITY DEFINER"),arguments:signatures[match[1]]};
  const triggers=[...previous.triggers];
  for(const match of sql.matchAll(/CREATE TRIGGER (\w+) BEFORE (UPDATE OR DELETE|TRUNCATE) ON "(\w+)" [\s\S]*?EXECUTE FUNCTION (\w+)\(\);/g)) triggers.push({name:match[1],table:match[3],function:match[4],type:match[2]==="TRUNCATE"?34:27,deferred:false});
  return {...previous,contractVersion:"C_REVIEW_EXPORT",tables:[...previous.tables,"AuditTrailReview","AuditTrailReviewOperation","AuditTrailReviewEvent","AuditTrailExport","AuditTrailExportEvent"],functions,triggers};
}
if(basename(process.argv[1]??"")==="audit-c-build.ts"&&process.argv.includes("--contract"))process.stdout.write(JSON.stringify(auditCContract(),null,2)+"\n");
