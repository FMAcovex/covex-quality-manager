import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCapaDetail } from "@/modules/capa/queries";
import { generateCapaAnnexIII } from "@/modules/capa/documents/annex-iii";
import { parseCapaAnnexVersion } from "@/modules/capa/documents/version-query";
import { TemplateAssetError } from "@/modules/configuration/template-assets";
import { templateUnavailableResponse } from "@/lib/http/template-error-response";
import {
  capaSnapshotToAnnexRecord,
  capaSnapshotVersionFollowupDate,
  recordVersionTemplateId,
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
  if (capa.status === "DRAFT") {
    return NextResponse.json(
      { error: "El Anexo III no se genera mientras la CAPA esté en borrador." },
      { status: 409 },
    );
  }

  const requestedVersion = new URL(request.url).searchParams.get("version");
  const parsedVersion = parseCapaAnnexVersion(requestedVersion);
  if (!parsedVersion.valid) {
    return NextResponse.json({ error: "La versión solicitada no es válida." }, { status: 400 });
  }
  const sequenceNumber = parsedVersion.sequenceNumber;
  const storedVersion =
    sequenceNumber === null
      ? capa.qmsRecord.versions.at(-1) ?? null
      : capa.qmsRecord.versions.find((item) => item.sequenceNumber === sequenceNumber) ?? null;

  if (sequenceNumber !== null && !storedVersion) {
    return NextResponse.json({ error: "La versión solicitada no existe." }, { status: 404 });
  }

  type AnnexRecord = Parameters<typeof generateCapaAnnexIII>[0];
  const snapshotRecord = storedVersion
    ? capaSnapshotToAnnexRecord(storedVersion.snapshot)
    : capa;
  const annexRecord: AnnexRecord = {
    ...(snapshotRecord as unknown as AnnexRecord),
    recordVersionSequenceNumber: storedVersion?.sequenceNumber ?? 0,
    recordVersionReason: storedVersion?.reason ?? null,
    versionFollowupDate: storedVersion
      ? capaSnapshotVersionFollowupDate(
          storedVersion.snapshot,
          storedVersion.sequenceNumber,
        )
      : capa.openedAt,
  };

  try {
    const buffer = await generateCapaAnnexIII(annexRecord);
    await prisma.generatedDocument.create({
      data: {
        qmsRecordId: capa.qmsRecordId,
        recordVersionId: storedVersion?.id ?? null,
        documentType: "CAPA_ANNEX_III",
        templateVersionId: storedVersion
          ? recordVersionTemplateId("CAPA", storedVersion.snapshot)
          : capa.annexIIITemplateVersionId,
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
    if(error instanceof TemplateAssetError) {
      return templateUnavailableResponse(error.message);
    }
    throw error;
  }
}
