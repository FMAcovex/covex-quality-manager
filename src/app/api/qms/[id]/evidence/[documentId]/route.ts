import { contentDisposition } from "@/lib/qms/file-preview";
import { authorizedRoute } from "@/lib/auth/route-guard";
import { getRecordEvidence } from "@/lib/qms/record-evidence";
import { safeSignedPdfFileName } from "@/lib/qms/signed-version-document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function GETAuthenticatedContent(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const { id, documentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) return Response.json({ error: "Evidencia no encontrada." }, { status: 404 });
  const result = await getRecordEvidence(id, documentId);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  const { document } = result;
  return new Response(new Uint8Array(document.fileData), { headers: {
    "Content-Type": document.mimeType ?? "application/octet-stream", "Content-Disposition": contentDisposition(request, safeSignedPdfFileName(document.fileName ?? "evidencia"), document.mimeType),
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Checksum-Sha256": document.checksum,
  } });
}
export async function GET(...args: Parameters<typeof GETAuthenticatedContent>) {
  return authorizedRoute("src/app/api/qms/[id]/evidence/[documentId]/route.ts", "GET", args, authenticated => GETAuthenticatedContent(...authenticated as Parameters<typeof GETAuthenticatedContent>));
}
