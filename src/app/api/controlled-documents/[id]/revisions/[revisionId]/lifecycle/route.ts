import { authorizedRoute } from "@/lib/auth/route-guard";
import { expectedDocumentOrigin } from "@/modules/controlled-documents/documents/session-access";
import { lifecyclePrincipal } from "@/modules/controlled-documents/lifecycle/access";
import { lifecycleDecision } from "@/modules/controlled-documents/lifecycle/service";
import { logServerError } from "@/lib/log/server-log";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const responseHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
async function POSTAuthenticatedContent(request: Request, { params }: { params: Promise<{ id: string; revisionId: string }> }) {
  let principal;
  try { principal = lifecyclePrincipal(request.headers); } catch { /* Sin permiso o acceso no configurado: se responde como acceso denegado. */ return Response.json({ error: "Acceso documental no autorizado." }, { status: 403, headers: responseHeaders }); }
  const expectedOrigin = expectedDocumentOrigin(request);
  if (request.headers.get("origin") !== expectedOrigin) return Response.json({ error: "Origen no autorizado." }, { status: 403, headers: responseHeaders });
  try {
    if (!request.headers.get("content-type")?.startsWith("application/json") || !request.body) throw new Error("Solicitud inválida.");
    const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength;
      if (size > 64 * 1024) { await reader.cancel(); return Response.json({ error: "Solicitud demasiado grande." }, { status: 413, headers: responseHeaders }); } chunks.push(part.value);
    } } finally { reader.releaseLock(); }
    const { id, revisionId } = await params;
    const decision = await lifecycleDecision(id, revisionId, JSON.parse(Buffer.concat(chunks).toString("utf8")), principal);
    return Response.json({ id: decision.id, version: decision.sequence }, { status: 201, headers: responseHeaders });
  } catch (error) {
    if (!(error instanceof Error) || error.name.startsWith("Prisma")) logServerError("controlled-documents.lifecycle", error, { module: "PNT" });
    const message = error instanceof Error && !error.name.startsWith("Prisma") && error.name !== "ZodError" ? error.message : "No se pudo registrar la decisión; compruebe datos, evidencias y concurrencia.";
    return Response.json({ error: message }, { status: 400, headers: responseHeaders });
  }
}

export async function POST(...args: Parameters<typeof POSTAuthenticatedContent>) {
  return authorizedRoute("src/app/api/controlled-documents/[id]/revisions/[revisionId]/lifecycle/route.ts", "POST", args, authenticated => POSTAuthenticatedContent(...authenticated as Parameters<typeof POSTAuthenticatedContent>));
}
