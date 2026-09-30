import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCapaExportRows } from "@/modules/capa/documents/export-data";
import { generateCapaAnnexIV } from "@/modules/capa/documents/xlsx";
import { TemplateAssetError } from "@/modules/configuration/template-assets";
import { templateUnavailableResponse } from "@/lib/http/template-error-response";

export const runtime="nodejs";

export async function GET(request:Request) {
  const url=new URL(request.url);
  const year=Number(url.searchParams.get("year"));
  if(!Number.isInteger(year)||year<2000||year>2100) {
    return NextResponse.json({error:"Selecciona un año válido."},{status:400});
  }
  const rows=await getCapaExportRows({year:[String(year)]});
  const template=await prisma.templateVersion.findFirst({
    where:{
      module:"CAPA",
      documentType:"CAPA_ANNEX_IV",
      isActive:true,
      effectiveFrom:{lte:new Date(`${year}-12-31`)},
      OR:[{effectiveTo:null},{effectiveTo:{gte:new Date(`${year}-01-01`)}}],
    },
    orderBy:{effectiveFrom:"desc"},
  });
  try {
    const buffer=await generateCapaAnnexIV(year,rows,template?.versionCode??"05");
    return new Response(new Uint8Array(buffer),{
      headers:{
        "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":`attachment; filename="Anexo_IV_CAPA_${year}.xlsx"`,
        "Cache-Control":"no-store",
      },
    });
  } catch(error) {
    if(error instanceof TemplateAssetError) {
      return templateUnavailableResponse(error.message);
    }
    throw error;
  }
}
