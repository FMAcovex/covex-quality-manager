import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import type { AccessModule } from "../auth/context";
import { prisma } from "../db";
import { auditPolicyState } from "./activation";
import { canonicalAuditJson } from "./canonical-json";

const requests = new AsyncLocalStorage<{ requestId: string; url: string }>();
export function inDocumentRequest<T>(request: Request, execute: () => Promise<T>): Promise<T> {
  return requests.run({ requestId: request.headers.get("idempotency-key") ?? randomUUID(), url: request.url }, execute);
}

/** Retains the existing download semantics. A receipt references the persisted
 * metadata/original, never the document bytes and never a new formal version. */
export async function documentCommand(module: AccessModule, scope: { id: string; departmentIds?: string[] },
  fingerprint: unknown, execute: () => Promise<{ id: string }>): Promise<string> {
  if (!(await auditPolicyState(prisma)).required) return (await execute()).id;
  const [{ withBusinessAuditResult }, { requireUser }, { assertPermission }] = await Promise.all([
    import("./business-service"), import("../auth/session"), import("../auth/policy"),
  ]);
  const user = await requireUser();
  assertPermission(user, module, "GENERATE_DOCUMENT", scope);
  // OOS no genera documentos todavía ni tiene operación documental en la matriz (D-088, OOS-3).
  const codes: Partial<Record<AccessModule, string>> = { DEVIATION: "DV08", CAPA: "CA08", CHANGE_CONTROL: "CC07", COMPLAINT: "RC07", RETURN: "DE07", AUDIT: "AU06", PNT: "PN05", SYSTEM: "TR03" };
  const code = codes[module];
  if (!code) throw new Error(`El módulo ${module} no tiene operación de generación documental.`);
  const request = requests.getStore();
  const receipt = await withBusinessAuditResult({ operationCode: code, module, permission: "GENERATE_DOCUMENT" }, {
    requestId: request?.requestId ?? randomUUID(), reason: null,
    digest: createHash("sha256").update(canonicalAuditJson({ module, scope, fingerprint, url: request?.url ?? null })).digest("hex"),
  }, async () => {
    assertPermission(user, module, "GENERATE_DOCUMENT", scope);
    return { documentId: (await execute()).id };
  });
  return receipt.documentId;
}
