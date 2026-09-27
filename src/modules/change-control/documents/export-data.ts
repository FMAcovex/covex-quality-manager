import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type ChangeControlExportFilters={
  year?:string;department?:string;classification?:string;status?:string;
  execution?:string;effectiveness?:string;
};
export async function getChangeControlExportRows(filters:ChangeControlExportFilters) {
  const and:Prisma.ChangeControlWhereInput[]=[];
  if(filters.year&&/^\d{4}$/.test(filters.year)) and.push({qmsRecord:{year:Number(filters.year)}});
  if(filters.department) and.push({departmentId:filters.department});
  if(filters.classification==="MAJOR"||filters.classification==="MINOR") and.push({classification:filters.classification});
  if(["OPEN","CLOSED","REJECTED","CANCELLED"].includes(filters.status??"")) and.push({status:filters.status as "OPEN"|"CLOSED"|"REJECTED"|"CANCELLED"});
  if(filters.execution==="EXECUTED"||filters.execution==="NOT_EXECUTED") and.push({executionStatus:filters.execution});
  if(["PENDING","ACCEPTABLE","NOT_ACCEPTABLE"].includes(filters.effectiveness??"")) {
    and.push({effectivenessStatus:filters.effectiveness as "PENDING"|"ACCEPTABLE"|"NOT_ACCEPTABLE"});
  }
  return prisma.changeControl.findMany({
    where:and.length?{AND:and}:{},
    include:{qmsRecord:true,actions:{orderBy:[{sortOrder:"asc"},{createdAt:"asc"}]},followups:{orderBy:[{sequenceNumber:"desc"},{followupDate:"desc"}]}},
    orderBy:[{requestedAt:"asc"},{createdAt:"asc"}],
  });
}
