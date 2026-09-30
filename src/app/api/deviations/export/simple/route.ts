import { generateSimpleList } from "@/modules/deviations/documents/xlsx";
import { getDeviationExportRows } from "@/modules/deviations/documents/export-data";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filters = {
    q: url.searchParams.get("q") || undefined,
    administrative: url.searchParams.get("administrative") || undefined,
    year: url.searchParams.getAll("year"),
    department: url.searchParams.getAll("department"),
    status: url.searchParams.getAll("status"),
    classification: url.searchParams.getAll("classification"),
    provenance: url.searchParams.getAll("provenance"),
    measures: url.searchParams.get("measures") || undefined,
    capa: url.searchParams.get("capa") || undefined,
    deadline: url.searchParams.get("deadline") || undefined,
  };
  const rows = await getDeviationExportRows(filters);
  const buffer = generateSimpleList(rows);
  const year = url.searchParams.get("year");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Listado_desviaciones${year ? `_${year}` : "_filtrado"}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
