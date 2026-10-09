import { lifecyclePrincipal } from "@/modules/controlled-documents/lifecycle/access";
import { changeManualRevisionStatus } from "@/modules/controlled-documents/manual-state/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const safeHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function POST(request: Request, { params }: { params: Promise<{ id: string; revisionId: string }> }) {
  let principal;
  try { principal = lifecyclePrincipal(request.headers); }
  catch { return Response.json({ error: "Acceso documental no autorizado." }, { status: 403, headers: safeHeaders }); }
  const expectedOrigin = process.env.PNT_DOCUMENT_ALLOWED_ORIGIN || new URL(request.url).origin;
  if (request.headers.get("origin") !== expectedOrigin)
    return Response.json({ error: "Origen no autorizado." }, { status: 403, headers: safeHeaders });
  if (!request.headers.get("content-type")?.startsWith("application/json") || !request.body)
    return Response.json({ error: "Solicitud inválida." }, { status: 400, headers: safeHeaders });
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > 8192) return Response.json({ error: "Solicitud demasiado grande." }, { status: 413, headers: safeHeaders });
  try {
    const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength;
      if (size > 8192) { await reader.cancel(); return Response.json({ error: "Solicitud demasiado grande." }, { status: 413, headers: safeHeaders }); }
      chunks.push(part.value);
    } } finally { reader.releaseLock(); }
    const { id, revisionId } = await params;
    const decision = await changeManualRevisionStatus(id, revisionId, JSON.parse(Buffer.concat(chunks).toString("utf8")), principal);
    return Response.json({ id: decision.id, version: decision.sequence }, { status: 201, headers: safeHeaders });
  } catch (error) {
    const message = error instanceof Error && !error.name.startsWith("Prisma") && error.name !== "ZodError"
      ? error.message : "No se ha podido registrar el cambio de estado. Recargue y compruebe los datos.";
    return Response.json({ error: message }, { status: 400, headers: safeHeaders });
  }
}
