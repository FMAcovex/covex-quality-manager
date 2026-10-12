import "server-only";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import type { DashboardFilters } from "../src/modules/dashboard/domain";

const client = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
let recording = false, sqlCount = 0;
const fetched: unknown[] = [];
client.$on("query", () => { if (recording) sqlCount++; });
const prisma = client.$extends({ query: {
  async $allOperations({ args, query }) {
    const result = await query(args);
    if (recording) fetched.push(result);
    return result;
  },
} });
(globalThis as unknown as { prisma: PrismaClient }).prisma = prisma as unknown as PrismaClient;

function binaryBytes(value: unknown): number {
  if (value instanceof Uint8Array) return value.byteLength;
  if (!value || typeof value !== "object" || value instanceof Date) return 0;
  return Object.values(value).reduce<number>((sum, item) => sum + binaryBytes(item), 0);
}
function metadataBytes(value: unknown) {
  return Buffer.byteLength(JSON.stringify(value, (_key, item: unknown) => item instanceof Uint8Array ? { binaryLength: item.byteLength } : typeof item === "bigint" ? String(item) : item));
}
async function measure(fn: () => Promise<unknown>) {
  await fn();
  const samples = [];
  for (let trial = 0; trial < 3; trial++) {
    fetched.length = 0; sqlCount = 0;
    global.gc?.();
    const rss = process.memoryUsage().rss;
    recording = true;
    const started = performance.now(), result = await fn(), ms = performance.now() - started;
    recording = false;
    const rssDeltaMiB = (process.memoryUsage().rss - rss) / 1048576;
    samples.push({ ms, sqlCount, materializedMetadataBytes: fetched.reduce<number>((sum, row) => sum + metadataBytes(row), 0),
      materializedBinaryBytes: fetched.reduce<number>((sum, row) => sum + binaryBytes(row), 0), resultMetadataBytes: metadataBytes(result), rssDeltaMiB });
  }
  fetched.length = 0;
  samples.sort((a, b) => a.ms - b.ms);
  return { median: samples[1], samples };
}
async function http(url: string) {
  const samples = [];
  for (let i = 0; i < 4; i++) {
    const started = performance.now(), response = await fetch(url);
    const body = await response.arrayBuffer();
    assert(response.ok);
    if (i) samples.push({ ms: performance.now() - started, bytes: body.byteLength });
  }
  samples.sort((a, b) => a.ms - b.ms);
  return samples[1];
}
async function main() {
  assert.equal(process.env.PHASE3B2_BENCHMARK, "1", "Explicit synthetic benchmark mode required");
  const output = process.env.PHASE3B2_OUTPUT;
  assert(output);
  mkdirSync(output, { recursive: true });
  const { createPhase3b2Fixtures, assertPhase3b2Database } = await import("./phase3b2-fixtures");
  const isolation = assertPhase3b2Database();
  const dashboard = await import("../src/modules/dashboard/queries");
  const dashboardReference = await import("./phase3b2-reference/dashboard");
  const pnt = await import("../src/modules/controlled-documents/listing");
  const pntReference = await import("./phase3b2-reference/pnt");
  const complaints = await import("../src/modules/complaints/queries");
  const returns = await import("../src/modules/returns/queries");
  const docReference = await import("./phase3b2-reference/documents");
  const results: unknown[] = [];
  for (const size of [100, 1000, 5000, 20000]) {
    const fixture = await createPhase3b2Fixtures(size);
    const base: DashboardFilters = { module: "ALL", year: null, department: "", state: "ALL", taskView: "all", page: 1, asOf: new Date("2026-10-11T12:00:00Z") };
    try {
      for (const [name, filter] of [["dashboard-all", base], ["dashboard-filter", { ...base, module: "CAPA", year: 2026, department: fixture.departments[0] }]] as const) {
        const old = await dashboardReference.getDashboardData(filter), current = await dashboard.getDashboardData(filter);
        const { elapsedMs: _old, ...oldValue } = old, { elapsedMs: _new, ...newValue } = current;
        void _old; void _new; assert.deepEqual(newValue, oldValue);
        results.push({ size, name, before: await measure(() => dashboardReference.getDashboardData(filter)), after: await measure(() => dashboard.getDashboardData(filter)), equivalence: true });
      }
      for (const [name, filters] of [["pnt-first", { q: fixture.prefix }], ["pnt-last", { q: fixture.prefix, page: "99999" }], ["pnt-latest-overdue", { q: fixture.prefix, view: "latest", quick: "overdue" }]] as const)
        results.push({ size, masters: fixture.masterSize, name, before: await measure(() => pntReference.queryPntListing(filters)), after: await measure(() => pnt.queryPntListing(filters)) });
      for (const [name, before, after] of [
        ["complaint-documents", () => docReference.getComplaintDetail(fixture.ids[3][1]), () => complaints.getComplaintDetail(fixture.ids[3][1])],
        ["return-documents", () => docReference.getReturnDetail(fixture.ids[4][1]), () => returns.getReturnDetail(fixture.ids[4][1])],
      ] as const) results.push({ size, name, before: await measure(before), after: await measure(after) });
      if (size === 20000 && process.env.PHASE3B2_BASELINE_URL) {
        const url = process.env.PHASE3B2_BASELINE_URL;
        assert(new URL(url).hostname === "127.0.0.1");
        const routes = ["/", "/?module=CAPA&year=2026&department=" + fixture.departments[0], "/controlled-documents?q=" + fixture.prefix, "/controlled-documents?q=" + fixture.prefix + "&page=99999"];
        const values = [];
        for (const route of routes) values.push({ route, before: await http(url + route) });
        writeFileSync(output + "/http-before.json", JSON.stringify(values, null, 2));
      }
      writeFileSync(output + "/benchmark.json", JSON.stringify({ reference: "6745212383b1ab8def20dca418ee417115036acc", isolation, node: process.version, method: "One warmup plus 3 sequential samples/median, fixed asOf 2026-10-11; PostgreSQL 16, 1 CPU/1 GiB, pool 4. Materialized metadata JSON is a size estimate; RSS delta is approximate, not retained heap or wire bytes.", results }, null, 2));
      console.log(JSON.stringify({ measured: size, masters: fixture.masterSize, results: results.slice(-7) }));
      if (size === 20000 && process.env.PHASE3B2_KEEP_FIXTURES === "1") {
        writeFileSync(output + "/benchmark-fixture.json", JSON.stringify({ prefix: fixture.prefix, departments: fixture.departments, ids: fixture.ids.map(rows => rows.slice(0, 3)), checksum: fixture.checksum, size, masters: fixture.masterSize }, null, 2));
        console.log("Retained only the disposable 20k cohort for identical before/after HTTP measurements.");
      } else await fixture.cleanup();
    } catch (error) { await fixture.cleanup(); throw error; }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => client.$disconnect());
