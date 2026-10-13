import { createHash } from "node:crypto";
import { authorizedRoute } from "@/lib/auth/route-guard";
import { prisma } from "@/lib/db";
import { safeSignedPdfFileName } from "@/lib/qms/signed-version-document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function GETAuthenticatedContent(_request: Request, { params }: { params: Promise<{ id: string; custodyId: string }> }) {
  const { id, custodyId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(custodyId)) return Response.json({ error: "Original documental no encontrado." }, { status: 404 });
  const custody = await prisma.signedDocumentCustody.findFirst({ where: { id: custodyId, recordVersion: { qmsRecordId: id } },
    select: { originalDocument: { select: { id: true, fileData: true, fileName: true, mimeType: true, checksum: true } } } });
  const original = custody?.originalDocument;
  if (!original?.fileData) return Response.json({ error: "Original documental no encontrado." }, { status: 404 });
  if (createHash("sha256").update(original.fileData).digest("hex") !== original.checksum) return Response.json({ error: "No se ha podido verificar la integridad del original." }, { status: 409 });
  return new Response(new Uint8Array(original.fileData), { headers: {
    "Content-Type": original.mimeType ?? "application/pdf", "Content-Disposition": `attachment; filename="${safeSignedPdfFileName(original.fileName ?? "original.pdf")}"`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Covex-Original-Id": original.id, "X-Checksum-Sha256": original.checksum!,
  } });
}
export async function GET(...args: Parameters<typeof GETAuthenticatedContent>) {
  return authorizedRoute("src/app/api/qms/[id]/document-originals/[custodyId]/route.ts", "GET", args, authenticated => GETAuthenticatedContent(...authenticated as Parameters<typeof GETAuthenticatedContent>));
}
