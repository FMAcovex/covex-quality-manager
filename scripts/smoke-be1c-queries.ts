import "server-only";
import assert from "node:assert/strict";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { DashboardFilters } from "../src/modules/dashboard/domain";

// BE1-C (D-114): las dos consultas reescritas devuelven lo mismo que antes, leen mucho menos y la aplicación
// conecta con JIT desactivado.
async function main() {
  const sql: string[] = [];
  const { createAppPrismaClient } = await import("../src/lib/db-client");
  const client = createAppPrismaClient({ log: [{ emit: "event", level: "query" }], onQuery: event => sql.push(event.query) });
  (globalThis as unknown as { prisma: PrismaClient }).prisma = client;
  const { prisma } = await import("../src/lib/db");
  const { createBe1Fixtures } = await import("./be1-fixtures");
  const audits = await import("../src/modules/audits/queries");
  const dashboard = await import("../src/modules/dashboard/queries");
  const { getDashboardData: reference } = await import("./phase3b2-reference/dashboard");

  const fixture = await createBe1Fixtures(300);
  try {
    // Auditoría con 3 versiones y PDF firmado solo en la primera: no cuenta como «con PDF firmado».
    const oldOnly = fixture.ids[5][2];
    const oldOnlyQms = (await prisma.audit.findUniqueOrThrow({ where: { id: oldOnly }, select: { qmsRecordId: true } })).qmsRecordId;
    const first = await prisma.qmsRecordVersion.findFirstOrThrow({ where: { qmsRecordId: oldOnlyQms }, orderBy: { sequenceNumber: "asc" } });
    await prisma.recordVersionDocument.create({ data: { recordVersionId: first.id, kind: "SIGNED_PDF", fileName: "be1c.pdf", fileData: new Uint8Array(fixture.bytes), fileSize: fixture.bytes.length, checksum: fixture.checksum, uploadedByText: "Sintético BE1-C" } });
    const latestSigned = fixture.binaryDetail.audit;

    const referenceSigned = new Set((await prisma.$queryRaw<{ qmsRecordId: string }[]>(Prisma.sql`SELECT v."qmsRecordId" FROM (SELECT DISTINCT ON ("qmsRecordId") id, "qmsRecordId" FROM "QmsRecordVersion" ORDER BY "qmsRecordId", "sequenceNumber" DESC) v JOIN "RecordVersionDocument" d ON d."recordVersionId"=v.id AND d.kind='SIGNED_PDF'`)).map(row => row.qmsRecordId));
    sql.length = 0;
    const yes = await audits.getAuditList({ signedPdf: "yes", administrative: "ALL" });
    const used = sql.find(query => query.includes("SIGNED_PDF"));
    assert(used, "La consulta de PDF firmado se ejecuta");
    const ids = new Set(yes.rows.map(row => row.id));
    assert(ids.has(latestSigned), "Con PDF firmado en su última versión aparece");
    assert(!ids.has(oldOnly), "Con PDF solo en una versión antigua no aparece");
    const no = await audits.getAuditList({ signedPdf: "no", administrative: "ALL" });
    assert(no.rows.every(row => !ids.has(row.id)), "«Sin PDF» y «con PDF» no se solapan");
    const usedSigned = new Set((await prisma.$queryRawUnsafe<{ qmsRecordId: string }[]>(used)).map(row => row.qmsRecordId));
    assert.deepEqual([...usedSigned].sort(), [...referenceSigned].sort(), "Mismos expedientes que la consulta anterior");
    // Filas leídas de QmsRecordVersion: la consulta anterior recorría todas las versiones.
    const totalVersions = await prisma.qmsRecordVersion.count();
    // Estadísticas al día tras la carga, para que el plan no dependa de cuándo pase el autovacuum.
    await prisma.$executeRawUnsafe('ANALYZE "QmsRecordVersion", "RecordVersionDocument"');
    const plan = (await prisma.$queryRawUnsafe<Record<string, string>[]>(`EXPLAIN (ANALYZE, TIMING OFF) ${used}`)).map(row => Object.values(row)[0]);
    const read = plan.filter(line => line.includes("QmsRecordVersion")).reduce((sum, line) => {
      const m = line.match(/actual rows=(\d+) loops=(\d+)/);
      return sum + (m ? Number(m[1]) * Number(m[2]) : 0);
    }, 0);
    assert(read < totalVersions / 2, `Lee ${read} de ${totalVersions} versiones (antes, todas)`);

    // Panel: mismo resultado que la referencia de 3B2 y sin la lista de pares de la carga de `lifecycle`.
    const base = { module: "ALL", department: "", year: null, state: "ALL", taskView: "all", page: 1, asOf: new Date("2026-10-11T12:00:00Z") } as DashboardFilters;
    for (const filter of [base, { ...base, module: "PNT", department: fixture.departments[0] }, { ...base, year: 2026 }] as DashboardFilters[]) {
      sql.length = 0;
      const current = await dashboard.getDashboardData(filter);
      // La carga de `lifecycle` no debe enviar una lista de pares (documentId, revisionId) por revisión.
      // La de revisiones por documento (`documentId IN`, uno por documento) ya existía y no es lenta.
      const lifecycleSql = sql.filter(query => query.includes('"ControlledRevisionLifecycle"'));
      assert(lifecycleSql.length > 0, "El panel lee las fechas de ciclo de vida");
      const maxParams = Math.max(0, ...lifecycleSql.map(query => Math.max(0, ...[...query.matchAll(/\$(\d+)/g)].map(m => Number(m[1])))));
      assert(maxParams <= 50, `La lectura de ciclo de vida del panel no lleva más de 50 parámetros (máximo ${maxParams})`);
      const { elapsedMs: _a, ...a } = current; const { elapsedMs: _b, ...b } = await reference(filter); void _a; void _b;
      assert.deepEqual(a, b, `Panel igual que la referencia: ${JSON.stringify(filter)}`);
    }

    const [jit] = await prisma.$queryRawUnsafe<{ jit: string }[]>("SHOW jit");
    assert.equal(jit.jit, "off", "La aplicación conecta con JIT desactivado");
    console.log(`BE1-C OK: PDF firmado (${read}/${totalVersions} versiones leídas), panel equivalente, JIT desactivado.`);
  } finally {
    await fixture.cleanup();
    await client.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
