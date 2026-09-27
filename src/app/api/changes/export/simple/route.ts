import { getChangeControlExportRows } from "@/modules/change-control/documents/export-data";
import { generateChangeSimpleList } from "@/modules/change-control/documents/xlsx";
export const runtime="nodejs";
export async function GET(request:Request){
  const u=new URL(request.url);
  const rows=await getChangeControlExportRows({
    year:u.searchParams.get("year")??undefined,department:u.searchParams.get("department")??undefined,
    classification:u.searchParams.get("classification")??undefined,status:u.searchParams.get("status")??undefined,
    execution:u.searchParams.get("execution")??undefined,effectiveness:u.searchParams.get("effectiveness")??undefined,
  });
  const buffer=generateChangeSimpleList(rows);
  return new Response(new Uint8Array(buffer),{headers:{
    "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition":'attachment; filename="Listado_Controles_Cambio.xlsx"',"Cache-Control":"no-store",
  }});
}
