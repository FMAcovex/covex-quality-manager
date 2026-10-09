import assert from "node:assert/strict";
import { prisma } from "../src/lib/db";
import { saveMaster } from "../src/modules/controlled-documents/service";
import { manualMaster, nextRevision, evidence, planRevision, decideLifecycle, freeCode, qaOnly, offset, externalRole, today } from "../src/modules/controlled-documents/testing/p2c";
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
async function titleIdentity() {
  const { master, input } = await manualMaster(), r = master.revisions[0], docs = await evidence(master.id, r.id), ids = docs.map(d => d.id);
  await decideLifecycle(master.id, r.id, ids, { result: "FAVORABLE" });
  const current = await prisma.controlledDocument.findUniqueOrThrow({ where: { id: master.id } });
  await saveMaster({ ...input, operation: "EDIT", title: "Título B posterior al contraste", updatedAt: current.updatedAt.toISOString(), changeReason: "Cambio legítimo del maestro, no de la revisión congelada" }, master.id);
  await externalRole(master.id, r.id, ids, "PREPARATION"); await externalRole(master.id, r.id, ids, "REVIEW");
  await decideLifecycle(master.id, r.id, ids, { operation: "SUBMIT" }); await externalRole(master.id, r.id, ids, "APPROVAL");
  await decideLifecycle(master.id, r.id, ids, { operation: "PLAN", finalDocumentId: docs[1].id, effectiveFrom: today, reviewDueAt: offset(365), separationConfirmed: true });
  const read = () => prisma.controlledDocument.findUniqueOrThrow({ where: { id: master.id }, include: { revisions: { include: { lifecycle: true, decisions: { include: { evidence: true } } } }, changes: true } });
  const before = await read();
  await assert.rejects(decideLifecycle(master.id, r.id, ids, { operation: "ACTIVATE", previousRevisionId: null }), /título.*congelado/i);
  assert.deepEqual(await read(), before); // No vigencia, decisión ni historial parcial.
  assert.equal((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r.id } })).titleSnapshot, r.titleSnapshot);
  // Resolve explicitly by a new revision, never by rewriting the contrasted snapshot.
  await decideLifecycle(master.id, r.id, ids, { operation: "ANNUL" });
  const next = await nextRevision(master.id, r.id), nextDocs = await evidence(master.id, next), nextIds = nextDocs.map(d => d.id);
  await planRevision(master.id, next, nextIds, nextDocs[1].id);
  await decideLifecycle(master.id, next, nextIds, { operation: "ACTIVATE", previousRevisionId: null });
  assert.equal((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: next } })).titleSnapshot, "Título B posterior al contraste");
  const old = await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r.id } });
  assert.equal(old.status, "ANNULLED"); assert.equal(old.titleSnapshot, r.titleSnapshot);
}
async function departmentIdentity() {
  for (const change of [{ departmentCodeSnapshot: "MC-20" }, { departmentNameSnapshot: "Departamento QA distinto" }]) {
    const { master } = await manualMaster(), r = master.revisions[0], docs = await evidence(master.id, r.id), ids = docs.map(d => d.id);
    await planRevision(master.id, r.id, ids, docs[1].id);
    // Synthetic master corruption only: P1A already rejects incompatible AB-XX families.
    await prisma.controlledDocument.update({ where: { id: master.id }, data: change });
    const before = await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r.id } });
    const count = await prisma.controlledRevisionDecision.count({ where: { revisionId: r.id } });
    await assert.rejects(decideLifecycle(master.id, r.id, ids, { operation: "ACTIVATE", previousRevisionId: null }), /departamento.*congelado/i);
    assert.deepEqual(await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r.id } }), before);
    assert.equal(await prisma.controlledRevisionDecision.count({ where: { revisionId: r.id } }), count);
  }
}
async function titleEvolution() {
  const { master, input } = await manualMaster(), r = master.revisions[0], docs = await evidence(master.id, r.id), ids = docs.map(d => d.id);
  await planRevision(master.id, r.id, ids, docs[1].id); await decideLifecycle(master.id, r.id, ids, { operation: "ACTIVATE", previousRevisionId: null });
  const original = await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r.id } });
  const decisions = await prisma.controlledRevisionDecision.findMany({ where: { revisionId: r.id }, orderBy: { sequence: "asc" }, include: { evidence: true } });
  const objects = await prisma.controlledRevisionDocument.findMany({ where: { revisionId: r.id }, orderBy: { id: "asc" } });
  const current = await prisma.controlledDocument.findUniqueOrThrow({ where: { id: master.id } }), title = "Título B de evolución documental normal";
  await saveMaster({ ...input, operation: "EDIT", title, updatedAt: current.updatedAt.toISOString(), changeReason: "Título para la nueva revisión, histórico conservado" }, master.id);
  assert.deepEqual(await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r.id } }), original);
  assert.equal(await prisma.controlledDocumentRevision.count({ where: { documentId: master.id } }), 1);
  const next = await nextRevision(master.id, r.id), nextDocs = await evidence(master.id, next), nextIds = nextDocs.map(d => d.id);
  assert.equal((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: next } })).titleSnapshot, title);
  await planRevision(master.id, next, nextIds, nextDocs[1].id); await decideLifecycle(master.id, next, nextIds, { operation: "ACTIVATE", previousRevisionId: r.id });
  const old = await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r.id } });
  assert.equal(old.status, "OBSOLETE");
  for (const key of ["baseCodeSnapshot", "titleSnapshot", "departmentCodeSnapshot", "departmentNameSnapshot", "sourceMetadata", "effectiveFrom", "reviewDueAt"] as const) assert.deepEqual(old[key], original[key]);
  assert.deepEqual(await prisma.controlledRevisionDecision.findMany({ where: { id: { in: decisions.map(d => d.id) } }, orderBy: { sequence: "asc" }, include: { evidence: true } }), decisions);
  assert.deepEqual(await prisma.controlledRevisionDocument.findMany({ where: { revisionId: r.id }, orderBy: { id: "asc" } }), objects);
  assert.equal(await prisma.controlledDocumentRevision.count({ where: { documentId: master.id, status: "IN_FORCE" } }), 1);
}
async function main() {
  qaOnly(); const cases = [dates, code, operativeBoundary, frozenIdentity, titleIdentity, departmentIdentity, titleEvolution]; let failures = 0;
  for (const test of cases) try { await test(); console.log(`P2C defecto ${test.name}: regresión OK`); } catch (error) { failures++; console.error(`P2C defecto ${test.name}:`, error instanceof Error ? error.message : error); }
  assert.equal(failures, 0, "Regresión de fechas operativas e identidad P2B");
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
