import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateChangeAnnexV } from "@/modules/change-control/documents/docx";
import { ChangeControlTemplateUnavailableError } from "@/modules/change-control/documents/templates";
import { getChangeControlDetail } from "@/modules/change-control/queries";
import { changeControlSnapshotToRecord } from "@/lib/qms/versioning";

export const runtime="nodejs";
function safe(v:string){return v.replace(/[^a-zA-Z0-9._-]+/g,"_");}
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;const change=await getChangeControlDetail(id);
  if(!change)return NextResponse.json({error:"Control de cambio no encontrado."},{status:404});
  const value=new URL(request.url).searchParams.get("followup");
  if(value===null||!/^\d+$/.test(value))return NextResponse.json({error:"Indica el seguimiento."},{status:400});
  const sequence=Number(value);const followup=change.followups.find((f)=>f.sequenceNumber===sequence);
  if(!followup)return NextResponse.json({error:"Seguimiento no encontrado."},{status:404});
  const version=change.qmsRecord.versions.find((v)=>v.sourceEntityId===followup.id);
  const record=version?changeControlSnapshotToRecord(version.snapshot):change;
  try{
    const buffer=await generateChangeAnnexV(record as unknown as Parameters<typeof generateChangeAnnexV>[0],sequence);
    await prisma.generatedDocument.create({data:{
      qmsRecordId:change.qmsRecordId,recordVersionId:version?.id??null,documentType:"CHANGE_ANNEX_V",
      templateVersionId:change.followupTemplateVersionId,generatedByText:process.env.DEFAULT_ACTOR_NAME||followup.responsibleText,
      metadata:{followupSequence:sequence,templateVersion:change.followupTemplateVersion?.versionCode??"03"},
    }});
    const code=safe(change.qmsRecord.businessCode||id);
    return new Response(new Uint8Array(buffer),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":`attachment; filename="Anexo_V_${code}_Seguimiento_${String(sequence).padStart(2,"0")}.docx"`,"Cache-Control":"no-store"}});
  }catch(error){if(error instanceof ChangeControlTemplateUnavailableError)return NextResponse.json({error:error.message},{status:503});throw error;}
}
