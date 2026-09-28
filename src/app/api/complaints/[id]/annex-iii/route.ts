import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getComplaintDetail } from "@/modules/complaints/queries";
import { generateComplaintAnnexIII } from "@/modules/complaints/documents/docx";
import { TemplateAssetError } from "@/modules/configuration/template-assets";
import { templateUnavailableResponse } from "@/lib/http/template-error-response";
export const runtime="nodejs";
const safe=(v:string)=>v.replace(/[^a-zA-Z0-9._-]+/g,"_");
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;const r=await getComplaintDetail(id);if(!r)return NextResponse.json({error:"Reclamación no encontrada."},{status:404});
 try{const buffer=await generateComplaintAnnexIII(r);const version=r.qmsRecord.versions.at(-1)??null;await prisma.generatedDocument.create({data:{qmsRecordId:r.qmsRecordId,recordVersionId:version?.id??null,documentType:"COMPLAINT_ANNEX_III",templateVersionId:r.annexIIITemplateVersionId,generatedByText:process.env.DEFAULT_ACTOR_NAME||r.createdByText,metadata:{source:"download",templateVersion:r.annexIIITemplateVersion?.versionCode??"02"}}});return new Response(new Uint8Array(buffer),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":`attachment; filename="Anexo_III_Reclamacion_${safe(r.qmsRecord.businessCode||id)}.docx"`,"Cache-Control":"no-store"}});}catch(e){if(e instanceof TemplateAssetError)return templateUnavailableResponse(e.message);throw e;}}
