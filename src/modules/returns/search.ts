import { prisma } from "@/lib/db";
import { contains, recordCodeFilters, recordHit, recordSelect } from "@/modules/search/record";
import { summarize } from "@/modules/search/ranking";
import type { ModuleSearchProvider } from "@/modules/search/types";
import { returnModule } from "./contract";

export const searchReturns: ModuleSearchProvider = async (query, take) => {
  const rows = await prisma.returnRecord.findMany({
    where: { OR: [
      ...recordCodeFilters(query),
      { customerEntity: contains(query) },
      { relatedDocument: contains(query) },
      { products: { some: { OR: [{ productNameCode: contains(query) }, { lot: contains(query) }] } } },
    ] },
    select: { id: true, customerEntity: true, relatedDocument: true, qmsRecord: { select: recordSelect } },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((row) => recordHit(returnModule.href, row, summarize(row.customerEntity, row.relatedDocument)));
};
