import { prisma } from "@/lib/db";
import { contains, recordCodeFilters, recordHit, recordSelect } from "@/modules/search/record";
import { summarize } from "@/modules/search/ranking";
import type { ModuleSearchProvider } from "@/modules/search/types";
import { changeControlModule } from "./contract";

export const searchChangeControls: ModuleSearchProvider = async (query, take) => {
  const rows = await prisma.changeControl.findMany({
    where: { OR: [...recordCodeFilters(query), { description: contains(query) }] },
    select: { id: true, description: true, qmsRecord: { select: recordSelect } },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((row) => recordHit(changeControlModule.href, row, summarize(row.description)));
};
