import { NextResponse } from "next/server";
import { DocumentType } from "@prisma/client";
import { generateAuditDocument, getAuditDocument } from "@/modules/audits/documents/service";
export const runtime = 'nodejs';
export async function GET(request: Request, context: {params:Promise<{id:string}>}) {
  const {id}=await context.params, q=new URL(request.url).searchParams;
  try {
    const version=q.get('version');if(version!==null&&!/^\d+$/.test(version))return NextResponse.json({error:'Versión no válida.'},{status:400});
    const d=q.get('document') ? await getAuditDocument(id,q.get('document')!,q.get('signed')==='1') : await generateAuditDocument(id,q.get('type') as DocumentType,version===null?null:Number(version),process.env.DEFAULT_ACTOR_NAME||'Usuario demo');
    return new NextResponse(new Uint8Array(d.fileData!),{headers:{'Content-Type':d.mimeType ?? 'application/octet-stream','Content-Disposition':`attachment; filename="${d.fileName}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  } catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Documento no disponible.'},{status:409});}
}
