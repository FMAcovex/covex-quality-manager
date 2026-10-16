import { prisma } from "@/lib/db";
import { contains, recordCodeFilters, recordHit, recordSelect } from "@/modules/search/record";
import { summarize } from "@/modules/search/ranking";
import type { ModuleSearchProvider } from "@/modules/search/types";
import { auditModule } from "./contract";

export const searchAudits: ModuleSearchProvider = async (query, take) => {
  const rows = await prisma.audit.findMany({
    where: { OR: [...recordCodeFilters(query), { title: contains(query) }, { externalReference: contains(query) }, { auditedEntityName: contains(query) }] },
    select: { id: true, title: true, auditedEntityName: true, qmsRecord: { select: recordSelect } },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((row) => recordHit(auditModule.href, row, summarize(row.title, row.auditedEntityName)));
};
