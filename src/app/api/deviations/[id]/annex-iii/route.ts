import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDeviationDetail } from "@/modules/deviations/queries";
import { generateAnnexIII } from "@/modules/deviations/documents/annex-iii";
import { TemplateUnavailableError } from "@/modules/deviations/documents/templates";

export const runtime = "nodejs";

function body(buffer: Buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}
function safe(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const deviation = await getDeviationDetail(id);
  if (!deviation) return NextResponse.json({ error: "Desviación no encontrada." }, { status: 404 });

  try {
    const buffer = await generateAnnexIII(deviation);
    await prisma.generatedDocument.create({
      data: {
        qmsRecordId: deviation.qmsRecordId,
        documentType: "DEVIATION_ANNEX_III",
        templateVersionId: deviation.anexoIIITemplateVersionId,
        generatedByText: process.env.DEFAULT_ACTOR_NAME || deviation.createdByText,
        metadata: { source: "download", templateVersion: deviation.anexoIIITemplateVersion?.versionCode ?? "06" },
      },
    });
    const filename = `Anexo_III_${safe(deviation.qmsRecord.businessCode || id)}.docx`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof TemplateUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}
