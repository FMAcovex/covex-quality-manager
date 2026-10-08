import "server-only";
import { prisma } from "@/lib/db";
import {returnListWhere,type ReturnListFilters} from "../queries";

export type ReturnExportFilters=ReturnListFilters;
export async function getReturnExportRows(filters:ReturnExportFilters){
 const where={AND:[await returnListWhere(filters),{status:{not:"DRAFT" as const}}]};
 return prisma.returnRecord.findMany({where,include:{qmsRecord:true,products:{orderBy:[{sortOrder:"asc"},{createdAt:"asc"}]},followups:{orderBy:[{followupDate:"desc"},{createdAt:"desc"},{id:"desc"}]}},orderBy:[{communicationDate:"asc"},{createdAt:"asc"}]});
}
