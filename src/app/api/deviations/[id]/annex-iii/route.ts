import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDeviationDetail } from "@/modules/deviations/queries";
import { generateAnnexIII } from "@/modules/deviations/documents/annex-iii";
import { TemplateAssetError } from "@/modules/configuration/template-assets";
import { templateUnavailableResponse } from "@/lib/http/template-error-response";
import {
  deviationSnapshotToAnnexRecord,
  recordVersionTemplateId,
  versionLabel,
} from "@/lib/qms/versioning";

export const runtime = "nodejs";

function safe(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const deviation = await getDeviationDetail(id);
  if (!deviation) return NextResponse.json({ error: "Desviación no encontrada." }, { status: 404 });

  const requestedVersion = new URL(request.url).searchParams.get("version");
  const sequenceNumber =
    requestedVersion !== null && /^\\d+$/.test(requestedVersion)
      ? Number(requestedVersion)
      : null;
  const storedVersion =
    sequenceNumber === null
      ? deviation.qmsRecord.versions.at(-1) ?? null
      : deviation.qmsRecord.versions.find((item) => item.sequenceNumber === sequenceNumber) ?? null;

  if (sequenceNumber !== null && !storedVersion) {
    return NextResponse.json({ error: "La versión solicitada no existe." }, { status: 404 });
  }

  type AnnexRecord = Parameters<typeof generateAnnexIII>[0];
  const annexRecord: AnnexRecord = storedVersion
    ? (deviationSnapshotToAnnexRecord(storedVersion.snapshot) as unknown as AnnexRecord)
    : deviation;

  try {
    const buffer = await generateAnnexIII(annexRecord);
    await prisma.generatedDocument.create({
      data: {
        qmsRecordId: deviation.qmsRecordId,
        recordVersionId: storedVersion?.id ?? null,
        documentType: "DEVIATION_ANNEX_III",
        templateVersionId: storedVersion
          ? recordVersionTemplateId("DEVIATION", storedVersion.snapshot)
          : deviation.anexoIIITemplateVersionId,
        generatedByText: process.env.DEFAULT_ACTOR_NAME || deviation.createdByText,
        metadata: {
          source: "download",
          templateVersion:
            annexRecord.anexoIIITemplateVersion?.versionCode ??
            deviation.anexoIIITemplateVersion?.versionCode ??
            "06",
          recordVersion: storedVersion?.sequenceNumber ?? null,
        },
      },
    });
    const suffix = storedVersion ? `_${versionLabel(storedVersion.sequenceNumber)}` : "";
    const filename = `Anexo_III_${safe(deviation.qmsRecord.businessCode || id)}${suffix}.docx`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof TemplateAssetError) {
      return templateUnavailableResponse(error.message);
    }
    throw error;
  }
}
