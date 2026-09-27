import { getCapaExportRows } from "@/modules/capa/documents/export-data";
import { generateCapaSimpleList } from "@/modules/capa/documents/xlsx";

export const runtime="nodejs";

export async function GET(request:Request) {
  const url=new URL(request.url);
  const filters={
    year:url.searchParams.get("year")??undefined,
    department:url.searchParams.get("department")??undefined,
    type:url.searchParams.get("type")??undefined,
    status:url.searchParams.get("status")??undefined,
    effectiveness:url.searchParams.get("effectiveness")??undefined,
    origin:url.searchParams.get("origin")??undefined,
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
