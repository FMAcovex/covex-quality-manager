import { NextResponse } from "next/server";
import { getChangeControlExportRows } from "@/modules/change-control/documents/export-data";
import { generateChangeAnnexVII } from "@/modules/change-control/documents/xlsx";

export const runtime="nodejs";
export async function GET(request:Request){
  const year=Number(new URL(request.url).searchParams.get("year"));
  if(!Number.isInteger(year)||year<2000||year>2100) return NextResponse.json({error:"Selecciona un año válido."},{status:400});
  const rows=await getChangeControlExportRows({year:String(year)});
  const buffer=generateChangeAnnexVII(year,rows);
  return new Response(new Uint8Array(buffer),{headers:{
    "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition":`attachment; filename="Anexo_VII_Controles_Cambio_${year}.xlsx"`,
    "Cache-Control":"no-store",
  }});
}
