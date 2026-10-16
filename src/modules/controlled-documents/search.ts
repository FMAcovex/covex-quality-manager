import { prisma } from "@/lib/db";
import { contains } from "@/modules/search/record";
import { summarize } from "@/modules/search/ranking";
import type { ModuleSearchProvider } from "@/modules/search/types";
import { pntModule } from "./contract";

export const searchControlledDocuments: ModuleSearchProvider = async (query, take) => {
  const rows = await prisma.controlledDocument.findMany({
    where: { OR: [{ baseCode: contains(query) }, { title: contains(query) }] },
    select: { id: true, baseCode: true, title: true },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((row) => ({ id: row.id, code: row.baseCode ?? "Sin código", summary: summarize(row.title), annulled: false, href: `${pntModule.href}/${row.id}` }));
};
