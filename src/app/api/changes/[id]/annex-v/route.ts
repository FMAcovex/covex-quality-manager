import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getChangeControlDetail } from "@/modules/change-control/queries";
import { generateChangeAnnexV } from "@/modules/change-control/documents/annex-v";
import { ChangeControlTemplateUnavailableError } from "@/modules/change-control/documents/templates";
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

  const requestedVersion = new URL(request.url).searchParams.get("version");
  const sequenceNumber =
    requestedVersion !== null && /^\d+$/.test(requestedVersion)
      ? Number(requestedVersion)
      : record.qmsRecord.versions.at(-1)?.sequenceNumber ?? null;

  if (sequenceNumber === null) {
    return NextResponse.json({ error: "El Control de Cambio todavía no tiene seguimientos." }, { status: 409 });
  }

  const storedVersion =
    record.qmsRecord.versions.find((item) => item.sequenceNumber === sequenceNumber) ?? null;
  if (!storedVersion) {
    return NextResponse.json({ error: "La versión solicitada no existe." }, { status: 404 });
  }

  type AnnexRecord = Parameters<typeof generateChangeAnnexV>[0];
  const annexRecord = changeControlSnapshotToRecord(storedVersion.snapshot) as unknown as AnnexRecord;

  try {
    const buffer = await generateChangeAnnexV(annexRecord, sequenceNumber);
    await prisma.generatedDocument.create({
      data: {
        qmsRecordId: record.qmsRecordId,
        recordVersionId: storedVersion.id,
        documentType: "CHANGE_ANNEX_V",
        templateVersionId: changeControlSnapshotTemplateId(storedVersion.snapshot, "V"),
        generatedByText: process.env.DEFAULT_ACTOR_NAME || record.requesterName,
        metadata: {
          source: "download",
          recordVersion: sequenceNumber,
          followupVersion: sequenceNumber,
        },
      },
    });
    const filename = `Anexo_V_CC_${safe(record.qmsRecord.businessCode || id)}_${versionLabel(sequenceNumber)}.docx`;
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
