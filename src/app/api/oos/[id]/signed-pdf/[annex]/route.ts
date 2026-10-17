import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizedRoute } from "@/lib/auth/route-guard";
import { prisma } from "@/lib/db";
import { safeSignedPdfFileName } from "@/lib/qms/signed-version-document";
import { oosSignedAnnexes } from "@/modules/oos/signed-documents";

export const runtime = "nodejs";

/** Descarga el PDF firmado vigente del Anexo III o IV, verificando su SHA-256 (D-088, OOS-4). */
async function GETAuthenticatedContent(_request: Request, context: { params: Promise<{ id: string; annex: string }> }) {
  const { id, annex } = await context.params;
  if (!(annex in oosSignedAnnexes)) return NextResponse.json({ error: "Anexo no válido." }, { status: 400 });
  const config = oosSignedAnnexes[annex as keyof typeof oosSignedAnnexes];
  const record = await prisma.oosRecord.findUnique({ where: { id }, select: { qmsRecord: { select: { versions: { orderBy: { sequenceNumber: "desc" }, take: 1, select: { documents: { where: { kind: config.kind }, take: 1, select: { fileName: true, fileData: true, checksum: true } } } } } } } });
  if (!record) return NextResponse.json({ error: "OOS no encontrado." }, { status: 404 });
  const document = record.qmsRecord.versions[0]?.documents[0];
  if (!document) return NextResponse.json({ error: "No hay un PDF firmado cargado para este anexo." }, { status: 404 });
  if (createHash("sha256").update(document.fileData).digest("hex") !== document.checksum) return NextResponse.json({ error: "El checksum del PDF firmado no coincide." }, { status: 409 });
  return new Response(new Uint8Array(document.fileData), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${safeSignedPdfFileName(document.fileName || config.fallback)}"`, "Cache-Control": "no-store" } });
}

export async function GET(...args: Parameters<typeof GETAuthenticatedContent>) {
  return authorizedRoute("src/app/api/oos/[id]/signed-pdf/[annex]/route.ts", "GET", args, (authenticated) => GETAuthenticatedContent(...(authenticated as Parameters<typeof GETAuthenticatedContent>)));
}
