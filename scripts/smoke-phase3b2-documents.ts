import "server-only";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
(globalThis as unknown as { prisma: PrismaClient }).prisma = prisma;
let sql: string[] = [];
prisma.$on("query", event => sql.push(event.query));

function withoutBinary(value: unknown): unknown {
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(withoutBinary);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "fileData").map(([key, item]) => [key, withoutBinary(item)]));
  return value;
}
function hasBinary(value: unknown): boolean {
  if (!value || typeof value !== "object" || value instanceof Date) return false;
  return Object.entries(value).some(([key, item]) => key === "fileData" || hasBinary(item));
}
async function main() {
  const { createPhase3b2Fixtures } = await import("./phase3b2-fixtures");
  const complaints = await import("../src/modules/complaints/queries");
  const returns = await import("../src/modules/returns/queries");
  const reference = await import("./phase3b2-reference/documents");
  const complaintPdf = await import("../src/app/api/complaints/[id]/versions/[sequence]/signed-pdf/route");
  const returnPdf = await import("../src/app/api/returns/[id]/signed-pdf/[annex]/route");
  const returnArchive = await import("../src/app/api/returns/[id]/documents/[documentId]/route");
  const templateDownload = await import("../src/app/api/settings/templates/[id]/download/route");
  const { serializeReturnVersion, serializeComplaintVersion } = await import("../src/lib/qms/versioning");
  
  const fixture = await createPhase3b2Fixtures(100);
  let downloads = 0;
  const request = new Request("http://127.0.0.1/synthetic-download");
  async function verify(response: Response) {
    assert.equal(response.status, 200);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.deepEqual(bytes, fixture.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), fixture.checksum);
    assert.equal(response.headers.get("cache-control"), "no-store");
    downloads++;
  }
  try {
    const complaintId = fixture.ids[3][1], returnId = fixture.ids[4][1];
    const oldComplaint = await reference.getComplaintDetail(complaintId);
    const oldReturn = await reference.getReturnDetail(returnId);
    assert(oldComplaint && oldReturn && hasBinary(oldComplaint) && hasBinary(oldReturn));
    sql = [];
    const complaint = await complaints.getComplaintDetail(complaintId);
    const returned = await returns.getReturnDetail(returnId);
    assert(complaint && returned);
    assert(!hasBinary(complaint) && !hasBinary(returned));
    assert(!sql.some(query => query.includes('"fileData"')), "Opening a detail must not select any fileData column");
    assert.deepEqual(complaint, withoutBinary(oldComplaint));
    assert.deepEqual(returned, withoutBinary(oldReturn));
    assert.deepEqual(serializeComplaintVersion(complaint), serializeComplaintVersion(oldComplaint));
    assert.deepEqual(serializeReturnVersion(returned), serializeReturnVersion(oldReturn), "Official annex snapshot source is identical");
    sql = [];
    await complaints.getComplaintLookups(); await returns.getReturnLookups();
    assert(!sql.some(query => query.includes('"fileData"')), "Documentary lookup metadata must not fetch binaries");
    for (const version of complaint.qmsRecord.versions) await verify(await complaintPdf.GET(request, { params: Promise.resolve({ id: complaintId, sequence: String(version.sequenceNumber) }) }));
    for (const annex of ["annex-iii", "annex-v"]) await verify(await returnPdf.GET(request, { params: Promise.resolve({ id: returnId, annex }) }));
    for (const document of returned.qmsRecord.generatedDocuments) await verify(await returnArchive.GET(request, { params: Promise.resolve({ id: returnId, documentId: document.id }) }));
    for (const id of fixture.templateIds) await verify(await templateDownload.GET(request, { params: Promise.resolve({ id }) }));
    assert.equal((await returnArchive.GET(request, { params: Promise.resolve({ id: fixture.ids[4][2], documentId: returned.qmsRecord.generatedDocuments[0].id }) })).status, 404);
    assert.equal((await complaintPdf.GET(request, { params: Promise.resolve({ id: fixture.ids[3][2], sequence: "0" }) })).status, 404);
    assert.equal((await complaintPdf.GET(request, { params: Promise.resolve({ id: complaintId, sequence: "999" }) })).status, 404);
    assert.equal((await complaintPdf.GET(request, { params: Promise.resolve({ id: complaintId, sequence: "-1" }) })).status, 400);
    assert.equal((await returnPdf.GET(request, { params: Promise.resolve({ id: returnId, annex: "unknown" }) })).status, 400);
    assert.deepEqual(withoutBinary(await reference.getComplaintDetail(complaintId)), withoutBinary(oldComplaint));
    assert.deepEqual(withoutBinary(await reference.getReturnDetail(returnId)), withoutBinary(oldReturn), "Historical versions, hashes and snapshots unchanged by viewing/downloads");
    for (const document of await prisma.recordVersionDocument.findMany({ where: { id: { in: fixture.binaryIds } } })) {
      assert.deepEqual(document.fileData, new Uint8Array(fixture.bytes));
      assert.equal(document.checksum, fixture.checksum);
    }
    console.log(`3B2 documents: no binary SQL in detail/lookups; complete metadata/snapshot equivalence; ${downloads} downloads byte-for-byte/SHA-256 identical; historical ownership and invalid selections preserved.`);
  } finally { await fixture.cleanup(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
