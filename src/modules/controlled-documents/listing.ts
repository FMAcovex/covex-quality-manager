import { Prisma } from "@prisma/client";
import { pntCandidatesSql, sortPntCandidates, type PntCandidate } from "./listing-selection";
import { prisma } from "@/lib/db";
import type { Filters } from "./queries";
import { dateFilterErrors } from "./queries";
import { iso } from "./domain";

// Listing-only projection. No documentary binaries, approval evidence or history are loaded.
export const PNT_PAGE_SIZE = 25;
export const PNT_SORTS = ["code", "title", "department", "masterState", "revision", "status", "effectiveFrom", "reviewDueAt"] as const;
export type PntSort = typeof PNT_SORTS[number];
export const PNT_QUICK = ["current", "dueSoon", "overdue", "missing", "unverified"] as const;
export type PntQuick = typeof PNT_QUICK[number];
export const PNT_VIEWS = ["all", "latest"] as const;
export type PntView = typeof PNT_VIEWS[number];

export type PntListingFilters = Filters & { sort?: string; direction?: string; view?: string; quick?: string };
export function normalizedListOptions(f: PntListingFilters) {
  return {
    sort: PNT_SORTS.includes(f.sort as PntSort) ? f.sort as PntSort : "code" as PntSort,
    direction: f.direction === "desc" ? "desc" as const : "asc" as const,
    view: f.view === "latest" ? "latest" as const : "all" as const,
    quick: PNT_QUICK.includes(f.quick as PntQuick) ? f.quick as PntQuick : null,
  };
}
function dateString(date: Date | null | undefined) { return iso(date); }
export function operationalDates(revision: {
  effectiveFrom: Date | null; reviewDueAt: Date | null;
  lifecycle: { effectiveFrom: Date | null; reviewDueAt: Date | null } | null;
}) {
  return {
    effectiveFrom: dateString(revision.lifecycle ? revision.lifecycle.effectiveFrom : revision.effectiveFrom),
    reviewDueAt: dateString(revision.lifecycle ? revision.lifecycle.reviewDueAt : revision.reviewDueAt),
  };
}
export function dateInRange(date: string, start?: string, end?: string) {
  return (!start && !end) || (!!date && (!start || date >= start) && (!end || date <= end));
}
export function matchesQuickFilter(revision: {
  status: string; verificationStatus: string;
}, dates: { effectiveFrom: string; reviewDueAt: string }, quick: PntQuick | null, today: string) {
  if (!quick) return true;
  if (quick === "missing") return !dates.effectiveFrom || !dates.reviewDueAt;
  if (quick === "unverified") return revision.verificationStatus !== "VERIFIED" && revision.status !== "OBSOLETE" && revision.status !== "ANNULLED";
  if (revision.status !== "IN_FORCE") return false;
  if (quick === "current") return !!dates.effectiveFrom && dates.effectiveFrom <= today;
  if (!dates.reviewDueAt) return false;
  if (quick === "overdue") return dates.reviewDueAt < today;
  const max = dateString(new Date(Date.parse(today + "T00:00:00Z") + 30 * 86400000));
  return dates.reviewDueAt >= today && dates.reviewDueAt <= max;
}
const revisionSelect = {
  id: true, revisionCode: true, status: true, verificationStatus: true,
  effectiveFrom: true, reviewDueAt: true, sourceMetadata: true,
  lifecycle: { select: { effectiveFrom: true, reviewDueAt: true } },
} satisfies Prisma.ControlledDocumentRevisionSelect;
const masterSelect = {
  id: true, baseCode: true, title: true, departmentCodeSnapshot: true, departmentNameSnapshot: true,
  administrativeStatus: true, sourceMetadata: true,
} satisfies Prisma.ControlledDocumentSelect;

// Selection/counts in SQL; exact Spanish ordering over compact keys; hydrate one page only.
// The same SQL selection serves the complete export independently of the visible page.
export async function queryPntListing(f: PntListingFilters, paginate = true) {
  const options = normalizedListOptions(f);
  const errors = dateFilterErrors(f);
  return prisma.$transaction(async tx => {
    const selection = pntCandidatesSql(f, iso(new Date()));
    const totals = errors.length ? { rowCount: 0, masterCount: 0, revisionCount: 0 } :
      (await tx.$queryRaw<Array<{ rowCount: number; masterCount: number; revisionCount: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS "rowCount", COUNT(DISTINCT "masterId")::int AS "masterCount", COUNT("revisionId")::int AS "revisionCount"
        FROM (${selection}) selected
      `))[0];
    const pages = Math.max(1, Math.ceil(totals.rowCount / PNT_PAGE_SIZE));
    const requested = Number.parseInt(f.page || "1", 10) || 1;
    const page = Math.min(pages, Math.max(1, requested));
    const candidates = errors.length ? [] : sortPntCandidates(await tx.$queryRaw<PntCandidate[]>(selection), f);
    const selected = paginate ? candidates.slice((page - 1) * PNT_PAGE_SIZE, page * PNT_PAGE_SIZE) : candidates;
    const masterIds = [...new Set(selected.map(row => row.masterId))];
    const revisionIds = selected.flatMap(row => row.revisionId ? [row.revisionId] : []);
    const [masters, revisions] = await Promise.all([
      masterIds.length ? tx.controlledDocument.findMany({ where: { id: { in: masterIds } }, select: masterSelect }) : [],
      revisionIds.length ? tx.controlledDocumentRevision.findMany({ where: { id: { in: revisionIds } }, select: revisionSelect }) : [],
    ]);
    const masterById = new Map(masters.map(master => [master.id, master]));
    const revisionById = new Map(revisions.map(revision => [revision.id, revision]));
    const rows = selected.map(row => ({
      master: masterById.get(row.masterId)!,
      revision: row.revisionId ? revisionById.get(row.revisionId)! : null,
    }));
    return { rows, ...totals, page, pages, options, errors };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
