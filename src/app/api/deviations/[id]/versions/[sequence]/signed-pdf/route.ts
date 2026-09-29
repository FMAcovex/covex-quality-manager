import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; sequence: string }> },
) {
  const { id, sequence } = await context.params;
  if (!/^\d+$/.test(sequence)) {
    return NextResponse.json({ error: "Versión no válida." }, { status: 400 });
  }

  const deviation = await prisma.deviation.findUnique({
    where: { id },
    select: { qmsRecordId: true },
  });
  if (!deviation) {
    return NextResponse.json({ error: "Desviación no encontrada." }, { status: 404 });
  }

  const version = await prisma.qmsRecordVersion.findUnique({
    where: {
      qmsRecordId_sequenceNumber: {
        qmsRecordId: deviation.qmsRecordId,
        sequenceNumber: Number(sequence),
      },
    },
    select: {
      sequenceNumber: true,
      documents: {
        where: { kind: "SIGNED_PDF" },
        take: 1,
        select: { fileName: true, fileData: true },
      },
    },
  });
  const document = version?.documents[0];
  if (!version || !document) {
    return NextResponse.json(
      { error: "Esta versión no tiene un PDF firmado cargado." },
      { status: 404 },
    );
  }

  const filename = safeFileName(document.fileName || `Desviacion_V${String(version.sequenceNumber).padStart(2, "0")}_firmada.pdf`);
  return new Response(new Uint8Array(document.fileData), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
