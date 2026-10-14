import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { currentIdentity } from "@/lib/auth/context";
import { auditPolicyState } from "@/lib/audit/activation";
import { canonicalAuditJson } from "@/lib/audit/canonical-json";

export type ImportAuditRequest = { requestId?: string };
export function importActor(provided: string) {
  const identity = currentIdentity();
  return identity && !identity.unitTest ? identity.principal.name : provided;
}
/** Batch/row protocols store references to their existing persisted receipts,
 * never entire workbook/proposal responses or authentication material. */
export async function importAuditCommand<T>(db: PrismaClient, operation: string, input: unknown, reason: string | null,
  request: ImportAuditRequest | undefined, execute: () => Promise<T>): Promise<T> {
  if (!(await auditPolicyState(db)).required) return execute();
  const { withBusinessAuditResult } = await import("@/lib/audit/business-service");
  return withBusinessAuditResult({ operationCode: "PN06", module: "PNT", permission: "IMPORT" }, {
    requestId: request?.requestId || randomUUID(), reason,
    digest: createHash("sha256").update(canonicalAuditJson({ operation, input })).digest("hex"),
  }, execute, db);
}
