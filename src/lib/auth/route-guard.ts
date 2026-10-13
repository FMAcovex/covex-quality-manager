import { prisma } from "../db";
import inventory from "./operation-inventory.json";
import { AccessError, currentIdentity, identityContext, type AccessModule, type AccessPermission } from "./context";
import { assertPermission } from "./policy";
import { qmsScope, resourceScope } from "./resources";
import { requireCsrf, requireUser } from "./session";

async function boundedJson(request: Request) {
  if (!request.body) return null;
  const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 8 * 1024 * 1024) { await reader.cancel(); throw new AccessError(403); } chunks.push(part.value); } }
  finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return null; }
}
async function authorizeAndRunRoute<T extends Response>(file: string, method: string, args: unknown[], run: (authenticated: unknown[]) => Promise<T>): Promise<T | Response> {
  const entry = inventory.routes.find(r => r.file === file && r.method === method);
  if (!entry) return Response.json({ error: "Operación no autorizada." }, { status: 403 });
  if (entry.public) return run(args);
  try {
    const request = args[0] as Request, user = await requireUser(request), context = currentIdentity();
    const unit = context?.unitTest && process.env.VITEST === "true" && process.env.APP_ENV === "test";
    if (method !== "GET" && method !== "HEAD") await requireCsrf(request);
    const params = await (args[1] as { params?: Promise<Record<string, string>> } | undefined)?.params ?? {};
    let accessModule = entry.module as AccessModule, permission = entry.permission as AccessPermission;
    let scope: { id?: string; departmentIds?: string[] } = {};
    let body: Record<string, unknown> | null = null;
    if (request.headers.get("content-type")?.startsWith("application/json") && method !== "GET") body = await boundedJson(request.clone());
    if (accessModule === ("QMS" as AccessModule)) {
      if (params.id && !unit) { const resolved = await qmsScope(params.id); accessModule = resolved.module; scope = resolved.scope; }
      else accessModule = "DEVIATION";
      if (file.includes("/reminders/")) {
        permission = "FOLLOWUP";
        if (!unit && Array.isArray(body?.recordIds)) for (const id of body.recordIds) { const target = await qmsScope(String(id)); assertPermission(user, target.module, permission, target.scope); accessModule = target.module; scope = target.scope; }
      }
    } else if (accessModule === "SYSTEM" && params.id && !unit) {
      const template = await prisma.templateVersion.findUnique({ where: { id: params.id }, select: { module: true } });
      if (!template) throw new AccessError(403); accessModule = template.module as AccessModule;
    } else if (params.id && !unit && !file.includes("/import-batches/")) scope = await resourceScope(accessModule, params.id, file.includes("/plans/") ? "AUDIT_PLAN" : "RECORD");
    if (file.includes("/lifecycle/") && method === "POST") {
      const operations: Record<string, AccessPermission> = { VERIFY: "PNT_VERIFY", REGISTER_EXTERNAL: "PNT_RECORD_APPROVAL", CONTRAST_EXTERNAL: "PNT_ACCEPT_APPROVAL", SUBMIT: "PNT_VERIFY", PLAN: "PNT_ACCEPT_APPROVAL", ACTIVATE: "PNT_ACTIVATE", RETIRE: "PNT_RETIRE", ANNUL: "PNT_RETIRE", RECTIFY: "PNT_CORRECT" };
      permission = operations[String(body?.operation)] ?? "PNT_MANAGE_STATE";
      if (body?.operation === "ANNUL") assertPermission(user, accessModule, "ANNUL", scope);
    }
    if (file.includes("/manual-status/") && method === "POST") {
      permission = "PNT_MANAGE_STATE";
      if (body?.targetStatus === "ANNULLED") assertPermission(user, accessModule, "ANNUL", scope);
    }
    if (file.endsWith("/documents/route.ts") && accessModule === "PNT" && method === "POST") permission = "ATTACH_DOCUMENT";
    assertPermission(user, accessModule, permission, scope);
    const url = new URL(request.url);
    if ((params.id && /\/annex-/.test(file)) || (file === "src/app/api/audits/[id]/documents/route.ts" && !url.searchParams.has("document"))) assertPermission(user, accessModule, "GENERATE_DOCUMENT", scope);
    if (body && "actor" in body) body.actor = user.name;
    if (body?.input && typeof body.input === "object") body.input = { ...body.input, actor: user.name };
    const authenticated = [...args];
    if (body) authenticated[0] = new Request(request.url, { method, headers: request.headers, body: JSON.stringify(body) });
    const response = await identityContext.run({ principal: user, ...(unit ? { unitTest: true } : {}), ...(context?.testHarness ? { testHarness: true } : {}), auditClaims: context?.auditClaims, resource: scope, module: accessModule, createdRecords: new Set<string>() }, async () => {
      if (unit) return run(authenticated);
      const { routeAuditBoundary } = await import("../audit/route-boundary");
      return routeAuditBoundary(file, method, authenticated[0] as Request, params, accessModule, permission, body, () => run(authenticated));
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    if (error instanceof AccessError) return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "private, no-store" } });
    throw error;
  }
}

export async function authorizedRoute<T extends Response>(file: string, method: string, args: unknown[], run: (authenticated: unknown[]) => Promise<T>): Promise<T | Response> {
  const entry = inventory.routes.find(r => r.file === file && r.method === method);
  if (!entry || entry.public) return authorizeAndRunRoute(file, method, args, run);
  try {
    const context = currentIdentity(), principal = await requireUser(args[0] as Request);
    return await identityContext.run({ ...context, principal, auditClaims: [] }, () => authorizeAndRunRoute(file, method, args, run));
  } catch (error) {
    if (error instanceof AccessError) return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "private, no-store" } });
    throw error;
  }
}
