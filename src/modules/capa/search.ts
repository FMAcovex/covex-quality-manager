import { prisma } from "@/lib/db";
import { contains, recordCodeFilters, recordHit, recordSelect } from "@/modules/search/record";
import { summarize } from "@/modules/search/ranking";
import type { ModuleSearchProvider } from "@/modules/search/types";
import { capaModule } from "./contract";

export const searchCapa: ModuleSearchProvider = async (query, take) => {
  const rows = await prisma.capa.findMany({
    where: { OR: [...recordCodeFilters(query), { originCode: contains(query) }, { defectDescription: contains(query) }] },
    select: { id: true, originCode: true, defectDescription: true, qmsRecord: { select: recordSelect } },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((row) => recordHit(capaModule.href, row, summarize(row.defectDescription, row.originCode ? `Origen ${row.originCode}` : null)));
};
