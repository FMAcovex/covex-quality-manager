import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getComplaintDetail } from "@/modules/complaints/queries";
import { generateComplaintAnnexIV } from "@/modules/complaints/documents/docx";
import { TemplateAssetError } from "@/modules/configuration/template-assets";
import { templateUnavailableResponse } from "@/lib/http/template-error-response";
import { complaintSnapshotToAnnexRecord, versionLabel } from "@/lib/qms/versioning";
export const runtime="nodejs";
const safe=(v:string)=>v.replace(/[^a-zA-Z0-9._-]+/g,"_");
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params, r=await getComplaintDetail(id);
 if(!r)return NextResponse.json({error:"Reclamación no encontrada."},{status:404});
 if(r.status==="DRAFT")return NextResponse.json({error:"Los documentos oficiales no se generan mientras la reclamación esté en borrador."},{status:409});
 const requested=new URL(request.url).searchParams.get("version");
 if(requested!==null&&!/^\d+$/.test(requested))return NextResponse.json({error:"Versión no válida."},{status:400});
 const version=requested===null?r.qmsRecord.versions.at(-1)??null:r.qmsRecord.versions.find(v=>v.sequenceNumber===Number(requested))??null;
 if(requested!==null&&!version)return NextResponse.json({error:"La versión solicitada no existe."},{status:404});
 const recordVersionLabel=versionLabel(version?.sequenceNumber??0);
 type AnnexRecord=Parameters<typeof generateComplaintAnnexIV>[0];
 const source=(version?{...complaintSnapshotToAnnexRecord(version.snapshot),recordVersionLabel}:{...r,recordVersionLabel}) as unknown as AnnexRecord;
 try{
  const buffer=await generateComplaintAnnexIV(source);
  const sourceTemplateId=version?(version.snapshot as {complaint?:{annexIVTemplateVersionId?:string|null}}).complaint?.annexIVTemplateVersionId:r.annexIVTemplateVersionId;
  await prisma.generatedDocument.create({data:{qmsRecordId:r.qmsRecordId,recordVersionId:version?.id??null,documentType:"COMPLAINT_ANNEX_IV",templateVersionId:sourceTemplateId??null,generatedByText:process.env.DEFAULT_ACTOR_NAME||r.createdByText,metadata:{source:"download",recordVersion:version?.sequenceNumber??null}}});
  return new Response(new Uint8Array(buffer),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":`attachment; filename="Anexo_IV_Respuesta_Reclamacion_${safe(r.qmsRecord.businessCode||id)}_${recordVersionLabel}.docx"`,"Cache-Control":"no-store"}});
 }catch(e){if(e instanceof TemplateAssetError)return templateUnavailableResponse(e.message);throw e;}
}
