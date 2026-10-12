import { authorizedRoute } from "@/lib/auth/route-guard";
import { expectedDocumentOrigin } from "@/modules/controlled-documents/documents/session-access";
import { documentPrincipal, requireDocumentWrite } from "@/modules/controlled-documents/documents/access";
import { MAX_DOCUMENT_SIZE, uuid } from "@/modules/controlled-documents/documents/domain";
import { incorporateDocument } from "@/modules/controlled-documents/documents/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
async function POSTAuthenticatedContent(request: Request, { params }: { params: Promise<{ id: string; revisionId: string }> }) {
  let principal;
  try { principal = documentPrincipal(request.headers); requireDocumentWrite(principal); } catch { return Response.json({ error: "Acceso documental de escritura no autorizado." }, { status: 403, headers }); }
  const expectedOrigin = expectedDocumentOrigin(request);
  if (request.headers.get("origin") !== expectedOrigin) return Response.json({ error: "Origen de solicitud no autorizado." }, { status: 403, headers });
  try {
    const { id, revisionId } = await params; uuid(id); uuid(revisionId);
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.startsWith("multipart/form-data") || !request.body) throw new Error("Solicitud documental inválida.");
    const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength;
      if (size > MAX_DOCUMENT_SIZE + 1024 * 1024) { await reader.cancel(); return Response.json({ error: "Solicitud superior a 16 MiB." }, { status: 413, headers }); }
      chunks.push(part.value);
    } } finally { reader.releaseLock(); }
    const form = await new Request(request.url, { method: "POST", headers: { "content-type": contentType }, body: new Uint8Array(Buffer.concat(chunks)) }).formData();
    const text = (key: string) => typeof form.get(key) === "string" ? String(form.get(key)) : "";
    const mode = text("mode"), file = form.get("file");
    if (!["file", "reference"].includes(mode)) throw new Error("Seleccione archivo o referencia.");
    if (mode === "file" && (!(file instanceof File) || !file.size || file.size > MAX_DOCUMENT_SIZE)) throw new Error("Seleccione un archivo de hasta 15 MB.");
    const object = await incorporateDocument({ documentId: id, revisionId, kind: text("kind"), description: text("description"),
      ...(mode === "file" && file instanceof File ? { file: { name: file.name, mime: file.type, bytes: new Uint8Array(await file.arrayBuffer()) } } : { reference: { name: text("referenceName"), url: text("referenceUrl") } }),
      replacesId: text("replacesId"), replacementReason: text("replacementReason"),
    }, principal);
    return Response.json({ id: object.id }, { status: 201, headers });
  } catch (error) {
    const message = error instanceof Error && !error.name.startsWith("Prisma") ? error.message : "No se pudo incorporar el documento; compruebe si ya fue sustituido.";
    return Response.json({ error: message }, { status: 400, headers });
  }
}

export async function POST(...args: Parameters<typeof POSTAuthenticatedContent>) {
  return authorizedRoute("src/app/api/controlled-documents/[id]/revisions/[revisionId]/documents/route.ts", "POST", args, authenticated => POSTAuthenticatedContent(...authenticated as Parameters<typeof POSTAuthenticatedContent>));
}
