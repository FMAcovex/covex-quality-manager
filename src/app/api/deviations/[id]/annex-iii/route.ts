import { storeWorkingDocument } from "@/lib/qms/working-document";
import { currentIdentity } from "@/lib/auth/context";
import { authorizedRoute } from "@/lib/auth/route-guard";
import { NextResponse } from "next/server";
import { parseCapaAnnexVersion } from "@/modules/capa/documents/version-query";
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

async function GETAuthenticatedContent(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const deviation = await getDeviationDetail(id);
  if (!deviation) return NextResponse.json({ error: "Desviación no encontrada." }, { status: 404 });
  if (deviation.status === "DRAFT") {
    return NextResponse.json(
      { error: "El Anexo III no se genera mientras la desviación esté en borrador." },
      { status: 409 },
    );
  }

  // Misma validación que CAPA: una versión mal escrita no descarga en silencio la vigente.
  const parsedVersion = parseCapaAnnexVersion(new URL(request.url).searchParams.get("version"));
  if (!parsedVersion.valid) {
    return NextResponse.json({ error: "La versión solicitada no es válida." }, { status: 400 });
  }
  const sequenceNumber = parsedVersion.sequenceNumber;
  const storedVersion =
    sequenceNumber === null
      ? deviation.qmsRecord.versions.at(-1) ?? null
      : deviation.qmsRecord.versions.find((item) => item.sequenceNumber === sequenceNumber) ?? null;

  if (sequenceNumber !== null && !storedVersion) {
    return NextResponse.json({ error: "La versión solicitada no existe." }, { status: 404 });
  }

  type AnnexRecord = Parameters<typeof generateAnnexIII>[0];
  const recordVersionLabel = versionLabel(storedVersion?.sequenceNumber ?? 0);
  const annexRecord: AnnexRecord = storedVersion
    ? ({
        ...deviationSnapshotToAnnexRecord(storedVersion.snapshot),
        recordVersionLabel,
      } as unknown as AnnexRecord)
    : ({ ...deviation, recordVersionLabel } as AnnexRecord);

  try {
    const buffer = await generateAnnexIII(annexRecord);
    await storeWorkingDocument({
      data: {
        qmsRecordId: deviation.qmsRecordId,
        recordVersionId: storedVersion?.id ?? null,
        documentType: "DEVIATION_ANNEX_III",
        templateVersionId: storedVersion
          ? recordVersionTemplateId("DEVIATION", storedVersion.snapshot)
          : deviation.anexoIIITemplateVersionId,
        generatedByText: (currentIdentity()?.principal.name ?? process.env.DEFAULT_ACTOR_NAME) || deviation.createdByText,
        metadata: {
          source: "download",
          templateVersion:
            annexRecord.anexoIIITemplateVersion?.versionCode ??
            deviation.anexoIIITemplateVersion?.versionCode ??
            "06",
          recordVersion: storedVersion?.sequenceNumber ?? null,
        },
      },
    }, buffer);
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

export async function GET(...args: Parameters<typeof GETAuthenticatedContent>) {
  return authorizedRoute("src/app/api/deviations/[id]/annex-iii/route.ts", "GET", args, authenticated => GETAuthenticatedContent(...authenticated as Parameters<typeof GETAuthenticatedContent>));
}
