import { prisma } from "@/lib/db";
import { contains, recordCodeFilters, recordHit, recordSelect } from "@/modules/search/record";
import { summarize } from "@/modules/search/ranking";
import type { ModuleSearchProvider } from "@/modules/search/types";
import { deviationModule } from "./contract";

export const searchDeviations: ModuleSearchProvider = async (query, take) => {
  const rows = await prisma.deviation.findMany({
    where: { OR: [...recordCodeFilters(query), { whatHappened: contains(query) }, { materialProcessAffected: contains(query) }] },
    select: { id: true, whatHappened: true, materialProcessAffected: true, qmsRecord: { select: recordSelect } },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((row) => recordHit(deviationModule.href, row, summarize(row.materialProcessAffected, row.whatHappened)));
};
