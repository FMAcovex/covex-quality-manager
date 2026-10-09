import { prisma } from "@/lib/db";
import type { Filters } from "./queries";
import { dateFilterErrors, listWhere } from "./queries";
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
function revisionMatches(revision: {
  revisionCode: string; status: string; verificationStatus: string;
  effectiveFrom: Date | null; reviewDueAt: Date | null;
  lifecycle: { effectiveFrom: Date | null; reviewDueAt: Date | null } | null;
}, f: PntListingFilters, quick: PntQuick | null, today: string) {
  const dates = operationalDates(revision);
  if (f.revision && revision.revisionCode !== f.revision) return false;
  if (f.revisionState && revision.status !== f.revisionState) return false;
  if (f.validity === "current" && !(revision.status === "IN_FORCE" && dates.effectiveFrom && dates.effectiveFrom <= today)) return false;
  if (f.validity === "due" && !(revision.status === "IN_FORCE" && dates.reviewDueAt && dates.reviewDueAt <= today)) return false;
  if (f.validity === "missing" && dates.effectiveFrom && dates.reviewDueAt) return false;
  if (!dateInRange(dates.effectiveFrom, f.effectiveFromStart, f.effectiveFromEnd)) return false;
  if (!dateInRange(dates.reviewDueAt, f.reviewDueStart, f.reviewDueEnd)) return false;
  return matchesQuickFilter(revision, dates, quick, today);
}
const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
function compareText(a: string, b: string) { return collator.compare(a, b); }
function compareDates(a: string, b: string, direction: 1 | -1) {
  if (!a) return b ? 1 : 0;
  if (!b) return -1;
  return direction * compareText(a, b);
}

// Page and XLSX share the same selector: the export is never limited to the visible page.
export async function queryPntListing(f: PntListingFilters, paginate = true) {
  const options = normalizedListOptions(f);
  const now = iso(new Date());
  const errors = dateFilterErrors(f);
  const masters = errors.length ? [] : await prisma.controlledDocument.findMany({
    where: listWhere({ q: f.q, department: f.department, state: f.state }),
    orderBy: [{ baseCode: "asc" }, { id: "asc" }],
    include: {
      revisions: {
        orderBy: [{ revisionCode: "desc" }, { id: "desc" }],
        select: {
          id: true, revisionCode: true, status: true, verificationStatus: true,
          effectiveFrom: true, reviewDueAt: true, sourceMetadata: true,
          lifecycle: { select: { effectiveFrom: true, reviewDueAt: true } },
        },
      },
    },
  });
  type Master = typeof masters[number];
  type Revision = Master["revisions"][number];
  const matches: { master: Master; revision: Revision | null }[] = [];
  for (const master of masters) {
    const candidates = options.view === "latest" ? master.revisions.slice(0, 1) : master.revisions;
    if (!candidates.length) {
      // Draft masters without a revision are visible only without revision-level restrictions.
      if (!f.revision && !f.revisionState && !f.validity && !f.effectiveFromStart &&
          !f.effectiveFromEnd && !f.reviewDueStart && !f.reviewDueEnd && !options.quick)
        matches.push({ master, revision: null });
    } else {
      for (const revision of candidates)
        if (revisionMatches(revision, f, options.quick, now))
          matches.push({ master, revision });
    }
  }
  const factor: 1 | -1 = options.direction === "desc" ? -1 : 1;
  matches.sort((a, b) => {
    const aDates = a.revision ? operationalDates(a.revision) : { effectiveFrom: "", reviewDueAt: "" };
    const bDates = b.revision ? operationalDates(b.revision) : { effectiveFrom: "", reviewDueAt: "" };
    if (options.sort === "effectiveFrom" || options.sort === "reviewDueAt") {
      const result = compareDates(aDates[options.sort], bDates[options.sort], factor);
      if (result) return result;
    } else {
      const key = (row: typeof a): string => {
        if (options.sort === "title") return row.master.title || "";
        if (options.sort === "department") return row.master.departmentCodeSnapshot || "";
        if (options.sort === "masterState") return row.master.administrativeStatus;
        if (options.sort === "revision") return row.revision?.revisionCode || "";
        if (options.sort === "status") return row.revision?.status || "";
        return row.master.baseCode || "";
      };
      const result = factor * compareText(key(a), key(b));
      if (result) return result;
    }
    return compareText(a.master.baseCode || "", b.master.baseCode || "") ||
      compareText(b.revision?.revisionCode || "", a.revision?.revisionCode || "") ||
      compareText(a.master.id, b.master.id);
  });
  const rowCount = matches.length;
  const masterCount = new Set(matches.map(r => r.master.id)).size;
  const revisionCount = matches.filter(r => r.revision !== null).length;
  const pages = Math.max(1, Math.ceil(rowCount / PNT_PAGE_SIZE));
  const requested = Number.parseInt(f.page || "1", 10) || 1;
  const page = Math.min(pages, Math.max(1, requested));
  return {
    rows: paginate ? matches.slice((page - 1) * PNT_PAGE_SIZE, page * PNT_PAGE_SIZE) : matches,
    rowCount, masterCount, revisionCount, page, pages, options, errors,
  };
}
