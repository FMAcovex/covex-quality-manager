import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getComplaintExportRows } from "@/modules/complaints/documents/export-data";
import { generateComplaintAnnexV as generateComplaintAnnexVDocx } from "@/modules/complaints/documents/docx";
import { generateComplaintAnnexVXlsx } from "@/modules/complaints/documents/xlsx";
import { ComplaintTemplateUnavailableError } from "@/modules/complaints/documents/templates";

export const runtime="nodejs";

export async function GET(request:Request){
 const year=Number(new URL(request.url).searchParams.get("year"));
 if(!Number.isInteger(year)||year<2000||year>2100)return NextResponse.json({error:"Selecciona un año válido."},{status:400});
 try{
  const rows=await getComplaintExportRows({year:String(year)});
  const template=await prisma.templateVersion.findFirst({
   where:{
    module:"COMPLAINT",documentType:"COMPLAINT_ANNEX_V",isActive:true,
    effectiveFrom:{lte:new Date(`${year}-12-31`)},
    OR:[{effectiveTo:null},{effectiveTo:{gte:new Date(`${year}-01-01`)}}],
   },
   orderBy:{effectiveFrom:"desc"},
  });
  const version=template?.versionCode??"02";
  if(version==="03"){
   const buffer=await generateComplaintAnnexVXlsx(year,rows,version);
   return new Response(new Uint8Array(buffer),{headers:{
    "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition":`attachment; filename="Anexo_V_Listado_Reclamaciones_${year}.xlsx"`,
    "Cache-Control":"no-store",
   }});
  }
  const buffer=await generateComplaintAnnexVDocx(year,rows);
  return new Response(new Uint8Array(buffer),{headers:{
   "Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
   "Content-Disposition":`attachment; filename="Anexo_V_Listado_Reclamaciones_${year}.docx"`,
   "Cache-Control":"no-store",
  }});
 }catch(e){
  if(e instanceof ComplaintTemplateUnavailableError)return NextResponse.json({error:e.message},{status:503});
  throw e;
 }
}
