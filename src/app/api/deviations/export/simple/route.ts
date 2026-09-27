import { generateSimpleList } from "@/modules/deviations/documents/xlsx";
import { getDeviationExportRows } from "@/modules/deviations/documents/export-data";

export const runtime = "nodejs";

function body(buffer: Buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const names = ["q","year","department","status","classification","provenance","measures","capa","deadline"] as const;
  const filters = Object.fromEntries(names.map((name) => [name, url.searchParams.get(name) || undefined]));
  const rows = await getDeviationExportRows(filters);
  const buffer = generateSimpleList(rows);
  const year = url.searchParams.get("year");
  return new Response(body(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Listado_desviaciones${year ? `_${year}` : "_filtrado"}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
