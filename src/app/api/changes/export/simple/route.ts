import { getChangeControlExportRows } from "@/modules/change-control/documents/export-data";
import { generateChangeSimpleList } from "@/modules/change-control/documents/xlsx";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filters = {
    q: url.searchParams.get("q") ?? undefined,
    administrative: url.searchParams.get("administrative") ?? undefined,
    year: url.searchParams.get("year") ?? undefined,
    department: url.searchParams.get("department") ?? undefined,
    classification: url.searchParams.get("classification") ?? undefined,
    execution: url.searchParams.get("execution") ?? undefined,
    effectiveness: url.searchParams.get("effectiveness") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  };
  const rows = await getChangeControlExportRows(filters);
  const buffer = generateChangeSimpleList(rows);
  const year = url.searchParams.get("year");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Listado_Controles_Cambio${year ? `_${year}` : "_filtrado"}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
