import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import previous from "../ops/backup/audit-contract-oos-documents.json";

// D-088, OOS-4: covex_b2_retain_signed_original keeps OOS Anexo III/IV signed PDFs. Function-only release.
export const oosSignedMigration = "prisma/migrations/20261017000600_b2_oos_signed_documents/migration.sql";
export function auditOosSignedContract() {
  const sql = readFileSync(oosSignedMigration, "utf8");
  const functions: Record<string, { sha256: string; definer: boolean; arguments?: string }> = { ...previous.functions };
  for (const match of sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION (covex_\w+)\([\s\S]*? AS \$\$([\s\S]*?)\$\$;/g)) functions[match[1]] = { sha256: createHash("sha256").update(match[2]).digest("hex"), definer: match[0].includes("SECURITY DEFINER") };
  return { ...previous, contractVersion: "B2_OOS_SIGNED_DOCUMENTS", functions };
}
if (basename(process.argv[1] ?? "") === "audit-oos-signed-build.ts" && process.argv.includes("--contract")) process.stdout.write(JSON.stringify(auditOosSignedContract(), null, 2) + "\n");
