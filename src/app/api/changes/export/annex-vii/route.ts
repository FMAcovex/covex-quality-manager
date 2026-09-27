import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getChangeControlExportRows } from "@/modules/change-control/documents/export-data";
import { generateChangeAnnexVII } from "@/modules/change-control/documents/xlsx";
import { ChangeControlTemplateUnavailableError } from "@/modules/change-control/documents/templates";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year"));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Selecciona un año válido." }, { status: 400 });
  }
  const rows = await getChangeControlExportRows({ year: String(year) });
  const template = await prisma.templateVersion.findFirst({
    where: {
      module: "CHANGE_CONTROL",
      documentType: "CHANGE_ANNEX_VII",
      isActive: true,
      effectiveFrom: { lte: new Date(`${year}-12-31`) },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date(`${year}-01-01`) } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  try {
    const buffer = await generateChangeAnnexVII(year, rows, template?.versionCode ?? "03");
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Anexo_VII_Controles_Cambio_${year}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ChangeControlTemplateUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}
