import { prisma } from "@/lib/db";
import { currentIdentity } from "@/lib/auth/context";
import { assertPermission } from "@/lib/auth/policy";
import { authorizedRoute } from "@/lib/auth/route-guard";

async function GETAuthenticatedContent(_request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const item=await prisma.auditTrailExport.findUnique({where:{id},select:{fileName:true,fileData:true,contentSha256:true,scopeManifest:true,rowCount:true,createdAt:true}});
  if(!item)return Response.json({error:"Exportación no encontrada."},{status:404});
  const manifest=item.scopeManifest as {filters?:{sensitive?:boolean}};
  if(manifest.filters?.sensitive)assertPermission(currentIdentity()!.principal,"SYSTEM","AUDIT_TRAIL_SENSITIVE_READ");
  return new Response(new Uint8Array(item.fileData),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${item.fileName}"`,"Cache-Control":"private, no-store","X-COVEX-Audit-Export-Id":id,"X-COVEX-Content-SHA256":item.contentSha256,"X-COVEX-Event-Count":String(item.rowCount)}});
}

export async function GET(...args:Parameters<typeof GETAuthenticatedContent>){
  return authorizedRoute("src/app/api/audit-trail/exports/[id]/route.ts","GET",args,authenticated=>GETAuthenticatedContent(...authenticated as Parameters<typeof GETAuthenticatedContent>));
}
