import { NextResponse } from "next/server";
import { generateAnnexV } from "@/modules/deviations/documents/xlsx";
import { prisma } from "@/lib/db";
import { getDeviationExportRows } from "@/modules/deviations/documents/export-data";
import { TemplateUnavailableError } from "@/modules/deviations/documents/templates";

export const runtime = "nodejs";

function body(buffer: Buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year"));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Selecciona un año válido." }, { status: 400 });
  }
  const rows = await getDeviationExportRows({ year: String(year) });
  const templateVersion = await prisma.templateVersion.findFirst({
    where: {
      module: "DEVIATION",
      documentType: "DEVIATION_ANNEX_V",
      isActive: true,
      effectiveFrom: { lte: new Date(`${year}-12-31`) },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date(`${year}-01-01`) } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  try {
    const buffer = await generateAnnexV(year, rows, templateVersion?.versionCode ?? "06");
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Anexo_V_Desviaciones_${year}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof TemplateUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof Error && error.message.includes("admite")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
