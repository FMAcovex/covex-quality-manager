import { NextResponse } from "next/server";
import { getReturnExportRows } from "@/modules/returns/documents/export-data";
import { generateReturnAnnexVI } from "@/modules/returns/documents/xlsx";
import { ReturnTemplateUnavailableError } from "@/modules/returns/documents/templates";
export const runtime="nodejs";
export async function GET(request:Request){
 const year=Number(new URL(request.url).searchParams.get("year"));
 if(!Number.isInteger(year)||year<2000||year>2100)return NextResponse.json({error:"Selecciona un año válido."},{status:400});
 try{
  const rows=await getReturnExportRows({year:String(year)});
  const buffer=await generateReturnAnnexVI(year,rows);
  return new Response(new Uint8Array(buffer),{headers:{
   "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
   "Content-Disposition":`attachment; filename="Anexo_VI_Listado_Devoluciones_${year}.xlsx"`,
   "Cache-Control":"no-store"
  }});
 }catch(e){
  if(e instanceof ReturnTemplateUnavailableError)return NextResponse.json({error:e.message},{status:503});
  throw e;
 }
}
