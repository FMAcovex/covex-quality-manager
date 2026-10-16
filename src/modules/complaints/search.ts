import { prisma } from "@/lib/db";
import { contains, recordCodeFilters, recordHit, recordSelect } from "@/modules/search/record";
import { summarize } from "@/modules/search/ranking";
import type { ModuleSearchProvider } from "@/modules/search/types";
import { complaintModule } from "./contract";

export const searchComplaints: ModuleSearchProvider = async (query, take) => {
  const rows = await prisma.complaint.findMany({
    where: { OR: [...recordCodeFilters(query), { partyName: contains(query) }, { reference: contains(query) }, { lotReference: contains(query) }, { description: contains(query) }] },
    select: { id: true, partyName: true, lotReference: true, description: true, qmsRecord: { select: recordSelect } },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((row) => recordHit(complaintModule.href, row, summarize(row.partyName, row.lotReference ? `Lote ${row.lotReference}` : null, row.description)));
};
