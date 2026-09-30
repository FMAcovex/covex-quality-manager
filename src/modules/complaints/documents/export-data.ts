import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { validValues, validYears } from "@/lib/qms/list-filters";

export type ComplaintExportFilters={q?:string;administrative?:string;year?:string[];department?:string[];type?:string[];status?:string[];classification?:string[];effectiveness?:string[]};

export async function getComplaintExportRows(filters:ComplaintExportFilters){
 const and:Prisma.ComplaintWhereInput[]=[];
 if(filters.administrative==="ANNULLED")and.push({qmsRecord:{isActive:false}});
 else if(filters.administrative!=="ALL")and.push({qmsRecord:{isActive:true}});
 and.push({status:{not:"DRAFT"}});
 if(filters.q)and.push({OR:[
  {qmsRecord:{businessCode:{contains:filters.q,mode:"insensitive"}}},{partyName:{contains:filters.q,mode:"insensitive"}},
  {reference:{contains:filters.q,mode:"insensitive"}},{lotReference:{contains:filters.q,mode:"insensitive"}},{description:{contains:filters.q,mode:"insensitive"}},
  {rootCause:{contains:filters.q,mode:"insensitive"}},{internalObservations:{contains:filters.q,mode:"insensitive"}}
 ]});
 const years=validYears(filters.year);if(years.length)and.push({qmsRecord:{year:{in:years}}});
 if(filters.department?.length)and.push({departmentId:{in:filters.department}});
 const types=validValues(filters.type,["PROVIDER","CUSTOMER"] as const);if(types.length)and.push({complaintType:{in:types as ("PROVIDER"|"CUSTOMER")[]}});
 const requestedStatuses=validValues(filters.status,["DRAFT","OPEN","CLOSED"] as const);
 const statuses=requestedStatuses.filter((value)=>value!=="DRAFT") as ("OPEN"|"CLOSED")[];
 if(filters.status?.length)and.push({status:{in:statuses}});
 const classifications=validValues(filters.classification,["CRITICAL","MAJOR","MINOR","NO_GMP_IMPACT"] as const);if(classifications.length)and.push({classification:{in:classifications as ("CRITICAL"|"MAJOR"|"MINOR"|"NO_GMP_IMPACT")[]}});
 const effectiveness=validValues(filters.effectiveness,["PENDING","ACCEPTABLE","NOT_ACCEPTABLE","NOT_REQUIRED"] as const);if(effectiveness.length)and.push({effectivenessStatus:{in:effectiveness as ("PENDING"|"ACCEPTABLE"|"NOT_ACCEPTABLE"|"NOT_REQUIRED")[]}});
 return prisma.complaint.findMany({where:and.length?{AND:and}:{},include:{qmsRecord:true,capaPlans:{orderBy:{createdAt:"asc"}},followups:{orderBy:[{followupDate:"desc"},{createdAt:"desc"}]}},orderBy:[{openedAt:"asc"},{createdAt:"asc"}]});
}
