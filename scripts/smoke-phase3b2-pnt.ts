import "server-only";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db";
import { queryPntListing, PNT_SORTS, type PntListingFilters } from "../src/modules/controlled-documents/listing";
import { queryPntListing as reference } from "./phase3b2-reference/pnt";
import { createPhase3b2Fixtures } from "./phase3b2-fixtures";

function visible(result: Awaited<ReturnType<typeof reference>> | Awaited<ReturnType<typeof queryPntListing>>) {
  return { ...result, rows: result.rows.map(({ master, revision }) => ({
    master: { id: master.id, baseCode: master.baseCode, title: master.title, departmentCodeSnapshot: master.departmentCodeSnapshot, departmentNameSnapshot: master.departmentNameSnapshot, administrativeStatus: master.administrativeStatus, sourceMetadata: master.sourceMetadata },
    revision,
  })) };
}
async function main() {
  const fixture = await createPhase3b2Fixtures(Number(process.env.PHASE3B2_SIZE) || 1000);
  let comparisons = 0;
  try {
    const base = { q: fixture.prefix };
    const filters: PntListingFilters[] = [];
    for (const view of ["all", "latest"]) for (const sort of PNT_SORTS) for (const direction of ["asc", "desc"])
      filters.push({ ...base, view, sort, direction });
    for (const quick of ["current", "overdue", "dueSoon", "missing", "unverified"]) for (const view of ["all", "latest"])
      filters.push({ ...base, quick, view });
    for (const validity of ["current", "due", "missing", "unknown"]) filters.push({ ...base, validity });
    for (const state of ["ACTIVE", "DRAFT", "ANNULLED", "UNKNOWN"]) filters.push({ ...base, state });
    for (const revisionState of ["IN_FORCE", "DRAFT", "OBSOLETE", "ANNULLED", "UNKNOWN"]) filters.push({ ...base, revisionState });
    filters.push(
      { ...base, department: fixture.departments[0], quick: "overdue", revisionState: "IN_FORCE" },
      { ...base, view: "latest", revision: "00", revisionState: "IN_FORCE" },
      { ...base, effectiveFromStart: "2025-01-01", effectiveFromEnd: "2026-01-01", reviewDueStart: "2026-10-10", reviewDueEnd: "2026-11-10" },
      { ...base, effectiveFromStart: "2026-02-30" }, { ...base, reviewDueStart: "2027-01-01", reviewDueEnd: "2020-01-01" },
      { q: fixture.prefix + "-source-" + (fixture.masterSize - 1) }, { ...base, revision: "invalid" },
      { q: "Árbol" }, { q: "%" }, { q: "_" }, { ...base, sort: "bad", direction: "bad", view: "bad", quick: "bad" },
    );
    for (const filter of filters) {
      const old = await reference(filter, false);
      const current = await queryPntListing(filter, false);
      assert.deepEqual(visible(current), visible(old), JSON.stringify(filter));
      for (const page of [1, Math.max(2, Math.ceil(old.pages / 2)), 9999]) {
        assert.deepEqual(visible(await queryPntListing({ ...filter, page: String(page) })), visible(await reference({ ...filter, page: String(page) })), JSON.stringify({ ...filter, page }));
        comparisons++;
      }
      comparisons++;
    }
    const exported = await queryPntListing({ ...base, page: "2" }, false);
    assert(exported.rows.length > 25);
    const first = await queryPntListing(base);
    const last = await queryPntListing({ ...base, page: "9999" });
    assert.equal(first.rowCount, exported.rowCount);
    assert.equal(last.rowCount, exported.rowCount);
    assert(first.rows.some(row => row.revision === null), "Master without revisions stays visible");
    assert((await queryPntListing({ ...base, quick: "overdue" }, false)).rows.every(row => row.revision?.status === "IN_FORCE"));
    assert((await queryPntListing({ ...base, view: "latest", quick: "overdue" }, false)).rows.length < (await queryPntListing({ ...base, quick: "overdue" }, false)).rows.length, "Latest draft does not become in-force");
    console.log(`3B2 PNT: ${comparisons} comparisons passed; all eight sorts, both directions/views, date/null lifecycle, filters, counts, full export and first/middle/last pages.`);
  } finally { await fixture.cleanup(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
