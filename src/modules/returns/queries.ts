import { versionDocumentMetadata, templateMetadata } from "@/lib/qms/document-metadata";
import { reviewListWhere } from "@/lib/qms/review/list-domain";
import { withActiveReviewCounts } from "@/lib/qms/review/list-queries";
import "server-only";
import { Prisma,QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { validValues, validYears } from "@/lib/qms/list-filters";
import { RETURN_DEPARTMENT_CODES } from "@/modules/returns/departments";

export type ReturnListFilters={page?:string;followup?:string;complaint?:string;review?:string;q?:string;administrative?:string;year?:string[];department?:string[];type?:string[];status?:string[];decision?:string[]};

export async function getReturnList(filters:ReturnListFilters){
 const where=await returnListWhere(filters);
 const requestedPage=Number(filters.page)||1;const pageSize=25;
 const count=await prisma.returnRecord.count({where});
 const page=Math.min(Math.max(1,Math.trunc(requestedPage)),Math.max(1,Math.ceil(count/pageSize)));
 const administrativeWhere:Prisma.ReturnRecordWhereInput=filters.administrative==="ANNULLED"?{qmsRecord:{isActive:false}}:filters.administrative==="ALL"?{}:{qmsRecord:{isActive:true}};
 const [rows,departments,years,total,drafts,open,pending,followupDue]=await Promise.all([
  prisma.returnRecord.findMany({where,include:{qmsRecord:{include:{sourceRelations:{where:{isActive:true},include:{targetRecord:true}},targetRelations:{where:{isActive:true},include:{sourceRecord:true}}}},department:true,products:{orderBy:{sortOrder:"asc"}},followups:{orderBy:[{followupDate:"desc"},{createdAt:"desc"},{id:"desc"}],take:1}},orderBy:[{status:"asc"},{communicationDate:"desc"},{createdAt:"desc"},{id:"asc"}],skip:(page-1)*pageSize,take:pageSize}),
  prisma.department.findMany({where:{isActive:true,code:{in:[...RETURN_DEPARTMENT_CODES]}},orderBy:{code:"asc"}}),
  prisma.qmsRecord.findMany({where:{recordType:QmsRecordType.RETURN,year:{not:null}},select:{year:true},distinct:["year"],orderBy:{year:"desc"}}),
  prisma.returnRecord.count({where:{AND:[administrativeWhere,{status:{not:"DRAFT"}}]}}),prisma.returnRecord.count({where:{AND:[administrativeWhere,{status:"DRAFT"}]}}),prisma.returnRecord.count({where:{AND:[administrativeWhere,{status:"OPEN"}]}}),prisma.returnRecord.count({where:{AND:[administrativeWhere,{status:{not:"DRAFT"},decision:"PENDING"}]}}),
  prisma.returnRecord.count({where:{AND:[administrativeWhere,await returnListWhere({followup:"DUE",administrative:"ALL"})]}})
 ]);
 return {page,pageSize,count,rows: await withActiveReviewCounts(rows),departments,years:years.map(x=>x.year).filter((x):x is number=>x!==null),counters:{total,drafts,open,pending,followupDue}};
}

export async function getReturnDetail(id:string){
 return prisma.returnRecord.findUnique({where:{id},include:{
  qmsRecord:{include:{sourceRelations:{where:{isActive:true},include:{targetRecord:true}},targetRelations:{where:{isActive:true},include:{sourceRecord:true}},versions:{orderBy:{sequenceNumber:"asc"},include:{documents:{orderBy:{uploadedAt:"desc"},select:versionDocumentMetadata}}},generatedDocuments:{orderBy:{generatedAt:"desc"},select:{id:true,documentType:true,generatedAt:true,generatedByText:true,fileName:true,checksum:true,mimeType:true}}}},
  department:true,products:{orderBy:[{sortOrder:"asc"},{createdAt:"asc"}],include:{department:true}},
  followups:{orderBy:[{followupDate:"desc"},{createdAt:"desc"},{id:"desc"}]},
  formVersion:true,annexIIITemplateVersion:{select:templateMetadata},annexIVTemplateVersion:{select:templateMetadata},annexVTemplateVersion:{select:templateMetadata},annexVITemplateVersion:{select:templateMetadata}
 }});
}
export async function getReturnLookups(){
 const [departments,forms,templates]=await Promise.all([
  prisma.department.findMany({where:{isActive:true,code:{in:[...RETURN_DEPARTMENT_CODES]}},orderBy:{code:"asc"}}),
  prisma.formVersion.findMany({where:{module:"RETURN",isActive:true},orderBy:{effectiveFrom:"desc"}}),
  prisma.templateVersion.findMany({select:templateMetadata,where:{module:"RETURN",isActive:true},orderBy:{effectiveFrom:"desc"}})
 ]);
 return {departments,forms,templates};
}

export async function returnListWhere(filters:ReturnListFilters):Promise<Prisma.ReturnRecordWhereInput>{
 const and:Prisma.ReturnRecordWhereInput[]=[];
  const reviewWhere = reviewListWhere(filters.review);
  if (reviewWhere) and.push({ qmsRecord: reviewWhere });
 if(filters.administrative==="ANNULLED")and.push({qmsRecord:{isActive:false}});
 else if(filters.administrative!=="ALL")and.push({qmsRecord:{isActive:true}});
 if(filters.complaint==="YES")and.push({qmsRecord:{targetRelations:{some:{isActive:true,relationType:"GENERATES",sourceRecord:{recordType:"COMPLAINT"}}}}});
 if(filters.complaint==="NO")and.push({qmsRecord:{targetRelations:{none:{isActive:true,relationType:"GENERATES",sourceRecord:{recordType:"COMPLAINT"}}}}});
 if(filters.followup==="DUE"||filters.followup==="PLANNED"||filters.followup==="MISSING"){
  const comparison=filters.followup==="DUE"?Prisma.sql`<= CURRENT_DATE`:filters.followup==="PLANNED"?Prisma.sql`> CURRENT_DATE`:Prisma.sql`IS NULL`;
  const ids=await prisma.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT r.id FROM "ReturnRecord" r WHERE r.status='OPEN' AND (SELECT f."nextFollowupDate" FROM "ReturnFollowup" f WHERE f."returnRecordId"=r.id ORDER BY f."followupDate" DESC,f."createdAt" DESC,f.id DESC LIMIT 1) ${comparison}`);
  and.push({id:{in:ids.map(x=>x.id)}});
 }
 if(filters.q)and.push({OR:[
  {qmsRecord:{businessCode:{contains:filters.q,mode:"insensitive"}}},
  {qmsRecord:{annulledBusinessCode:{contains:filters.q,mode:"insensitive"}}},
  {relatedDocument:{contains:filters.q,mode:"insensitive"}},
  {qmsRecord:{targetRelations:{some:{isActive:true,sourceRecord:{OR:[{businessCode:{contains:filters.q,mode:"insensitive"}},{annulledBusinessCode:{contains:filters.q,mode:"insensitive"}}]}}}}},
  {customerEntity:{contains:filters.q,mode:"insensitive"}},{country:{contains:filters.q,mode:"insensitive"}},
  {reasonObservations:{contains:filters.q,mode:"insensitive"}},{finalDestination:{contains:filters.q,mode:"insensitive"}},
  {products:{some:{OR:[{productNameCode:{contains:filters.q,mode:"insensitive"}},{lot:{contains:filters.q,mode:"insensitive"}}]}}}
 ]});
 const yearsFilter=validYears(filters.year);if(yearsFilter.length)and.push({qmsRecord:{year:{in:yearsFilter}}});
 if(filters.department?.length)and.push({departmentId:{in:filters.department}});
 const types=validValues(filters.type,["COMMERCIAL","COMPLAINT","RECALL","EXPIRY","TRANSPORT","OTHER"] as const);if(types.length)and.push({returnType:{in:types as ("COMMERCIAL"|"COMPLAINT"|"RECALL"|"EXPIRY"|"TRANSPORT"|"OTHER")[]}});
 const statuses=validValues(filters.status,["DRAFT","OPEN","CLOSED"] as const);if(statuses.length)and.push({status:{in:statuses as ("DRAFT"|"OPEN"|"CLOSED")[]}});
 const decisions=validValues(filters.decision,["PENDING","ACCEPTED","REJECTED"] as const);if(decisions.length)and.push({decision:{in:decisions as ("PENDING"|"ACCEPTED"|"REJECTED")[]}});
 return and.length?{AND:and}:{};

}
