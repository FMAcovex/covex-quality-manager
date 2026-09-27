import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeZip } from "@/lib/ooxml/zip";
import { generateChangeAnnexIII,generateChangeAnnexIV } from "@/modules/change-control/documents/docx";
import { ChangeControlTemplateUnavailableError } from "@/modules/change-control/documents/templates";
import { getChangeControlDetail } from "@/modules/change-control/queries";

export const runtime="nodejs";
function safe(v:string){return v.replace(/[^a-zA-Z0-9._-]+/g,"_");}
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;const change=await getChangeControlDetail(id);
  if(!change)return NextResponse.json({error:"Control de cambio no encontrado."},{status:404});
  try{
    const [iii,iv]=await Promise.all([generateChangeAnnexIII(change),generateChangeAnnexIV(change)]);
    await prisma.generatedDocument.createMany({data:[
      {qmsRecordId:change.qmsRecordId,documentType:"CHANGE_ANNEX_III_IV",templateVersionId:change.requestDecisionTemplateVersionId,generatedByText:process.env.DEFAULT_ACTOR_NAME||change.requesterName,metadata:{annex:"III",templateVersion:change.requestDecisionTemplateVersion?.versionCode??"03"}},
      {qmsRecordId:change.qmsRecordId,documentType:"CHANGE_ANNEX_III_IV",templateVersionId:change.requestDecisionTemplateVersionId,generatedByText:process.env.DEFAULT_ACTOR_NAME||change.requesterName,metadata:{annex:"IV",templateVersion:change.requestDecisionTemplateVersion?.versionCode??"03"}},
    ]});
    const code=safe(change.qmsRecord.businessCode||id);
    const zip=writeZip([{name:`Anexo_III_Solicitud_${code}.docx`,data:iii},{name:`Anexo_IV_Dictamen_${code}.docx`,data:iv}]);
    return new Response(new Uint8Array(zip),{headers:{"Content-Type":"application/zip","Content-Disposition":`attachment; filename="Solicitud_Dictamen_${code}.zip"`,"Cache-Control":"no-store"}});
  }catch(error){if(error instanceof ChangeControlTemplateUnavailableError)return NextResponse.json({error:error.message},{status:503});throw error;}
}
