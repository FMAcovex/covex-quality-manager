import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type ReturnExportFilters={q?:string;administrative?:string;year?:string;department?:string;type?:string;status?:string;decision?:string};
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
 if(filters.year&&/^\d{4}$/.test(filters.year))and.push({qmsRecord:{year:Number(filters.year)}});
 if(filters.department)and.push({departmentId:filters.department});
 if(["COMMERCIAL","COMPLAINT","RECALL","EXPIRY","TRANSPORT","OTHER"].includes(filters.type??""))and.push({returnType:filters.type as "COMMERCIAL"|"COMPLAINT"|"RECALL"|"EXPIRY"|"TRANSPORT"|"OTHER"});
 if(filters.status==="OPEN"||filters.status==="CLOSED")and.push({status:filters.status});
 if(["PENDING","ACCEPTED","REJECTED"].includes(filters.decision??""))and.push({decision:filters.decision as "PENDING"|"ACCEPTED"|"REJECTED"});
 return prisma.returnRecord.findMany({where:and.length?{AND:and}:{},include:{qmsRecord:true,products:{orderBy:[{sortOrder:"asc"},{createdAt:"asc"}]},followups:{orderBy:[{followupDate:"desc"},{createdAt:"desc"}]}},orderBy:[{communicationDate:"asc"},{createdAt:"asc"}]});
}
