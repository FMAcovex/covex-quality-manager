import { NextResponse } from "next/server";
import { RecordVersionDocumentKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { safeSignedPdfFileName } from "@/lib/qms/signed-version-document";

const annexConfig = {
  "annex-iii": {
    kind: RecordVersionDocumentKind.RETURN_ANNEX_III_SIGNED,
    fallback: "Anexo_III_Devolucion_firmado.pdf",
  },
  "annex-v": {
    kind: RecordVersionDocumentKind.RETURN_ANNEX_V_SIGNED,
    fallback: "Anexo_V_Devolucion_firmado.pdf",
  },
} as const;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; annex: string }> },
) {
  const { id, annex } = await context.params;
  if (!(annex in annexConfig)) {
    return NextResponse.json({ error: "Anexo no válido." }, { status: 400 });
  }
  const cfg = annexConfig[annex as keyof typeof annexConfig];

  const record = await prisma.returnRecord.findUnique({
    where: { id },
    select: {
      qmsRecord: {
        select: {
          versions: {
            orderBy: { sequenceNumber: "desc" },
            take: 1,
            select: {
              documents: {
                where: { kind: cfg.kind },
                take: 1,
                select: { fileName: true, fileData: true },
              },
            },
          },
        },
      },
    },
  });
  if (!record) {
    return NextResponse.json({ error: "Devolución no encontrada." }, { status: 404 });
  }

  const document = record.qmsRecord.versions[0]?.documents[0];
  if (!document) {
    return NextResponse.json(
      { error: "No hay un PDF firmado cargado para este anexo." },
      { status: 404 },
    );
  }

  const filename = safeSignedPdfFileName(document.fileName || cfg.fallback);
  return new Response(new Uint8Array(document.fileData), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
