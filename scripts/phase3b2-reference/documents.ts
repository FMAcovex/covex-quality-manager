// Frozen read-only reference: main 6745212383b1ab8def20dca418ee417115036acc.
import "server-only";
import { prisma } from "@/lib/db";
export async function getComplaintDetail(id:string){
 return prisma.complaint.findUnique({where:{id},include:{
  qmsRecord:{include:{
    sourceRelations:{where:{isActive:true},include:{targetRecord:true}},
    targetRelations:{where:{isActive:true},include:{sourceRecord:true}},
    history:{orderBy:{changedAt:"desc"},take:100},
    versions:{orderBy:{sequenceNumber:"asc"},include:{documents:{orderBy:{uploadedAt:"desc"}}}},
    generatedDocuments:{orderBy:{generatedAt:"desc"}}
  }},
  department:true,followups:{orderBy:[{followupDate:"desc"},{createdAt:"desc"}]},
  capaPlans:{orderBy:{createdAt:"asc"},include:{linkedCapaRecord:{include:{capa:true}}}},
  derivedActions:{orderBy:[{sortOrder:"asc"},{createdAt:"asc"}]},
  formVersion:true,annexIIITemplateVersion:true,annexIVTemplateVersion:true,annexVTemplateVersion:true
 }});
}

export async function getReturnDetail(id:string){
 return prisma.returnRecord.findUnique({where:{id},include:{
  qmsRecord:{include:{sourceRelations:{where:{isActive:true},include:{targetRecord:true}},targetRelations:{where:{isActive:true},include:{sourceRecord:true}},history:{orderBy:{changedAt:"desc"},take:100},versions:{orderBy:{sequenceNumber:"asc"},include:{documents:{orderBy:{uploadedAt:"desc"}}}},generatedDocuments:{orderBy:{generatedAt:"desc"},select:{id:true,documentType:true,generatedAt:true,generatedByText:true,fileName:true,checksum:true,mimeType:true}}}},
  department:true,products:{orderBy:[{sortOrder:"asc"},{createdAt:"asc"}],include:{department:true}},
  followups:{orderBy:[{followupDate:"desc"},{createdAt:"desc"},{id:"desc"}]},
  formVersion:true,annexIIITemplateVersion:true,annexIVTemplateVersion:true,annexVTemplateVersion:true,annexVITemplateVersion:true
 }});
}
