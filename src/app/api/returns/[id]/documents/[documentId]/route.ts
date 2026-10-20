import { authorizedRoute } from "@/lib/auth/route-guard";
import {createHash} from "node:crypto";
import {prisma} from "@/lib/db";
import {NextResponse} from "next/server";
import { withBytes } from "@/lib/db-binary-omit";
export const runtime="nodejs";
async function GETAuthenticatedContent(_request:Request,{params}:{params:Promise<{id:string;documentId:string}>}){
 const {id,documentId}=await params;
 const record=await prisma.returnRecord.findUnique({where:{id},select:{qmsRecordId:true}});
 if(!record)return NextResponse.json({error:"Devolución no encontrada."},{status:404});
 const doc=await prisma.generatedDocument.findFirst({where:{id:documentId,qmsRecordId:record.qmsRecordId},omit:withBytes});
 if(!doc?.fileData)return NextResponse.json({error:"El archivo histórico no está disponible."},{status:404});
 if(createHash("sha256").update(doc.fileData).digest("hex")!==doc.checksum)return NextResponse.json({error:"El checksum del archivo no coincide."},{status:409});
 return new Response(new Uint8Array(doc.fileData),{headers:{"Content-Type":doc.mimeType??"application/octet-stream","Content-Disposition":`attachment; filename="${(doc.fileName??documentId).replace(/[^a-zA-Z0-9._-]+/g,"_")}"`,"Cache-Control":"no-store"}});
}

export async function GET(...args: Parameters<typeof GETAuthenticatedContent>) {
  return authorizedRoute("src/app/api/returns/[id]/documents/[documentId]/route.ts", "GET", args, authenticated => GETAuthenticatedContent(...authenticated as Parameters<typeof GETAuthenticatedContent>));
}
