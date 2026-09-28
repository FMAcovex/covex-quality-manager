import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadStoredTemplateAsset,StoredTemplateIntegrityError } from "@/modules/configuration/template-assets";

export const runtime="nodejs";

function safe(value:string){return value.replace(/[^a-zA-Z0-9._-]+/g,"_");}

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const template=await prisma.templateVersion.findUnique({where:{id},select:{module:true,documentType:true,versionCode:true,fileName:true,mimeType:true,filePath:true}});
  if(!template)return NextResponse.json({error:"Plantilla no encontrada."},{status:404});
  try{
    const buffer=await loadStoredTemplateAsset(template.module,template.documentType,template.versionCode);
    if(!buffer)return NextResponse.json({error:"Esta versión no tiene un archivo almacenado o una ruta técnica disponible."},{status:404});
    const filename=safe(template.fileName??`${template.documentType}_${template.versionCode}`);
    return new Response(new Uint8Array(buffer),{headers:{
      "Content-Type":template.mimeType??"application/octet-stream",
      "Content-Disposition":`attachment; filename="${filename}"`,
      "Cache-Control":"no-store",
    }});
  }catch(error){
    if(error instanceof StoredTemplateIntegrityError)return NextResponse.json({error:error.message},{status:409});
    throw error;
  }
}
