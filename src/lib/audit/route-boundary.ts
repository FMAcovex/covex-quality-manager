import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "../db";
import { currentIdentity, type AccessModule, type AccessPermission } from "../auth/context";
import { auditPolicyState } from "./activation";
import { canonicalAuditJson } from "./canonical-json";
import { actionCommand } from "./action-boundary";
import { withBusinessAuditResult } from "./business-service";
import { inDocumentRequest } from "./document-command";

function operation(file: string, module: AccessModule, input: Record<string, unknown> | null) {
  if (file.endsWith("/administrative-status/route.ts")) return ({ DEVIATION: "DV07", CAPA: "CA07", CHANGE_CONTROL: "CC06", COMPLAINT: "RC06", RETURN: "DE06", AUDIT: "AU07" } as Partial<Record<AccessModule, string>>)[module];
  if (file.endsWith("/manual-status/route.ts")) return "PN04";
  if (file.endsWith("/lifecycle/route.ts")) return input?.operation === "ACTIVATE" ? "PN03" : ["RETIRE", "ANNUL", "RECTIFY"].includes(String(input?.operation)) ? "PN04" : "PN02";
  if (file.includes("/revisions/") && file.endsWith("/documents/route.ts")) return "PN05";
  return undefined;
}
const clean = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !/^_covex|^(actor|createdByText|modifiedByText)$|password|secret|token|verifier/i.test(key)).map(([key, item]) => [key, clean(item)]));
  return value;
};

/** Only explicit JSON-response writers enter this envelope. Read/download,
 * technical expiry and import row/batch protocols have separate composition. */
export async function routeAuditBoundary(file: string, method: string, request: Request, params: Record<string, string>, module: AccessModule, permission: AccessPermission, input: Record<string, unknown> | null, execute: () => Promise<Response>): Promise<Response> {
  if (method === "GET" && (file.includes("/annex-") || file === "src/app/api/audits/[id]/documents/route.ts")) return inDocumentRequest(request, execute);
  const code = method === "POST" ? operation(file, module, input) : undefined;
  if (!code || currentIdentity()?.unitTest && process.env.VITEST === "true" && process.env.APP_ENV === "test") return execute();
  if (!(await auditPolicyState(prisma)).required) return execute();
  let command;
  if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    const copy = request.clone(), reader = copy.body?.getReader();
    if (!reader) return Response.json({ error: "Solicitud documental inválida." }, { status: 400 });
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.byteLength;
        if (size > 16 * 1024 * 1024) { await reader.cancel(); return Response.json({ error: "Solicitud documental demasiado grande." }, { status: 413 }); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    const form = await new Request(request.url, { method: "POST", headers: { "content-type": request.headers.get("content-type")! }, body: new Uint8Array(Buffer.concat(chunks)) }).formData();
    command = await actionCommand(file, [params.id, params.revisionId, form]);
  } else {
    command = { requestId: String(input?._covexAuditRequestId ?? input?.requestId ?? request.headers.get("idempotency-key") ?? randomUUID()), reason: typeof input?.reason === "string" ? input.reason.trim() || null : null,
      digest: createHash("sha256").update(canonicalAuditJson({ file, module, params, input: clean(input) })).digest("hex") };
  }
  const result = await withBusinessAuditResult({ operationCode: code, module, permission }, command, async () => {
    const response = await execute();
    // These writers return bounded JSON, not document bytes or session cookies.
    const body = await response.clone().text();
    if (body.length > 60000 || !response.headers.get("content-type")?.includes("application/json")) throw Error("Unexpected business response");
    return { error: response.ok ? null : "La operación no se ha confirmado.", status: response.status, headers: [...response.headers].filter(([key]) => !/cookie|token|authorization/i.test(key)), body };
  });
  return new Response(result.body, { status: result.status, headers: result.headers });
}
