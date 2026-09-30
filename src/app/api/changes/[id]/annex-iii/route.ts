import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getChangeControlDetail } from "@/modules/change-control/queries";
import { generateChangeAnnexIII } from "@/modules/change-control/documents/annex-iii";
import { TemplateAssetError } from "@/modules/configuration/template-assets";
import { templateUnavailableResponse } from "@/lib/http/template-error-response";
import {
  changeControlSnapshotTemplateId,
  changeControlSnapshotToRecord,
  versionLabel,
} from "@/lib/qms/versioning";

export const runtime = "nodejs";

function safe(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const record = await getChangeControlDetail(id);
  if (!record) return NextResponse.json({ error: "Control de Cambio no encontrado." }, { status: 404 });
  if (record.finalStatus === "DRAFT") {
    return NextResponse.json(
      { error: "Los documentos oficiales no se generan mientras el Control de Cambio esté en borrador." },
      { status: 409 },
    );
  }

  const requestedVersion = new URL(request.url).searchParams.get("version");
  const sequenceNumber =
    requestedVersion !== null && /^\d+$/.test(requestedVersion)
      ? Number(requestedVersion)
      : null;
  const storedVersion =
    sequenceNumber === null
      ? null
      : record.qmsRecord.versions.find((item) => item.sequenceNumber === sequenceNumber) ?? null;

  if (sequenceNumber !== null && !storedVersion) {
    return NextResponse.json({ error: "La versión solicitada no existe." }, { status: 404 });
  }

  type AnnexRecord = Parameters<typeof generateChangeAnnexIII>[0];
  const annexRecord: AnnexRecord = storedVersion
    ? (changeControlSnapshotToRecord(storedVersion.snapshot) as unknown as AnnexRecord)
    : record;

  try {
    const buffer = await generateChangeAnnexIII(annexRecord);
    await prisma.generatedDocument.create({
      data: {
        qmsRecordId: record.qmsRecordId,
        recordVersionId: storedVersion?.id ?? null,
        documentType: "CHANGE_ANNEX_III",
        templateVersionId: storedVersion
          ? changeControlSnapshotTemplateId(storedVersion.snapshot, "III")
          : record.annexIIITemplateVersionId,
        generatedByText: process.env.DEFAULT_ACTOR_NAME || record.requesterName,
        metadata: {
          source: "download",
          recordVersion: storedVersion?.sequenceNumber ?? null,
        },
      },
    });
    const suffix = storedVersion ? `_${versionLabel(storedVersion.sequenceNumber)}` : "";
    const filename = `Anexo_III_CC_${safe(record.qmsRecord.businessCode || id)}${suffix}.docx`;
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
