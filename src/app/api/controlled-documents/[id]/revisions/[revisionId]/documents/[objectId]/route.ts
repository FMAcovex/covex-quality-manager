import { authorizedRoute } from "@/lib/auth/route-guard";
import { documentPrincipal } from "@/modules/controlled-documents/documents/access";
import { downloadDocument } from "@/modules/controlled-documents/documents/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function GETAuthenticatedContent(request: Request, { params }: { params: Promise<{ id: string; revisionId: string; objectId: string }> }) {
  try { documentPrincipal(request.headers); } catch { return new Response("No autorizado", { status: 403 }); }
  const { id, revisionId, objectId } = await params;
  try {
    const object = await downloadDocument(id, revisionId, objectId);
    if (!object) return new Response("Documento no encontrado", { status: 404 });
    return new Response(Buffer.from(object.fileData!), { headers: {
      "Content-Type": object.mimeType!, "Content-Length": String(object.sizeBytes),
      "Content-Disposition": `attachment; filename="document-${object.id}.${object.originalName.split(".").pop()?.toLowerCase()}"; filename*=UTF-8''${encodeURIComponent(object.originalName).replace(/'/g, "%27")}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch { return new Response("Documento no disponible", { status: 404 }); }
}

export async function GET(...args: Parameters<typeof GETAuthenticatedContent>) {
  return authorizedRoute("src/app/api/controlled-documents/[id]/revisions/[revisionId]/documents/[objectId]/route.ts", "GET", args, authenticated => GETAuthenticatedContent(...authenticated as Parameters<typeof GETAuthenticatedContent>));
}
