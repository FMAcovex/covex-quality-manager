import assert from "node:assert/strict";
import { prisma } from "../src/lib/db";
import { saveMaster } from "../src/modules/controlled-documents/service";
import { manualMaster, nextRevision, evidence, planRevision, decideLifecycle, freeCode, qaOnly, offset } from "../src/modules/controlled-documents/testing/p2c";
async function dates() {
  const { master } = await manualMaster(), r = master.revisions[0], docs = await evidence(master.id, r.id), ids = docs.map(d => d.id), final = docs.find(d => d.kind === "DOCUMENT_PDF")!;
  await planRevision(master.id, r.id, ids, final.id);
  await decideLifecycle(master.id, r.id, ids, { operation: "ACTIVATE", previousRevisionId: null });
  const next = await nextRevision(master.id, r.id), docsNext = await evidence(master.id, next), idsNext = docsNext.map(d => d.id);
  await planRevision(master.id, next, idsNext, docsNext.find(d => d.kind === "DOCUMENT_PDF")!.id);
  await decideLifecycle(master.id, next, idsNext, { operation: "ACTIVATE", previousRevisionId: r.id });
  assert.equal((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r.id } })).status, "OBSOLETE");
  assert.deepEqual((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r.id } })).effectiveFrom, r.effectiveFrom);
}
async function code() {
  const { master, input } = await manualMaster("DRAFT"), r = master.revisions[0], docs = await evidence(master.id, r.id), ids = docs.map(d => d.id);
  await decideLifecycle(master.id, r.id, ids, { result: "FAVORABLE" });
  const current = await prisma.controlledDocument.findUniqueOrThrow({ where: { id: master.id } });
  await assert.rejects(saveMaster({ ...input, baseCode: await freeCode(), updatedAt: current.updatedAt.toISOString(), changeReason: "Intento de cambiar identidad contrastada" }, master.id), /código.*permanente/i);
  assert.equal((await prisma.controlledDocument.findUniqueOrThrow({ where: { id: master.id } })).baseCode, master.baseCode);
}
async function operativeBoundary() {
  const { master } = await manualMaster("REGISTER", offset(-30)), r = master.revisions[0], docs = await evidence(master.id, r.id), ids = docs.map(d => d.id);
  await planRevision(master.id, r.id, ids, docs[1].id); await decideLifecycle(master.id, r.id, ids, { operation: "ACTIVATE", previousRevisionId: null });
  const next = await nextRevision(master.id, r.id), nextDocs = await evidence(master.id, next), nextIds = nextDocs.map(d => d.id);
  await planRevision(master.id, next, nextIds, nextDocs[1].id, offset(-1), offset(-2));
  const before = await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r.id } });
  await assert.rejects(decideLifecycle(master.id, next, nextIds, { operation: "ACTIVATE", previousRevisionId: r.id }), /Vigencia anterior incompatible/);
  assert.deepEqual(await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r.id } }), before);
}
async function frozenIdentity() {
  const { master, input } = await manualMaster("DRAFT"), r = master.revisions[0];
  // P1A legitimately allows changing an unregistered draft's code before P2B starts.
  await saveMaster({ ...input, baseCode: await freeCode(), updatedAt: master.updatedAt.toISOString(), changeReason: "Corrección P1A de borrador anterior al contraste" }, master.id);
  const docs = await evidence(master.id, r.id), ids = docs.map(d => d.id);
  await planRevision(master.id, r.id, ids, docs[1].id);
  await assert.rejects(decideLifecycle(master.id, r.id, ids, { operation: "ACTIVATE", previousRevisionId: null }), /código.*congelado/i);
  assert.equal((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r.id } })).status, "APPROVED_PENDING_EFFECTIVE");
}
async function main() {
  qaOnly(); const cases = [dates, code, operativeBoundary, frozenIdentity]; let failures = 0;
  for (const test of cases) try { await test(); console.log(`P2C defecto ${test.name}: regresión OK`); } catch (error) { failures++; console.error(`P2C defecto ${test.name}:`, error instanceof Error ? error.message : error); }
  assert.equal(failures, 0, "Regresión de fechas operativas e identidad P2B");
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
