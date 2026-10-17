import { prisma } from "@/lib/db";
import { contains, recordCodeFilters, recordHit, recordSelect } from "@/modules/search/record";
import { lotSummary, summarize } from "@/modules/search/ranking";
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
    select: { id: true, customerEntity: true, relatedDocument: true, products: { select: { lot: true }, orderBy: { sortOrder: "asc" } }, qmsRecord: { select: recordSelect } },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((row) => recordHit(returnModule.href, row, summarize(row.customerEntity, lotSummary(...row.products.map((product) => product.lot)), row.relatedDocument)));
};
