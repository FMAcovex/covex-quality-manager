import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type ComplaintExportFilters={q?:string;administrative?:string;year?:string;department?:string;type?:string;status?:string;classification?:string;effectiveness?:string};

export async function getComplaintExportRows(filters:ComplaintExportFilters){
 const and:Prisma.ComplaintWhereInput[]=[];
 if(filters.administrative==="ANNULLED")and.push({qmsRecord:{isActive:false}});
 else if(filters.administrative!=="ALL")and.push({qmsRecord:{isActive:true}});
 if(filters.q)and.push({OR:[
  {qmsRecord:{businessCode:{contains:filters.q,mode:"insensitive"}}},{partyName:{contains:filters.q,mode:"insensitive"}},
  {reference:{contains:filters.q,mode:"insensitive"}},{lotReference:{contains:filters.q,mode:"insensitive"}},{description:{contains:filters.q,mode:"insensitive"}},
  {rootCause:{contains:filters.q,mode:"insensitive"}},{internalObservations:{contains:filters.q,mode:"insensitive"}}
 ]});
 if(filters.year&&/^\d{4}$/.test(filters.year))and.push({qmsRecord:{year:Number(filters.year)}});
 if(filters.department)and.push({departmentId:filters.department});
 if(filters.type==="PROVIDER"||filters.type==="CUSTOMER")and.push({complaintType:filters.type});
 if(filters.status==="DRAFT"||filters.status==="OPEN"||filters.status==="CLOSED")and.push({status:filters.status});
 else and.push({status:{not:"DRAFT"}});
 if(["CRITICAL","MAJOR","MINOR","NO_GMP_IMPACT"].includes(filters.classification??""))and.push({classification:filters.classification as "CRITICAL"|"MAJOR"|"MINOR"|"NO_GMP_IMPACT"});
 if(["PENDING","ACCEPTABLE","NOT_ACCEPTABLE","NOT_REQUIRED"].includes(filters.effectiveness??""))and.push({effectivenessStatus:filters.effectiveness as "PENDING"|"ACCEPTABLE"|"NOT_ACCEPTABLE"|"NOT_REQUIRED"});
 return prisma.complaint.findMany({where:and.length?{AND:and}:{},include:{qmsRecord:true,capaPlans:{orderBy:{createdAt:"asc"}},followups:{orderBy:[{followupDate:"desc"},{createdAt:"desc"}]}},orderBy:[{openedAt:"asc"},{createdAt:"asc"}]});
}
