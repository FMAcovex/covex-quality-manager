import { lifecyclePrincipal } from "@/modules/controlled-documents/lifecycle/access";
import { lifecycleDecision } from "@/modules/controlled-documents/lifecycle/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const responseHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function POST(request: Request, { params }: { params: Promise<{ id: string; revisionId: string }> }) {
  let principal;
  try { principal = lifecyclePrincipal(request.headers); } catch { return Response.json({ error: "Acceso documental no autorizado." }, { status: 403, headers: responseHeaders }); }
  const expectedOrigin = process.env.PNT_DOCUMENT_ALLOWED_ORIGIN || `${new URL(request.url).protocol}//${request.headers.get("host") || new URL(request.url).host}`;
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
    const message = error instanceof Error && !error.name.startsWith("Prisma") && error.name !== "ZodError" ? error.message : "No se pudo registrar la decisión; compruebe datos, evidencias y concurrencia.";
    return Response.json({ error: message }, { status: 400, headers: responseHeaders });
  }
}
