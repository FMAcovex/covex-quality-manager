import "server-only";
import { prisma } from "@/lib/db";
import { currentIdentity } from "@/lib/auth/context";
import { parseListPath } from "./domain";

export type SavedViewSummary = { id: string; name: string; query: string };

/** Vistas del usuario autenticado para un listado; solo propias, ordenadas por nombre. */
export async function listSavedViews(listPath: string): Promise<SavedViewSummary[]> {
  const userId = currentIdentity()?.principal.id;
  if (!userId) return [];
  return prisma.savedListView.findMany({
    where: { userId, listPath: parseListPath(listPath) },
    select: { id: true, name: true, query: true },
    orderBy: { name: "asc" },
  });
}
