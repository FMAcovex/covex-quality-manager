import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCapaDetail } from "@/modules/capa/queries";
import { generateCapaAnnexIII } from "@/modules/capa/documents/annex-iii";
import { CapaTemplateUnavailableError } from "@/modules/capa/documents/templates";
import {
  capaSnapshotToAnnexRecord,
  versionLabel,
} from "@/lib/qms/versioning";

export const runtime = "nodejs";

function safe(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const capa = await getCapaDetail(id);
  if (!capa) return NextResponse.json({ error: "CAPA no encontrada." }, { status: 404 });

  const requestedVersion = new URL(request.url).searchParams.get("version");
  const sequenceNumber =
    requestedVersion !== null && /^\\d+$/.test(requestedVersion)
      ? Number(requestedVersion)
      : null;
  const storedVersion =
    sequenceNumber === null
      ? capa.qmsRecord.versions.at(-1) ?? null
      : capa.qmsRecord.versions.find((item) => item.sequenceNumber === sequenceNumber) ?? null;

  if (sequenceNumber !== null && !storedVersion) {
    return NextResponse.json({ error: "La versión solicitada no existe." }, { status: 404 });
  }

  const annexRecord = storedVersion
    ? capaSnapshotToAnnexRecord(storedVersion.snapshot)
    : capa;

  try {
    const buffer = await generateCapaAnnexIII(annexRecord);
    await prisma.generatedDocument.create({
      data: {
        qmsRecordId: capa.qmsRecordId,
        recordVersionId: storedVersion?.id ?? null,
        documentType: "CAPA_ANNEX_III",
        templateVersionId:
          (annexRecord as typeof capa).annexIIITemplateVersionId ??
          capa.annexIIITemplateVersionId,
        generatedByText: process.env.DEFAULT_ACTOR_NAME || capa.createdByText,
        metadata: {
          source: "download",
          templateVersion:
            annexRecord.annexIIITemplateVersion?.versionCode ??
            capa.annexIIITemplateVersion?.versionCode ??
            "05",
          followupVersion: storedVersion?.sequenceNumber ?? null,
          recordVersion: storedVersion?.sequenceNumber ?? null,
        },
      },
    });
    const suffix = storedVersion ? `_${versionLabel(storedVersion.sequenceNumber)}` : "";
    const filename=`Anexo_III_CAPA_${safe(capa.qmsRecord.businessCode || id)}${suffix}.docx`;
    return new Response(new Uint8Array(buffer),{
      headers:{
        "Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition":`attachment; filename="${filename}"`,
        "Cache-Control":"no-store",
      },
    });
  } catch(error) {
    if(error instanceof CapaTemplateUnavailableError) {
      return NextResponse.json({error:error.message},{status:503});
    }
    throw error;
  }
}
