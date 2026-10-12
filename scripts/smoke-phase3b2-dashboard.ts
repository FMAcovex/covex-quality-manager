import "server-only";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { prisma } from "../src/lib/db";
import { getDashboardData } from "../src/modules/dashboard/queries";
import { getDashboardData as reference } from "./phase3b2-reference/dashboard";
import { phase3b2ComparisonFixtures } from "./phase3b2-fixtures";
import type { DashboardFilters } from "../src/modules/dashboard/domain";
import { getAlertPreview } from "../src/modules/configuration/admin-queries";
import { getAlertPreview as referenceAlerts } from "./phase3b2-reference/alerts";

const normalize = (value: Awaited<ReturnType<typeof reference>>) => {
  const { elapsedMs: _elapsed, ...result } = value;
  void _elapsed;
  return result;
};
async function main() {
  const fixture = await phase3b2ComparisonFixtures(Number(process.env.PHASE3B2_SIZE) || 1000);
  let comparisons = 0;
  try {
    const base: DashboardFilters = { module: "ALL", department: "", year: null, state: "ALL", taskView: "all", page: 1, asOf: new Date("2026-10-11T12:00:00Z") };
    const filters: DashboardFilters[] = [];
    for (const moduleKey of ["ALL", "DEVIATION", "CAPA", "CHANGE_CONTROL", "COMPLAINT", "RETURN", "AUDIT", "PNT"] as const) {
      filters.push({ ...base, module: moduleKey }, { ...base, module: moduleKey, year: 2026, department: fixture.departments[0] }, { ...base, module: moduleKey, year: 2099, department: fixture.departments[1] });
    }
    for (const state of ["OPEN", "CLOSED", "DRAFT"] as const) filters.push({ ...base, state });
    for (const taskView of ["all", "upcoming", "overdue"] as const) for (const page of [1, 2, 9999]) filters.push({ ...base, taskView, page });
    for (const date of ["2026-10-10", "2026-11-10", "2027-01-01"]) filters.push({ ...base, asOf: new Date(date) });
    for (const filter of filters) {
      assert.deepEqual(normalize(await getDashboardData(filter)), normalize(await reference(filter)), JSON.stringify(filter));
      comparisons++;
    }
    assert.deepEqual(await getAlertPreview(base.asOf), await referenceAlerts(base.asOf), "Unscoped administration alerts retain their existing scope and metadata");
    const metadataBefore = await prisma.qmsRecordVersion.findMany({ where: { qmsRecordId: { in: fixture.qmsIds } }, orderBy: { id: "asc" } });
    await getDashboardData(base);
    assert.deepEqual(await prisma.qmsRecordVersion.findMany({ where: { qmsRecordId: { in: fixture.qmsIds } }, orderBy: { id: "asc" } }), metadataBefore);
    const output = process.env.PHASE3B2_OUTPUT;
    if (output) {
      mkdirSync(output, { recursive: true });
      writeFileSync(output + "/dashboard-equivalence.json", JSON.stringify({ reference: "6745212383b1ab8def20dca418ee417115036acc", size: fixture.qmsIds.length, comparisons, asOf: base.asOf, completeResult: true, excludedField: "elapsedMs", snapshotsUnchanged: true }, null, 2));
    }
    console.log(`3B2 Dashboard: ${comparisons} complete-result comparisons passed, same filters/date/data; version snapshots unchanged.`);
  } finally { await fixture.cleanup(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
