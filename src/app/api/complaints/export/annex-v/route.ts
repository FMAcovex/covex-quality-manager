import { NextResponse } from "next/server";
import { getComplaintExportRows } from "@/modules/complaints/documents/export-data";
import { generateComplaintAnnexV } from "@/modules/complaints/documents/docx";
import { ComplaintTemplateUnavailableError } from "@/modules/complaints/documents/templates";
export const runtime="nodejs";
export async function GET(request:Request){const year=Number(new URL(request.url).searchParams.get("year"));if(!Number.isInteger(year)||year<2000||year>2100)return NextResponse.json({error:"Selecciona un año válido."},{status:400});try{const rows=await getComplaintExportRows({year:String(year)});const buffer=await generateComplaintAnnexV(year,rows);return new Response(new Uint8Array(buffer),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":`attachment; filename="Anexo_V_Listado_Reclamaciones_${year}.docx"`,"Cache-Control":"no-store"}});}catch(e){if(e instanceof ComplaintTemplateUnavailableError)return NextResponse.json({error:e.message},{status:503});throw e;}}
