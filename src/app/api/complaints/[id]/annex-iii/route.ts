import { currentIdentity } from "@/lib/auth/context";
import { authorizedRoute } from "@/lib/auth/route-guard";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getComplaintDetail } from "@/modules/complaints/queries";
import { generateComplaintAnnexIII } from "@/modules/complaints/documents/docx";
import { TemplateAssetError } from "@/modules/configuration/template-assets";
import { templateUnavailableResponse } from "@/lib/http/template-error-response";
import {
  complaintSnapshotToAnnexRecord,
  recordVersionTemplateId,
  versionLabel,
} from "@/lib/qms/versioning";

export const runtime="nodejs";
const safe=(v:string)=>v.replace(/[^a-zA-Z0-9._-]+/g,"_");

async function GETAuthenticatedContent(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const r=await getComplaintDetail(id);
 if(!r)return NextResponse.json({error:"Reclamación no encontrada."},{status:404});
 if(r.status==="DRAFT")return NextResponse.json({error:"Los documentos oficiales no se generan mientras la reclamación esté en borrador."},{status:409});

 const requestedVersion=new URL(request.url).searchParams.get("version");
 if(requestedVersion!==null&&(!/^\d+$/.test(requestedVersion)||!Number.isSafeInteger(Number(requestedVersion))))return NextResponse.json({error:"Versión no válida."},{status:400});
 const sequenceNumber=requestedVersion!==null&&/^\d+$/.test(requestedVersion)?Number(requestedVersion):null;
 const storedVersion=sequenceNumber===null?r.qmsRecord.versions.at(-1)??null:r.qmsRecord.versions.find(item=>item.sequenceNumber===sequenceNumber)??null;
 if(sequenceNumber!==null&&!storedVersion){
  return NextResponse.json({error:"La versión solicitada no existe."},{status:404});
 }

 type AnnexRecord=Parameters<typeof generateComplaintAnnexIII>[0];
 const recordVersionLabel=versionLabel(storedVersion?.sequenceNumber??0);
 const annexRecord:AnnexRecord=storedVersion
  ? ({...complaintSnapshotToAnnexRecord(storedVersion.snapshot),recordVersionLabel} as unknown as AnnexRecord)
  : ({...r,recordVersionLabel} as AnnexRecord);

 try{
  const buffer=await generateComplaintAnnexIII(annexRecord);
  await prisma.generatedDocument.create({data:{
   qmsRecordId:r.qmsRecordId,
   recordVersionId:storedVersion?.id??null,
   documentType:"COMPLAINT_ANNEX_III",
   templateVersionId:storedVersion?recordVersionTemplateId("COMPLAINT",storedVersion.snapshot):r.annexIIITemplateVersionId,
   generatedByText:(currentIdentity()?.principal.name ?? process.env.DEFAULT_ACTOR_NAME)||r.createdByText,
   metadata:{
    source:"download",
    templateVersion:annexRecord.annexIIITemplateVersion?.versionCode??r.annexIIITemplateVersion?.versionCode??"03",
    recordVersion:storedVersion?.sequenceNumber??null
   }
  }});
  const suffix=storedVersion?`_${versionLabel(storedVersion.sequenceNumber)}`:"";
  return new Response(new Uint8Array(buffer),{headers:{
   "Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
   "Content-Disposition":`attachment; filename="Anexo_III_Reclamacion_${safe(r.qmsRecord.businessCode||id)}${suffix}.docx"`,
   "Cache-Control":"no-store"
  }});
 }catch(e){
  if(e instanceof TemplateAssetError)return templateUnavailableResponse(e.message);
  throw e;
 }
}

export async function GET(...args: Parameters<typeof GETAuthenticatedContent>) {
  return authorizedRoute("src/app/api/complaints/[id]/annex-iii/route.ts", "GET", args, authenticated => GETAuthenticatedContent(...authenticated as Parameters<typeof GETAuthenticatedContent>));
}
