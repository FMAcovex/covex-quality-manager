import { contentDisposition } from "@/lib/qms/file-preview";
import { authorizedRoute } from "@/lib/auth/route-guard";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSignedVersionDocumentBySequence,
  parseRecordVersionSequence,
  safeSignedPdfFileName,
} from "@/lib/qms/signed-version-document";

async function GETAuthenticatedContent(
  request: Request,
  context: { params: Promise<{ id: string; sequence: string }> },
) {
  const { id, sequence } = await context.params;
  const sequenceNumber = parseRecordVersionSequence(sequence);
  if (sequenceNumber === null) {
    return NextResponse.json({ error: "Seguimiento no válido." }, { status: 400 });
  }

  const capa = await prisma.capa.findUnique({
    where: { id },
    select: { qmsRecordId: true },
  });
  if (!capa) {
    return NextResponse.json({ error: "CAPA no encontrada." }, { status: 404 });
  }

  const version = await getSignedVersionDocumentBySequence(
    capa.qmsRecordId,
    sequenceNumber,
  );
  const document = version?.documents[0];
  if (!version || !document) {
    return NextResponse.json(
      { error: "Este seguimiento no tiene un PDF firmado cargado." },
      { status: 404 },
    );
  }

  const filename = safeSignedPdfFileName(
    document.fileName ||
      `CAPA_Seguimiento_${String(version.sequenceNumber).padStart(2, "0")}_firmado.pdf`,
  );
  return new Response(new Uint8Array(document.fileData), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition(request, filename, "application/pdf"),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(...args: Parameters<typeof GETAuthenticatedContent>) {
  return authorizedRoute("src/app/api/capa/[id]/versions/[sequence]/signed-pdf/route.ts", "GET", args, authenticated => GETAuthenticatedContent(...authenticated as Parameters<typeof GETAuthenticatedContent>));
}
