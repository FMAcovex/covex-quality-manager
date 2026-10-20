import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/lib/db";
import { getDeviationList } from "../src/modules/deviations/queries";
import { getCapaList } from "../src/modules/capa/queries";
import { getChangeControlList } from "../src/modules/change-control/queries";
import { getAuditList } from "../src/modules/audits/queries";
import { getDeviationExportRows } from "../src/modules/deviations/documents/export-data";
import { getCapaExportRows } from "../src/modules/capa/documents/export-data";
import { getChangeControlExportRows } from "../src/modules/change-control/documents/export-data";
import { assertSyntheticDatabase, createListFixtures } from "./phase3b1-fixtures";

type ListResult = { rows: { id: string; qmsRecordId: string; reviewCounts: { pending: number; accepted: number } }[]; pagination: { page: number; pageCount: number; total: number }; counters: unknown };
type List = (filters: { q?: string; page?: string; administrative?: string; year?: string[]; department?: string[]; status?: string[]; review?: string; followup?: string }) => Promise<ListResult>;
async function allPages(list: List, filters: Parameters<List>[0]) {
  const first = await list(filters), rows = [...first.rows];
  for (let page = 2; page <= first.pagination.pageCount; page++) {
    const next = await list({ ...filters, page: String(page) });
    assert.equal(next.pagination.total, first.pagination.total);
    assert.deepEqual(next.counters, first.counters, "Indicadores independientes de la página");
    rows.push(...next.rows);
  }
  assert.equal(rows.length, first.pagination.total);
  assert.equal(new Set(rows.map(r => r.id)).size, rows.length, "Sin duplicados ni pérdidas entre páginas");
  return rows;
}

async function main() {
  assertSyntheticDatabase();
  if (process.env.PHASE3B1_POOL_ONLY === "1") {
    assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get("connection_limit"), "1");
    const result = await getAuditList({ q: process.env.PHASE3B1_FIXTURE_PREFIX });
    assert.equal(result.total, 7);
    assert(result.rows.some(r => r.reviewCounts.pending === 1 && r.reviewCounts.accepted === 1));
    console.log("3B1 pool=1: listado y recuentos Review dentro de la transacción, sin ampliar timeout.");
    return;
  }
  const lists: List[] = [getDeviationList, getCapaList, getChangeControlList];
  const baselineCounters = await Promise.all(lists.map(list => list({ q: "no-fixtures-yet" }).then(r => r.counters as Record<string, number>)));
  const fixture = await createListFixtures();
  try {
    const preservedState = () => Promise.all([
      prisma.qmsRecord.findMany({ where: { id: { in: fixture.owned } }, orderBy: { id: "asc" } }),
      prisma.qmsRecordVersion.findMany({ where: { qmsRecordId: { in: fixture.owned } }, orderBy: { id: "asc" } }),
      prisma.qmsRelation.findMany({ where: { sourceRecordId: { in: fixture.owned } }, orderBy: { id: "asc" } }),
      prisma.changeHistory.findMany({ where: { qmsRecordId: { in: fixture.owned } }, orderBy: { id: "asc" } }),
    ]);
    const originalState = await preservedState();
    const base = { q: fixture.prefix, department: fixture.departments, year: ["2025", "2026"] };
    for (let m = 0; m < lists.length; m++) {
      const list = lists[m], first = await list(base), rows = await allPages(list, base);
      assert.equal(first.rows.length, 25);
      assert.equal(first.pagination.total, fixture.size - 1);
      assert.deepEqual(new Set(rows.map(r => r.id)), new Set(fixture.ids[m].slice(0, -1)));
      assert.deepEqual((await list(base)).rows.map(r => r.id), first.rows.map(r => r.id), "Orden estable con fechas empatadas");
      const last = await list({ ...base, page: "999999" });
      assert.equal(last.pagination.page, first.pagination.pageCount);
      assert.equal(last.rows.length, (fixture.size - 1) % 25);
      const counters = first.counters as Record<string, number>;
      assert.equal(counters.total - baselineCounters[m].total, fixture.size - 2);
      assert.equal(counters.drafts - baselineCounters[m].drafts, 1);
      assert.equal(counters.open - baselineCounters[m].open, fixture.size - 3);
      assert.deepEqual((await list({ ...base, q: "no-match", page: "99" })).counters, first.counters);
      const all = await list({ ...base, administrative: "ALL" }), annulled = await list({ ...base, administrative: "ANNULLED" });
      assert.equal(all.pagination.total, fixture.size);
      assert.equal(annulled.pagination.total, 1);
      // D-117 (H-15): los contadores son totales del módulo y nunca cuentan anulados, sea cual sea el filtro administrativo.
      assert.deepEqual(all.counters, first.counters);
      assert.deepEqual(annulled.counters, first.counters);
      const combined = await allPages(list, { ...base, year: ["2025"], department: [fixture.departments[1]], status: ["OPEN", "CLOSED"] });
      assert.equal(combined.length, 179);
      assert.equal((await list({ ...base, status: ["DRAFT"] })).pagination.total, 1);
      const review = await list({ ...base, review: "ACTIVE" });
      assert.equal(review.pagination.total, 1);
      assert.deepEqual(review.rows[0].reviewCounts, { pending: 1, accepted: 1 });
      assert.equal((await list({ ...base, review: "NONE" })).pagination.total, fixture.size - 2);
      assert.equal((await list({ ...base, review: "PENDING" })).pagination.total, 1);
      assert.equal((await list({ ...base, review: "ACCEPTED" })).pagination.total, 1);
      console.log(`3B1 módulo ${m}: ${rows.length} coincidencias, ${first.pagination.pageCount} páginas completas, filtros combinados/administración/Review estables.`);
    }
    const oldFirst300 = await prisma.capa.findMany({ where: { departmentId: { in: fixture.departments } }, orderBy: [{ status: "asc" }, { openedAt: "desc" }, { createdAt: "desc" }], take: 300, select: { id: true } });
    assert(!oldFirst300.some(r => r.id === fixture.ids[1][333]));
    const scheduled = await allPages(getCapaList, { ...base, followup: "scheduled" });
    assert(scheduled.some(r => r.id === fixture.ids[1][333]), "CAPA programada fuera de los primeros 300 recuperada");
    for (const [followup, where] of [["due", { lte: new Date() }], ["scheduled", { gt: new Date() }], ["none", null]] as const) {
      const expected = await prisma.capa.count({ where: { departmentId: { in: fixture.departments }, qmsRecord: { isActive: true }, nextFollowupDate: where } });
      assert.equal((await getCapaList({ ...base, followup })).pagination.total, expected);
    }
    const visibleCapa = await getCapaList({ q: `${fixture.prefix}-1-00000` });
    assert.equal(visibleCapa.rows[0].qmsRecord.versions[0].sequenceNumber, 2);
    assert(!("snapshot" in visibleCapa.rows[0].qmsRecord.versions[0]));
    assert(!("followups" in visibleCapa.rows[0]));
    assert.equal(visibleCapa.rows[0].plannedActions.length, 2);
    assert.equal(visibleCapa.rows[0].qmsRecord.targetRelations.length, 1);
    assert.equal((await getCapaList({ q: `${fixture.prefix}-1-00001` })).rows[0].qmsRecord.targetRelations.length, 0, "Relación retirada excluida");
    const change = await getChangeControlList({ q: `${fixture.prefix}-2-00000` });
    assert.equal(change.rows[0].followups.length, 1);
    assert.equal(change.rows[0].followups[0].nextFollowupDate, null, "Último seguimiento en blanco no recupera fecha anterior");
    assert.equal(change.rows[0].tasks[0].description, `${fixture.prefix} tarea visible`);
    for (const [list, key] of [[getDeviationList, "followupDue"], [getChangeControlList, "overdue"], [getCapaList, "overdueFollowups"]] as const) {
      const m = list === getDeviationList ? 0 : list === getCapaList ? 1 : 2;
      const result = await list(base);
      assert.equal((result.counters as Record<string, number>)[key] - baselineCounters[m][key], 120, "Vencimientos globales respetan última fecha/null y ámbito activo");
    }
    const auditIds = async (filters: { nextReviewFrom?: string; nextReviewTo?: string }) => (await getAuditList({ q: fixture.prefix, ...filters })).rows.map(r => r.id).sort();
    assert.deepEqual(await auditIds({ nextReviewFrom: "2026-02-01", nextReviewTo: "2026-02-28" }), [fixture.audits[1], fixture.audits[3]].sort());
    assert.deepEqual(await auditIds({ nextReviewFrom: "2026-03-01" }), [fixture.audits[4], fixture.audits[5]].sort());
    assert.deepEqual(await auditIds({ nextReviewTo: "2026-02-01" }), [fixture.audits[1]]);
    assert.deepEqual(await auditIds({ nextReviewFrom: "2026-02-28", nextReviewTo: "2026-02-28" }), [fixture.audits[3]]);
    assert.equal((await getAuditList({ q: fixture.prefix })).total, 7);
    for (const filters of [{ nextReviewFrom: "2026-02-31" }, { nextReviewTo: "2026-13-01" }, { nextReviewFrom: "2026-03-01", nextReviewTo: "2026-02-01" }]) {
      const invalid = await getAuditList({ q: fixture.prefix, ...filters });
      assert.equal(invalid.total, 0); assert(invalid.errors.length > 0);
    }
    const poolUrl = new URL(process.env.DATABASE_URL!); poolUrl.searchParams.set("connection_limit", "1");
    const pool = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", fileURLToPath(import.meta.url)], { encoding: "utf8", timeout: 20000, env: { ...process.env, DATABASE_URL: poolUrl.href, PHASE3B1_POOL_ONLY: "1", PHASE3B1_FIXTURE_PREFIX: fixture.prefix } });
    assert.equal(pool.status, 0, pool.error?.message ?? pool.stdout + pool.stderr); process.stdout.write(pool.stdout);
    for (const exportRows of [getDeviationExportRows, getCapaExportRows, getChangeControlExportRows]) {
      const rows = await exportRows({ department: fixture.departments, year: ["2025", "2026"] });
      assert.equal(rows.length, fixture.size - 2, "Exportación completa de activas no borrador, sin take/skip");
      assert(rows.length > 300); assert(new Set(rows.map(r => r.id)).size === rows.length);
      assert.equal((await exportRows({ department: fixture.departments, status: ["DRAFT"] })).length, 0);
    }
    assert.deepEqual(await preservedState(), originalState, "Consultas/exportaciones conservan UUID, códigos, anulación, snapshots congelados, relaciones e historial");
    console.log("3B1 PostgreSQL OK: 1080 expedientes + Auditorías, filtros fuera de 300, últimas fechas/ámbitos, pool=1, Review, exportaciones y snapshots intactos.");
  } finally { await fixture.cleanup(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
