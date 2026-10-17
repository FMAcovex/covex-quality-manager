import { idsWithAdditionalLot } from "@/lib/qms/additional-lots-search";
import { storedAdditionalLots } from "@/lib/qms/additional-lots";
import { prisma } from "@/lib/db";
import { contains, recordCodeFilters, recordHit, recordSelect } from "@/modules/search/record";
import { lotSummary, summarize } from "@/modules/search/ranking";
import type { ModuleSearchProvider } from "@/modules/search/types";
import { complaintModule } from "./contract";

export const searchComplaints: ModuleSearchProvider = async (query, take) => {
  const lotIds = await idsWithAdditionalLot("COMPLAINT", query);
  const rows = await prisma.complaint.findMany({
    where: { OR: [...(lotIds.length ? [{ id: { in: lotIds } }] : []), ...recordCodeFilters(query), { partyName: contains(query) }, { reference: contains(query) }, { lotReference: contains(query) }, { description: contains(query) }] },
    select: { id: true, partyName: true, lotReference: true, additionalLots: true, description: true, qmsRecord: { select: recordSelect } },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((row) => recordHit(complaintModule.href, row, summarize(row.partyName, lotSummary(row.lotReference, ...storedAdditionalLots(row.additionalLots).map((lot) => lot.lot)), row.description)));
};
