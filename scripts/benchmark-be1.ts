import "server-only";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { PrismaClient, Prisma } from "@prisma/client";
import type { DashboardFilters } from "../src/modules/dashboard/domain";

// BE1-A: misma forma que benchmark-phase3b2.ts. Ambos modos usan el cliente de la aplicación (createAppPrismaClient,
// con su extensión de autoría); «before» desactiva solo la exclusión de ficheros, así la única diferencia es D-112.
const mode = process.env.BE1_MODE === "after" ? "after" : "before";
const log: Prisma.LogDefinition[] = [{ emit: "event", level: "query" }];
let raw: PrismaClient;
let recording = false, sqlCount = 0;
const fetched: unknown[] = [];
// Se inyecta antes de importar cualquier módulo que use src/lib/db.
async function installClient() {
  const onQuery = () => { if (recording) sqlCount++; };
  const { createAppPrismaClient } = await import("../src/lib/db-client");
  raw = createAppPrismaClient({ log, onQuery, omitBinaries: mode === "after" });
  const instrumented = raw.$extends({ query: {
    async $allOperations({ args, query }) {
      const result = await query(args);
      if (recording) fetched.push(result);
      return result;
    },
  } });
  (globalThis as unknown as { prisma: PrismaClient }).prisma = instrumented as unknown as PrismaClient;
}

function binaryBytes(value: unknown): number {
  if (value instanceof Uint8Array) return value.byteLength;
  if (!value || typeof value !== "object" || value instanceof Date) return 0;
  return Object.values(value).reduce<number>((sum, item) => sum + binaryBytes(item), 0);
}
function metadataBytes(value: unknown) {
  return Buffer.byteLength(JSON.stringify(value, (_key, item: unknown) => item instanceof Uint8Array ? { binaryLength: item.byteLength } : typeof item === "bigint" ? String(item) : item) ?? "");
}
async function measure(fn: () => Promise<unknown>) {
  await fn();
  const samples = [];
  for (let trial = 0; trial < 3; trial++) {
    fetched.length = 0; sqlCount = 0;
    global.gc?.();
    const rss = process.memoryUsage().rss;
    recording = true;
    const started = performance.now();
    await fn();
    const ms = performance.now() - started;
    recording = false;
    samples.push({ ms, sqlCount, materializedMetadataBytes: fetched.reduce<number>((sum, row) => sum + metadataBytes(row), 0),
      materializedBinaryBytes: fetched.reduce<number>((sum, row) => sum + binaryBytes(row), 0), rssDeltaMiB: (process.memoryUsage().rss - rss) / 1048576 });
  }
  fetched.length = 0;
  samples.sort((a, b) => a.ms - b.ms);
  return { median: samples[1], samples };
}

const custodyTables = ["TemplateVersion", "RecordVersionDocument", "GeneratedDocument", "ControlledRevisionDocument", "AuditAnnualProgrammeVersion", "AuditCapaPlanVersion", "AuditTrailExport"];
async function custody() {
  const rows = [];
  for (const table of custodyTables) {
    const [row] = await raw.$queryRawUnsafe<{ rows: bigint; total: bigint | null; p95: number | null }[]>(
      `SELECT count(*) AS rows, sum(octet_length("fileData")) AS total, percentile_cont(0.95) WITHIN GROUP (ORDER BY octet_length("fileData")) AS p95 FROM "${table}"`);
    rows.push({ model: table, rows: Number(row.rows), totalBytes: Number(row.total ?? 0), p95Bytes: Math.round(row.p95 ?? 0) });
  }
  return rows;
}

async function main() {
  assert.equal(process.env.BE1_BENCHMARK, "1", "Modo de medición sintética explícito obligatorio");
  const output = process.env.BE1_OUTPUT;
  assert(output, "BE1_OUTPUT obligatorio");
  mkdirSync(output, { recursive: true });
  await installClient();
  const { assertPhase3b2Database } = await import("./phase3b2-fixtures");
  const { createBe1Fixtures } = await import("./be1-fixtures");
  const isolation = assertPhase3b2Database();
  const deviations = await import("../src/modules/deviations/queries");
  const capa = await import("../src/modules/capa/queries");
  const changes = await import("../src/modules/change-control/queries");
  const complaints = await import("../src/modules/complaints/queries");
  const returns = await import("../src/modules/returns/queries");
  const audits = await import("../src/modules/audits/queries");
  const oos = await import("../src/modules/oos/queries");
  const pnt = await import("../src/modules/controlled-documents/listing");
  const dashboard = await import("../src/modules/dashboard/queries");
  const sizes = (process.env.BE1_SIZES ?? "1000,5000,20000").split(",").map(Number);
  const results: unknown[] = [];
  for (const size of sizes) {
    const fixture = await createBe1Fixtures(size);
    try {
      const lot = `${fixture.prefix}-X`, d = fixture.binaryDetail;
      const cases: [string, () => Promise<unknown>][] = [
        ["list-deviations", () => deviations.getDeviationList({})],
        ["list-capa", () => capa.getCapaList({})],
        ["list-changes", () => changes.getChangeControlList({})],
        ["list-complaints", () => complaints.getComplaintList({})],
        ["list-complaints-lot", () => complaints.getComplaintList({ q: lot })],
        ["list-returns", () => returns.getReturnList({})],
        ["list-returns-followup-due", () => returns.getReturnList({ followup: "DUE" })],
        ["list-audits", () => audits.getAuditList({})],
        ["list-audits-signed-pdf", () => audits.getAuditList({ signedPdf: "yes" })],
        ["list-oos", () => oos.getOosList({})],
        ["list-oos-lot", () => oos.getOosList({ q: lot })],
        ["list-pnt", () => pnt.queryPntListing({ q: fixture.prefix })],
        ["detail-deviation", () => deviations.getDeviationDetail(d.deviation)],
        ["detail-capa", () => capa.getCapaDetail(d.capa)],
        ["detail-change", () => changes.getChangeControlDetail(d.change)],
        ["detail-complaint", () => complaints.getComplaintDetail(fixture.ids[3][1])],
        ["detail-return", () => returns.getReturnDetail(fixture.ids[4][1])],
        ["detail-audit", () => audits.getAuditDetail(d.audit)],
        ["detail-oos", () => oos.getOosDetail(d.oos)],
        ["form-deviation", () => deviations.getDeviationFormLookups()],
        ["form-capa", () => capa.getCapaLookups()],
        ["form-change", () => changes.getChangeControlLookups()],
        ["dashboard", () => dashboard.getDashboardData({ module: "ALL", year: null, department: "", state: "ALL", taskView: "all", page: 1, asOf: new Date("2026-10-11T12:00:00Z") } as DashboardFilters)],
      ];
      for (const [name, run] of cases) results.push({ mode, size, name, ...(await measure(run)) });
      writeFileSync(`${output}/custody-${size}.json`, JSON.stringify(await custody(), null, 2));
      writeFileSync(`${output}/benchmark-${mode}.json`, JSON.stringify({ isolation, node: process.version, mode,
        method: "Cohorte 3B2 (total QMS repartido entre seis módulos) + OOS en la misma proporción; 1 calentamiento y 3 muestras secuenciales, mediana", results }, null, 2));
      console.log(JSON.stringify({ mode, measured: size, cases: cases.length }));
    } finally {
      await fixture.cleanup();
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => raw?.$disconnect());
