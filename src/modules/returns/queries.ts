import "server-only";
import { Prisma,QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { validValues, validYears } from "@/lib/qms/list-filters";

export type ReturnListFilters={q?:string;administrative?:string;year?:string[];department?:string[];type?:string[];status?:string[];decision?:string[]};

export async function getReturnList(filters:ReturnListFilters){
 const and:Prisma.ReturnRecordWhereInput[]=[];
 if(filters.administrative==="ANNULLED")and.push({qmsRecord:{isActive:false}});
 else if(filters.administrative!=="ALL")and.push({qmsRecord:{isActive:true}});
 if(filters.q)and.push({OR:[
  {qmsRecord:{businessCode:{contains:filters.q,mode:"insensitive"}}},
  {qmsRecord:{annulledBusinessCode:{contains:filters.q,mode:"insensitive"}}},
  {customerEntity:{contains:filters.q,mode:"insensitive"}},{country:{contains:filters.q,mode:"insensitive"}},
  {reasonObservations:{contains:filters.q,mode:"insensitive"}},{finalDestination:{contains:filters.q,mode:"insensitive"}},
  {products:{some:{OR:[{productNameCode:{contains:filters.q,mode:"insensitive"}},{lot:{contains:filters.q,mode:"insensitive"}}]}}}
 ]});
 const yearsFilter=validYears(filters.year);if(yearsFilter.length)and.push({qmsRecord:{year:{in:yearsFilter}}});
 if(filters.department?.length)and.push({departmentId:{in:filters.department}});
 const types=validValues(filters.type,["COMMERCIAL","COMPLAINT","RECALL","EXPIRY","TRANSPORT","OTHER"] as const);if(types.length)and.push({returnType:{in:types as ("COMMERCIAL"|"COMPLAINT"|"RECALL"|"EXPIRY"|"TRANSPORT"|"OTHER")[]}});
 const statuses=validValues(filters.status,["DRAFT","OPEN","CLOSED"] as const);if(statuses.length)and.push({status:{in:statuses as ("DRAFT"|"OPEN"|"CLOSED")[]}});
 const decisions=validValues(filters.decision,["PENDING","ACCEPTED","REJECTED"] as const);if(decisions.length)and.push({decision:{in:decisions as ("PENDING"|"ACCEPTED"|"REJECTED")[]}});
 const where:Prisma.ReturnRecordWhereInput=and.length?{AND:and}:{};
 const administrativeWhere:Prisma.ReturnRecordWhereInput=filters.administrative==="ANNULLED"?{qmsRecord:{isActive:false}}:filters.administrative==="ALL"?{}:{qmsRecord:{isActive:true}};
 const [rows,departments,years,total,drafts,open,pending,followupDue]=await Promise.all([
  prisma.returnRecord.findMany({where,include:{qmsRecord:{include:{sourceRelations:{where:{isActive:true},include:{targetRecord:true}},targetRelations:{where:{isActive:true},include:{sourceRecord:true}}}},department:true,products:{orderBy:{sortOrder:"asc"}},followups:{orderBy:[{followupDate:"desc"},{createdAt:"desc"}],take:1}},orderBy:[{status:"asc"},{communicationDate:"desc"},{createdAt:"desc"}],take:300}),
  prisma.department.findMany({where:{isActive:true},orderBy:{code:"asc"}}),
  prisma.qmsRecord.findMany({where:{recordType:QmsRecordType.RETURN,year:{not:null}},select:{year:true},distinct:["year"],orderBy:{year:"desc"}}),
  prisma.returnRecord.count({where:{AND:[administrativeWhere,{status:{not:"DRAFT"}}]}}),prisma.returnRecord.count({where:{AND:[administrativeWhere,{status:"DRAFT"}]}}),prisma.returnRecord.count({where:{AND:[administrativeWhere,{status:"OPEN"}]}}),prisma.returnRecord.count({where:{AND:[administrativeWhere,{status:{not:"DRAFT"},decision:"PENDING"}]}}),
  prisma.returnRecord.findMany({where:{AND:[administrativeWhere,{status:"OPEN"}]},select:{followups:{orderBy:[{followupDate:"desc"},{createdAt:"desc"}],take:1,select:{nextFollowupDate:true}}}})
 ]);
 return {rows,departments,years:years.map(x=>x.year).filter((x):x is number=>x!==null),counters:{total,drafts,open,pending,followupDue:followupDue.filter(r=>r.followups[0]?.nextFollowupDate&&r.followups[0].nextFollowupDate<=new Date()).length}};
}

export async function getReturnDetail(id:string){
 return prisma.returnRecord.findUnique({where:{id},include:{
  qmsRecord:{include:{sourceRelations:{where:{isActive:true},include:{targetRecord:true}},targetRelations:{where:{isActive:true},include:{sourceRecord:true}},history:{orderBy:{changedAt:"desc"},take:100},versions:{orderBy:{sequenceNumber:"asc"}},generatedDocuments:{orderBy:{generatedAt:"desc"}}}},
  department:true,products:{orderBy:[{sortOrder:"asc"},{createdAt:"asc"}],include:{department:true}},
  followups:{orderBy:[{followupDate:"desc"},{createdAt:"desc"}]},
  formVersion:true,annexIIITemplateVersion:true,annexIVTemplateVersion:true,annexVTemplateVersion:true,annexVITemplateVersion:true
 }});
}
export async function getReturnLookups(){
 const [departments,forms,templates]=await Promise.all([
  prisma.department.findMany({where:{isActive:true},orderBy:{code:"asc"}}),
  prisma.formVersion.findMany({where:{module:"RETURN",isActive:true},orderBy:{effectiveFrom:"desc"}}),
  prisma.templateVersion.findMany({where:{module:"RETURN",isActive:true},orderBy:{effectiveFrom:"desc"}})
 ]);
 return {departments,forms,templates};
}
