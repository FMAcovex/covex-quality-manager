import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "../db";
import { currentIdentity } from "../auth/context";
import { withDatabaseTransaction } from "../transaction-context";
import { auditPolicyState } from "./activation";
import { canonicalAuditJson } from "./canonical-json";
import { withBusinessAudit } from "./business-service";

/** The existing authorization guard selects the module; the browser never does.
 * Unrequired installations keep the proved atomic configuration composition.
 * Required installations cannot fall back if capture/context/protection fails.
 */
export async function configurationAuditBoundary(name: string, args: unknown[], execute: () => Promise<void>) {
  const context = currentIdentity();
  if (context?.unitTest && process.env.VITEST === "true" && process.env.APP_ENV === "test") {
    return withDatabaseTransaction(prisma, execute);
  }
  const state = await auditPolicyState(prisma);
  if (!state.required) return withDatabaseTransaction(prisma, execute);
  const form = args.find(a => a instanceof FormData) as FormData | undefined;
  if (!form || !context?.module) throw new Error("No se ha confirmado la operación de configuración.");
  const requestId = String(form.get("_covexAuditRequestId") ?? "").trim() || randomUUID();
  const reason = String(form.get("reason") ?? "").trim() || null;
  const business: [string, unknown][] = [];
  for (const [key,value] of form) {
    if (["actor", "createdByText", "modifiedByText", "_covexCsrf", "_covexAuditRequestId"].includes(key) || /password|token|secret|nonce|verifier/i.test(key)) continue;
    if (typeof value === "string") business.push([key,value]);
    else business.push([key,{ name: value.name, size: value.size, mimeType: value.type, sha256: createHash("sha256").update(new Uint8Array(await value.arrayBuffer())).digest("hex") }]);
  }
  business.sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0);
  const digest = createHash("sha256").update(canonicalAuditJson({ name, module: context.module, resources: args.filter(a => typeof a === "string"), business })).digest("hex");
  const operationCode = name.includes("Template") ? "TR04" : name.includes("Form") ? "TR03" : "TR02";
  await withBusinessAudit({ operationCode, module: context.module, permission: "MANAGE_CONFIGURATION" }, { requestId, digest, reason }, execute);
}
