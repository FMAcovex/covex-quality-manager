import { prisma } from "@/lib/db";
import { contains, recordCodeFilters, recordHit, recordSelect } from "@/modules/search/record";
import { lotSummary, summarize } from "@/modules/search/ranking";
import type { ModuleSearchProvider } from "@/modules/search/types";
import { oosModule } from "./contract";

export const searchOos: ModuleSearchProvider = async (query, take) => {
  const rows = await prisma.oosRecord.findMany({
    where: { OR: [
      ...recordCodeFilters(query),
      { materialName: contains(query) },
      { lotNumber: contains(query) },
      { supplierLot: contains(query) },
    ] },
    select: { id: true, materialName: true, lotNumber: true, supplierLot: true, qmsRecord: { select: recordSelect } },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((row) => recordHit(oosModule.href, row, summarize(row.materialName, lotSummary(row.lotNumber, row.supplierLot))));
};
