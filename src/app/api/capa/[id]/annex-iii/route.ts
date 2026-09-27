import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCapaDetail } from "@/modules/capa/queries";
import { generateCapaAnnexIII } from "@/modules/capa/documents/annex-iii";
import { CapaTemplateUnavailableError } from "@/modules/capa/documents/templates";

export const runtime = "nodejs";

function safe(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const capa = await getCapaDetail(id);
  if (!capa) return NextResponse.json({ error: "CAPA no encontrada." }, { status: 404 });
  try {
    const buffer = await generateCapaAnnexIII(capa);
    await prisma.generatedDocument.create({
      data: {
        qmsRecordId: capa.qmsRecordId,
        documentType: "CAPA_ANNEX_III",
        templateVersionId: capa.annexIIITemplateVersionId,
        generatedByText: process.env.DEFAULT_ACTOR_NAME || capa.createdByText,
        metadata: {
          source: "download",
          templateVersion: capa.annexIIITemplateVersion?.versionCode ?? "05",
          followupVersion: capa.followups[0]?.sequenceNumber ?? 0,
        },
      },
    });
    const filename=`Anexo_III_CAPA_${safe(capa.qmsRecord.businessCode || id)}.docx`;
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
