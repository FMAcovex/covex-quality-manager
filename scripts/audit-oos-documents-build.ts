import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import previous from "../ops/backup/audit-contract-oos.json";

// D-088, OOS-3: covex_b2_begin admits OO06 (OOS annex generation). Function-only release.
export const oosDocumentsMigration = "prisma/migrations/20261017000400_b2_oos_documents/migration.sql";
export function auditOosDocumentsContract() {
  const sql = readFileSync(oosDocumentsMigration, "utf8");
  const functions: Record<string, { sha256: string; definer: boolean; arguments?: string }> = { ...previous.functions };
  for (const match of sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION (covex_\w+)\([\s\S]*? AS \$\$([\s\S]*?)\$\$;/g)) functions[match[1]] = { sha256: createHash("sha256").update(match[2]).digest("hex"), definer: match[0].includes("SECURITY DEFINER") };
  return { ...previous, contractVersion: "B2_OOS_DOCUMENTS", functions };
}
if (basename(process.argv[1] ?? "") === "audit-oos-documents-build.ts" && process.argv.includes("--contract")) process.stdout.write(JSON.stringify(auditOosDocumentsContract(), null, 2) + "\n");
