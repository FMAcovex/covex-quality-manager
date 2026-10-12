import { authorizedRoute } from "@/lib/auth/route-guard";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSignedVersionDocumentBySequence,
  parseRecordVersionSequence,
  safeSignedPdfFileName,
} from "@/lib/qms/signed-version-document";

async function GETAuthenticatedContent(
  _request: Request,
  context: { params: Promise<{ id: string; sequence: string }> },
) {
  const { id, sequence } = await context.params;
  const sequenceNumber = parseRecordVersionSequence(sequence);
  if (sequenceNumber === null) {
    return NextResponse.json({ error: "Versión no válida." }, { status: 400 });
  }

  const complaint = await prisma.complaint.findUnique({
    where: { id },
    select: { qmsRecordId: true },
  });
  if (!complaint) {
    return NextResponse.json({ error: "Reclamación no encontrada." }, { status: 404 });
  }

  const version = await getSignedVersionDocumentBySequence(
    complaint.qmsRecordId,
    sequenceNumber,
  );
  const document = version?.documents[0];
  if (!version || !document) {
    return NextResponse.json(
      { error: "Esta versión no tiene un PDF firmado cargado." },
      { status: 404 },
    );
  }

  const filename = safeSignedPdfFileName(
    document.fileName ||
      `Reclamacion_V${String(version.sequenceNumber).padStart(2, "0")}_firmada.pdf`,
  );
  return new Response(new Uint8Array(document.fileData), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(...args: Parameters<typeof GETAuthenticatedContent>) {
  return authorizedRoute("src/app/api/complaints/[id]/versions/[sequence]/signed-pdf/route.ts", "GET", args, authenticated => GETAuthenticatedContent(...authenticated as Parameters<typeof GETAuthenticatedContent>));
}
