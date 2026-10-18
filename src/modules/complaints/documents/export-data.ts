import { idsWithAdditionalLot } from "@/lib/qms/additional-lots-search";
import "server-only";
import { prisma } from "@/lib/db";
import { currentIdentity } from "@/lib/auth/context";

import { complaintListWhere, type ComplaintListFilters } from "@/modules/complaints/list-filters";
export type ComplaintExportFilters=ComplaintListFilters;

export async function getComplaintExportRows(filters:ComplaintExportFilters){
 return prisma.complaint.findMany({where:{AND:[complaintListWhere({...filters,assignedUserId:currentIdentity()?.principal.id},new Date(),filters.q?await idsWithAdditionalLot("COMPLAINT",filters.q):[]),{status:{not:"DRAFT"}}]},include:{qmsRecord:{include:{versions:{orderBy:{sequenceNumber:"desc"},take:1,select:{sequenceNumber:true,snapshot:true}}}},capaPlans:{orderBy:{createdAt:"asc"}},followups:{orderBy:[{followupDate:"desc"},{createdAt:"desc"}]}},orderBy:[{openedAt:"asc"},{createdAt:"asc"}]});
}
