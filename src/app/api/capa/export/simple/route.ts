import { authorizedRoute } from "@/lib/auth/route-guard";
import { getCapaExportRows } from "@/modules/capa/documents/export-data";
import { generateCapaSimpleList } from "@/modules/capa/documents/xlsx";

export const runtime="nodejs";

async function GETAuthenticatedContent(request:Request) {
  const url=new URL(request.url);
  const filters={
    administrative:url.searchParams.get("administrative")??undefined,
    year:url.searchParams.getAll("year"),
    department:url.searchParams.getAll("department"),
    type:url.searchParams.getAll("type"),
    status:url.searchParams.getAll("status"),
    effectiveness:url.searchParams.getAll("effectiveness"),
    origin:url.searchParams.getAll("origin"),
  };
  const rows=await getCapaExportRows(filters);
  const buffer=generateCapaSimpleList(rows);
  return new Response(new Uint8Array(buffer),{
    headers:{
      "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":'attachment; filename="Listado_CAPA.xlsx"',
      "Cache-Control":"no-store",
    },
  });
}

export async function GET(...args: Parameters<typeof GETAuthenticatedContent>) {
  return authorizedRoute("src/app/api/capa/export/simple/route.ts", "GET", args, authenticated => GETAuthenticatedContent(...authenticated as Parameters<typeof GETAuthenticatedContent>));
}
