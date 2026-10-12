import "server-only";
import { Prisma } from "@prisma/client";
import { administrativeLabels } from "./domain";
import type { PntListingFilters } from "./listing";
import { normalizedListOptions } from "./listing";

export type PntCandidate = {
  masterId: string; revisionId: string | null; baseCode: string | null; title: string | null;
  department: string | null; masterState: string; revision: string | null; status: string | null;
  effectiveFrom: Date | null; reviewDueAt: Date | null;
};

// A lifecycle row is authoritative even when its dates are null. COALESCE would restore stale dates.
export function pntCandidatesSql(f: PntListingFilters, today: string) {
  const options = normalizedListOptions(f);
  const master: Prisma.Sql[] = [], revision: Prisma.Sql[] = [];
  if (f.q?.trim()) {
    const search = "%" + f.q.trim().slice(0, 500) + "%";
    master.push(Prisma.sql`(m."baseCode" ILIKE ${search} OR m.title ILIKE ${search} OR m."departmentNameSnapshot" ILIKE ${search}
      OR EXISTS (SELECT 1 FROM "ControlledDocumentRevision" s WHERE s."documentId" = m.id AND s."sourceReference" ILIKE ${search}))`);
  }
  if (f.department) master.push(Prisma.sql`m."departmentId" = ${f.department}`);
  if (f.state && Object.hasOwn(administrativeLabels, f.state)) master.push(Prisma.sql`m."administrativeStatus"::text = ${f.state}`);
  const effective = Prisma.sql`CASE WHEN l."revisionId" IS NOT NULL THEN l."effectiveFrom" ELSE r."effectiveFrom" END`;
  const due = Prisma.sql`CASE WHEN l."revisionId" IS NOT NULL THEN l."reviewDueAt" ELSE r."reviewDueAt" END`;
  const date = new Date(today + "T00:00:00Z");
  if (f.revision) revision.push(Prisma.sql`r."revisionCode" = ${f.revision}`);
  if (f.revisionState) revision.push(Prisma.sql`r.status::text = ${f.revisionState}`);
  if (f.validity === "current") revision.push(Prisma.sql`r.status = 'IN_FORCE' AND ${effective} <= ${date}`);
  if (f.validity === "due") revision.push(Prisma.sql`r.status = 'IN_FORCE' AND ${due} <= ${date}`);
  if (f.validity === "missing") revision.push(Prisma.sql`(${effective} IS NULL OR ${due} IS NULL)`);
  for (const [field, start, end] of [[effective, f.effectiveFromStart, f.effectiveFromEnd], [due, f.reviewDueStart, f.reviewDueEnd]] as const) {
    if (start) revision.push(Prisma.sql`${field} >= ${new Date(start + "T00:00:00Z")}`);
    if (end) revision.push(Prisma.sql`${field} < ${new Date(Date.parse(end + "T00:00:00Z") + 86400000)}`);
  }
  if (options.quick === "missing") revision.push(Prisma.sql`(${effective} IS NULL OR ${due} IS NULL)`);
  if (options.quick === "unverified") revision.push(Prisma.sql`r."verificationStatus" <> 'VERIFIED' AND r.status NOT IN ('OBSOLETE', 'ANNULLED')`);
  if (options.quick === "current") revision.push(Prisma.sql`r.status = 'IN_FORCE' AND ${effective} <= ${date}`);
  if (options.quick === "overdue") revision.push(Prisma.sql`r.status = 'IN_FORCE' AND ${due} < ${date}`);
  if (options.quick === "dueSoon") revision.push(Prisma.sql`r.status = 'IN_FORCE' AND ${due} >= ${date} AND ${due} < ${new Date(date.getTime() + 31 * 86400000)}`);
  const restriction = !!(f.revision || f.revisionState || f.validity || f.effectiveFromStart || f.effectiveFromEnd || f.reviewDueStart || f.reviewDueEnd || options.quick);
  return Prisma.sql`
    SELECT m.id AS "masterId", r.id AS "revisionId", m."baseCode", m.title, m."departmentCodeSnapshot" AS department,
      m."administrativeStatus"::text AS "masterState", r."revisionCode" AS revision, r.status::text AS status,
      ${effective} AS "effectiveFrom", ${due} AS "reviewDueAt"
    FROM "ControlledDocument" m LEFT JOIN "ControlledDocumentRevision" r ON r."documentId" = m.id
      ${options.view === "latest" ? Prisma.sql`AND r.id = (SELECT s.id FROM "ControlledDocumentRevision" s WHERE s."documentId" = m.id ORDER BY s."revisionCode" DESC, s.id DESC LIMIT 1)` : Prisma.empty}
    LEFT JOIN "ControlledRevisionLifecycle" l ON l."revisionId" = r.id
    WHERE ${master.length ? Prisma.join(master, " AND ") : Prisma.sql`true`}
      AND ((r.id IS NULL AND ${!restriction}) OR (r.id IS NOT NULL AND ${revision.length ? Prisma.join(revision, " AND ") : Prisma.sql`true`}))
  `;
}

// PostgreSQL's installed collation is not guaranteed equivalent to numeric Spanish Intl.Collator.
// Sort compact keys exactly as before; only hydrate the selected page's masters/revisions.
export function sortPntCandidates(rows: PntCandidate[], f: PntListingFilters) {
  const options = normalizedListOptions(f);
  const compare = new Intl.Collator("es", { numeric: true, sensitivity: "base" }).compare;
  const factor = options.direction === "desc" ? -1 : 1;
  return rows.sort((a, b) => {
    let result: number;
    if (options.sort === "effectiveFrom" || options.sort === "reviewDueAt") {
      const x = a[options.sort], y = b[options.sort];
      result = !x ? (y ? 1 : 0) : !y ? -1 : factor * (x.getTime() - y.getTime());
    } else {
      const key = options.sort === "code" ? "baseCode" : options.sort;
      result = factor * compare(a[key] ?? "", b[key] ?? "");
    }
    return result || compare(a.baseCode ?? "", b.baseCode ?? "") || compare(b.revision ?? "", a.revision ?? "") || compare(a.masterId, b.masterId);
  });
}
