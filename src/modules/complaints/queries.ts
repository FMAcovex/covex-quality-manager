import "server-only";
import { Prisma, QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";

export type ComplaintListFilters={
  q?:string;year?:string;department?:string;type?:string;status?:string;classification?:string;effectiveness?:string;
};

export async function getComplaintList(filters:ComplaintListFilters){
 const and:Prisma.ComplaintWhereInput[]=[];
 if(filters.q)and.push({OR:[
  {qmsRecord:{businessCode:{contains:filters.q,mode:"insensitive"}}},
  {partyName:{contains:filters.q,mode:"insensitive"}},{reference:{contains:filters.q,mode:"insensitive"}},
  {lotReference:{contains:filters.q,mode:"insensitive"}},{description:{contains:filters.q,mode:"insensitive"}},
  {rootCause:{contains:filters.q,mode:"insensitive"}},{internalObservations:{contains:filters.q,mode:"insensitive"}},
  {capaPlans:{some:{description:{contains:filters.q,mode:"insensitive"}}}}
 ]});
 if(filters.year&&/^\d{4}$/.test(filters.year))and.push({qmsRecord:{year:Number(filters.year)}});
 if(filters.department)and.push({departmentId:filters.department});
 if(filters.type==="PROVIDER"||filters.type==="CUSTOMER")and.push({complaintType:filters.type});
 if(filters.status==="OPEN"||filters.status==="CLOSED")and.push({status:filters.status});
 if(["CRITICAL","MAJOR","MINOR","NO_GMP_IMPACT"].includes(filters.classification??""))
   and.push({classification:filters.classification as "CRITICAL"|"MAJOR"|"MINOR"|"NO_GMP_IMPACT"});
 if(["PENDING","ACCEPTABLE","NOT_ACCEPTABLE","NOT_REQUIRED"].includes(filters.effectiveness??""))
   and.push({effectivenessStatus:filters.effectiveness as "PENDING"|"ACCEPTABLE"|"NOT_ACCEPTABLE"|"NOT_REQUIRED"});
 const where:Prisma.ComplaintWhereInput=and.length?{AND:and}:{};
 const [rows,departments,years,total,open,pendingEfficacy,followupDue]=await Promise.all([
  prisma.complaint.findMany({where,include:{qmsRecord:true,department:true,capaPlans:true,followups:{orderBy:[{followupDate:"desc"},{createdAt:"desc"}],take:1}},orderBy:[{status:"asc"},{openedAt:"desc"},{createdAt:"desc"}],take:300}),
  prisma.department.findMany({where:{isActive:true},orderBy:{code:"asc"}}),
  prisma.qmsRecord.findMany({where:{recordType:QmsRecordType.COMPLAINT,year:{not:null}},select:{year:true},distinct:["year"],orderBy:{year:"desc"}}),
  prisma.complaint.count(),prisma.complaint.count({where:{status:"OPEN"}}),
  prisma.complaint.count({where:{status:"OPEN",effectivenessStatus:"PENDING"}}),
  prisma.complaint.findMany({where:{status:"OPEN"},select:{followups:{orderBy:[{followupDate:"desc"},{createdAt:"desc"}],take:1,select:{nextFollowupDate:true}}}})
 ]);
 return {rows,departments,years:years.map(x=>x.year).filter((x):x is number=>x!==null),counters:{
  total,open,pendingEfficacy,followupDue:followupDue.filter(r=>r.followups[0]?.nextFollowupDate&&r.followups[0].nextFollowupDate<=new Date()).length
 }};
}

export async function getComplaintDetail(id:string){
 return prisma.complaint.findUnique({where:{id},include:{
  qmsRecord:{include:{sourceRelations:{where:{isActive:true},include:{targetRecord:true}},targetRelations:{where:{isActive:true},include:{sourceRecord:true}},history:{orderBy:{changedAt:"desc"},take:100},versions:{orderBy:{sequenceNumber:"asc"}},generatedDocuments:{orderBy:{generatedAt:"desc"}}}},
  department:true,followups:{orderBy:[{followupDate:"desc"},{createdAt:"desc"}]},
  capaPlans:{orderBy:{createdAt:"asc"},include:{linkedCapaRecord:true}},
  formVersion:true,annexIIITemplateVersion:true,annexIVTemplateVersion:true,annexVTemplateVersion:true
 }});
}

export async function getComplaintLookups(){
 const [departments,forms,templates]=await Promise.all([
  prisma.department.findMany({where:{isActive:true},orderBy:{code:"asc"}}),
  prisma.formVersion.findMany({where:{module:"COMPLAINT",isActive:true},orderBy:{effectiveFrom:"desc"}}),
  prisma.templateVersion.findMany({where:{module:"COMPLAINT",isActive:true},orderBy:{effectiveFrom:"desc"}})
 ]);
 return {departments,forms,templates};
}
