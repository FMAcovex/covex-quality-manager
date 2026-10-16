import type { GlobalSearchHit } from "./types";

export const contains = (query: string) => ({ contains: query, mode: "insensitive" as const });

/** Filtro común por código visible o código anulado del expediente QmsRecord. */
export const recordCodeFilters = (query: string) => [
  { qmsRecord: { businessCode: contains(query) } },
  { qmsRecord: { annulledBusinessCode: contains(query) } },
];

export const recordSelect = { businessCode: true, annulledBusinessCode: true, isActive: true } as const;

export function recordHit(
  href: string,
  row: { id: string; qmsRecord: { businessCode: string | null; annulledBusinessCode: string | null; isActive: boolean } },
  summary: string,
): GlobalSearchHit {
  return {
    id: row.id,
    code: row.qmsRecord.businessCode ?? row.qmsRecord.annulledBusinessCode ?? "Sin código",
    summary,
    annulled: !row.qmsRecord.isActive,
    href: `${href}/${row.id}`,
  };
}
