import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getReturnDetail } from "@/modules/returns/queries";
import { generateReturnAnnexV } from "@/modules/returns/documents/docx";
import { TemplateAssetError } from "@/modules/configuration/template-assets";
import { templateUnavailableResponse } from "@/lib/http/template-error-response";
export const runtime="nodejs";const safe=(v:string)=>v.replace(/[^a-zA-Z0-9._-]+/g,"_");
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;const r=await getReturnDetail(id);if(!r)return NextResponse.json({error:"Devolución no encontrada."},{status:404});if(r.status==="DRAFT")return NextResponse.json({error:"No se generan documentos oficiales mientras la devolución esté en borrador."},{status:409});try{const buffer=await generateReturnAnnexV(r);const version=r.qmsRecord.versions.at(-1)??null;await prisma.generatedDocument.create({data:{qmsRecordId:r.qmsRecordId,recordVersionId:version?.id??null,documentType:"RETURN_ANNEX_V",templateVersionId:r.annexVTemplateVersionId,generatedByText:process.env.DEFAULT_ACTOR_NAME||r.createdByText,metadata:{source:"download"}}});return new Response(new Uint8Array(buffer),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":`attachment; filename="Anexo_V_Declaracion_Cliente_${safe(r.qmsRecord.businessCode||id)}.docx"`,"Cache-Control":"no-store"}});}catch(e){if(e instanceof TemplateAssetError)return templateUnavailableResponse(e.message);throw e;}}
