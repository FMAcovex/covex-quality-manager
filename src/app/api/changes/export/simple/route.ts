import { authorizedRoute } from "@/lib/auth/route-guard";
import { getChangeControlExportRows } from "@/modules/change-control/documents/export-data";
import { generateChangeSimpleList } from "@/modules/change-control/documents/xlsx";

export const runtime = "nodejs";

async function GETAuthenticatedContent(request: Request) {
  const url = new URL(request.url);
  const filters = {
    q: url.searchParams.get("q") ?? undefined,
    administrative: url.searchParams.get("administrative") ?? undefined,
    year: url.searchParams.getAll("year"),
    department: url.searchParams.getAll("department"),
    classification: url.searchParams.getAll("classification"),
    execution: url.searchParams.getAll("execution"),
    effectiveness: url.searchParams.getAll("effectiveness"),
    status: url.searchParams.getAll("status"),
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

export async function GET(...args: Parameters<typeof GETAuthenticatedContent>) {
  return authorizedRoute("src/app/api/changes/export/simple/route.ts", "GET", args, authenticated => GETAuthenticatedContent(...authenticated as Parameters<typeof GETAuthenticatedContent>));
}
