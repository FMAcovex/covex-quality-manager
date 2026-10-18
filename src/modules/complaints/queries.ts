import { idsWithAdditionalLot } from "@/lib/qms/additional-lots-search";
import { versionDocumentMetadata, templateMetadata, generatedDocumentMetadata } from "@/lib/qms/document-metadata";
import { withActiveReviewCounts } from "@/lib/qms/review/list-queries";
import "server-only";
import { Prisma, QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { responsibleUserSelect } from "@/lib/qms/responsible-user";
import { complaintListWhere, type ComplaintListFilters } from "@/modules/complaints/list-filters";
export type { ComplaintListFilters } from "@/modules/complaints/list-filters";

export async function getComplaintList(filters:ComplaintListFilters){
 const where=complaintListWhere(filters,new Date(),filters.q?await idsWithAdditionalLot("COMPLAINT",filters.q):[]);
 const pageSize=25;
 const filteredTotal=await prisma.complaint.count({where});
 const pageCount=Math.max(1,Math.ceil(filteredTotal/pageSize));
 const requestedPage=Number(filters.page);
 const page=Number.isSafeInteger(requestedPage)&&requestedPage>0?Math.min(requestedPage,pageCount):1;
 const administrativeWhere:Prisma.ComplaintWhereInput=filters.administrative==="ANNULLED"?{qmsRecord:{isActive:false}}:filters.administrative==="ALL"?{}:{qmsRecord:{isActive:true}};
 const today=new Date();today.setHours(0,0,0,0);

 const [baseRows,departments,years,total,drafts,open,pendingPartII,pendingEfficacy,followupDue]=await Promise.all([
  prisma.complaint.findMany({
   where,
   include:{
    qmsRecord:{include:{
      sourceRelations:{where:{isActive:true},include:{targetRecord:true}},
      targetRelations:{where:{isActive:true},include:{sourceRecord:true}},
      versions:{orderBy:{sequenceNumber:"desc"},take:1,select:{sequenceNumber:true}}
    }},
    department:true,capaPlans:true
   },
   orderBy:[{status:"asc"},{openedAt:"desc"},{createdAt:"desc"},{id:"desc"}],
   skip:(page-1)*pageSize,take:pageSize
  }),
  prisma.department.findMany({where:{isActive:true},orderBy:{code:"asc"}}),
  prisma.qmsRecord.findMany({where:{recordType:QmsRecordType.COMPLAINT,year:{not:null}},select:{year:true},distinct:["year"],orderBy:{year:"desc"}}),
  prisma.complaint.count({where:{AND:[administrativeWhere,{status:{not:"DRAFT"}}]}}),
  prisma.complaint.count({where:{AND:[administrativeWhere,{status:"DRAFT"}]}}),
  prisma.complaint.count({where:{AND:[administrativeWhere,{status:"OPEN"}]}}),
  prisma.complaint.count({where:{AND:[administrativeWhere,{status:"OPEN",partIIRequired:null,conclusion:{not:null}}]}}),
  prisma.complaint.count({where:{AND:[administrativeWhere,{status:"OPEN",partIIRequired:true,effectivenessStatus:"PENDING"}]}}),
  prisma.complaint.count({where:{AND:[administrativeWhere,{status:"OPEN",nextFollowupDate:{lt:today}}]}})
 ]);

 return {rows: await withActiveReviewCounts(baseRows),pagination:{page,pageSize,pageCount,total:filteredTotal},departments,years:years.map(x=>x.year).filter((x):x is number=>x!==null),counters:{
  total,drafts,open,pendingPartII,pendingEfficacy,followupDue
 }};
}

export async function getComplaintDetail(id:string){
 return prisma.complaint.findUnique({where:{id},include:{
  qmsRecord:{include:{
    sourceRelations:{where:{isActive:true},include:{targetRecord:true}},
    targetRelations:{where:{isActive:true},include:{sourceRecord:true}},
    history:{orderBy:{changedAt:"desc"},take:100},
    versions:{orderBy:{sequenceNumber:"asc"},include:{documents:{orderBy:{uploadedAt:"desc"},select:versionDocumentMetadata}}},
    generatedDocuments:{where:{documentType:{not:"RECORD_EVIDENCE"}},orderBy:{generatedAt:"desc"},select:generatedDocumentMetadata}
  }},
  department:true,followups:{orderBy:[{followupDate:"desc"},{createdAt:"desc"}]},
  capaPlans:{orderBy:{createdAt:"asc"},include:{linkedCapaRecord:{include:{capa:true}},responsibleUser:responsibleUserSelect}},
  derivedActions:{orderBy:[{sortOrder:"asc"},{createdAt:"asc"}],include:{responsibleUser:responsibleUserSelect}},
  formVersion:true,annexIIITemplateVersion:{select:templateMetadata},annexIVTemplateVersion:{select:templateMetadata},annexVTemplateVersion:{select:templateMetadata}
 }});
}

export async function getComplaintLookups(){
 const [departments,forms,templates]=await Promise.all([
  prisma.department.findMany({where:{isActive:true},orderBy:{code:"asc"}}),
  prisma.formVersion.findMany({where:{module:"COMPLAINT",isActive:true},orderBy:{effectiveFrom:"desc"}}),
  prisma.templateVersion.findMany({select:templateMetadata,where:{module:"COMPLAINT",isActive:true},orderBy:{effectiveFrom:"desc"}})
 ]);
 return {departments,forms,templates};
}
