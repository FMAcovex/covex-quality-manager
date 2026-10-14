import { storeWorkingDocument } from "@/lib/qms/working-document";
import { currentIdentity } from "@/lib/auth/context";
import { authorizedRoute } from "@/lib/auth/route-guard";
import { NextResponse } from "next/server";
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

async function GETAuthenticatedContent(request: Request, context: { params: Promise<{ id: string }> }) {
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
    : ({
        ...record,
        finalStatus: record.finalStatus as "OPEN" | "CLOSED",
      } as AnnexRecord);

  try {
    const buffer = await generateChangeAnnexIII(annexRecord);
    await storeWorkingDocument({
      data: {
        qmsRecordId: record.qmsRecordId,
        recordVersionId: storedVersion?.id ?? null,
        documentType: "CHANGE_ANNEX_III",
        templateVersionId: storedVersion
          ? changeControlSnapshotTemplateId(storedVersion.snapshot, "III")
          : record.annexIIITemplateVersionId,
        generatedByText: (currentIdentity()?.principal.name ?? process.env.DEFAULT_ACTOR_NAME) || record.requesterName,
        metadata: {
          source: "download",
          recordVersion: storedVersion?.sequenceNumber ?? null,
        },
      },
    }, buffer);
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

export async function GET(...args: Parameters<typeof GETAuthenticatedContent>) {
  return authorizedRoute("src/app/api/changes/[id]/annex-iii/route.ts", "GET", args, authenticated => GETAuthenticatedContent(...authenticated as Parameters<typeof GETAuthenticatedContent>));
}
