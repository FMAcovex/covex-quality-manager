import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { validValues, validYears } from "@/lib/qms/list-filters";

export type ReturnExportFilters={q?:string;administrative?:string;year?:string[];department?:string[];type?:string[];status?:string[];decision?:string[]};
export async function getReturnExportRows(filters:ReturnExportFilters){
 const and:Prisma.ReturnRecordWhereInput[]=[];
 if(filters.administrative==="ANNULLED")and.push({qmsRecord:{isActive:false}});
 else if(filters.administrative!=="ALL")and.push({qmsRecord:{isActive:true}});
 and.push({status:{not:"DRAFT"}});
 if(filters.q)and.push({OR:[
  {qmsRecord:{businessCode:{contains:filters.q,mode:"insensitive"}}},{customerEntity:{contains:filters.q,mode:"insensitive"}},
  {country:{contains:filters.q,mode:"insensitive"}},{reasonObservations:{contains:filters.q,mode:"insensitive"}},
  {products:{some:{OR:[{productNameCode:{contains:filters.q,mode:"insensitive"}},{lot:{contains:filters.q,mode:"insensitive"}}]}}}
 ]});
 const years=validYears(filters.year);if(years.length)and.push({qmsRecord:{year:{in:years}}});
 if(filters.department?.length)and.push({departmentId:{in:filters.department}});
 const types=validValues(filters.type,["COMMERCIAL","COMPLAINT","RECALL","EXPIRY","TRANSPORT","OTHER"] as const);if(types.length)and.push({returnType:{in:types as ("COMMERCIAL"|"COMPLAINT"|"RECALL"|"EXPIRY"|"TRANSPORT"|"OTHER")[]}});
 const statuses=validValues(filters.status,["OPEN","CLOSED"] as const);if(statuses.length)and.push({status:{in:statuses as ("OPEN"|"CLOSED")[]}});
 const decisions=validValues(filters.decision,["PENDING","ACCEPTED","REJECTED"] as const);if(decisions.length)and.push({decision:{in:decisions as ("PENDING"|"ACCEPTED"|"REJECTED")[]}});
 return prisma.returnRecord.findMany({where:and.length?{AND:and}:{},include:{qmsRecord:true,products:{orderBy:[{sortOrder:"asc"},{createdAt:"asc"}]},followups:{orderBy:[{followupDate:"desc"},{createdAt:"desc"}]}},orderBy:[{communicationDate:"asc"},{createdAt:"asc"}]});
}
