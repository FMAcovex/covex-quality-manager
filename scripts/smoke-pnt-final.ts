import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { saveRevision } from "../src/modules/controlled-documents/service";
import { parseRevisionForm } from "../src/modules/controlled-documents/domain";
import { changeManualRevisionStatus } from "../src/modules/controlled-documents/manual-state/service";
import { manualMaster, evidence, form, qaOnly, qaPrincipal, today, offset, decideLifecycle, planRevision } from "../src/modules/controlled-documents/testing/p2c";
async function state(documentId: string, revisionId: string, targetStatus: string) {
  const r = await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: revisionId }, include: { lifecycle: true } });
  return changeManualRevisionStatus(documentId, revisionId, { requestId: randomUUID(), expectedVersion: r.lifecycle?.version || 0,
    expectedUpdatedAt: r.updatedAt.toISOString(), targetStatus, reason: "Regresión sintética PNT final",
    ...(targetStatus === "IN_FORCE" ? { effectiveFrom: today, reviewDueAt: offset(365), previousRevisionId: null } : {}),
  }, qaPrincipal);
}
async function input(revisionId: string, extra: Record<string, string> = {}) {
  const r = await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: revisionId } });
  return parseRevisionForm(form({ operation: "DRAFT", revisionCode: r.revisionCode, actor: "QA final", changeReason: "Corregir borrador devuelto",
    revisionReason: "Contenido corregido QA", updatedAt: r.updatedAt.toISOString(), ...extra }));
}
async function archive(documentId: string) {
  return {
    documents: await prisma.controlledRevisionDocument.findMany({ where: { documentId }, orderBy: { id: "asc" } }),
    decisions: await prisma.controlledRevisionDecision.findMany({ where: { documentId }, orderBy: { id: "asc" }, include: { evidence: { orderBy: { id: "asc" } } } }),
    changes: await prisma.controlledDocumentChange.findMany({ where: { documentId }, orderBy: { id: "asc" } }),
  };
}
async function protectedEdit(documentId: string, revisionId: string) {
  const before = await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: revisionId } }), files = await archive(documentId);
  await assert.rejects(saveRevision(documentId, await input(revisionId), revisionId), /no admite edición/);
  assert.deepEqual(await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: revisionId } }), before);
  assert.deepEqual(await archive(documentId), files);
}
async function main() {
  qaOnly();
  const { master } = await manualMaster(), r = master.revisions[0], files = await evidence(master.id, r.id);
  await state(master.id, r.id, "IN_REVIEW"); await state(master.id, r.id, "DRAFT");
  const before = await archive(master.id), projection = await prisma.controlledRevisionLifecycle.findUniqueOrThrow({ where: { revisionId: r.id } });
  const stale = await input(r.id); await saveRevision(master.id, stale, r.id);
  const after = await archive(master.id);
  assert.deepEqual(after.documents, before.documents); assert.deepEqual(after.decisions, before.decisions);
  assert.deepEqual(after.changes.filter(c => before.changes.some(b => b.id === c.id)), before.changes);
  assert.equal(after.changes.length, before.changes.length + 1);
  const edited = await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r.id } });
  assert.equal(edited.status, "DRAFT"); assert.equal(edited.consolidatedAt, null); assert.equal(edited.revisionReason, "Contenido corregido QA");
  assert.deepEqual(await prisma.controlledRevisionLifecycle.findUniqueOrThrow({ where: { revisionId: r.id } }), { ...projection, version: projection.version + 1 });
  await assert.rejects(saveRevision(master.id, stale, r.id), /ha cambiado/);
  await assert.rejects(saveRevision(master.id, await input(r.id, { existingDocument: "on", verified: "on", sourceReference: "QA", effectiveFrom: today }), r.id), /no se convierte/);
  await decideLifecycle(master.id, r.id, files.map(f => f.id), { result: "FAVORABLE" });
  await state(master.id, r.id, "DRAFT");
  const verified = await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r.id } }), verifiedArchive = await archive(master.id);
  await saveRevision(master.id, await input(r.id), r.id);
  const changed = await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r.id } });
  assert.equal(changed.verificationStatus, "REVIEW_REQUIRED"); assert.deepEqual(changed.verifiedAt, verified.verifiedAt); assert.equal(changed.verifiedByText, verified.verifiedByText);
  assert.deepEqual((await archive(master.id)).decisions, verifiedArchive.decisions);
  await state(master.id, r.id, "IN_REVIEW");
  await assert.rejects(decideLifecycle(master.id, r.id, files.map(f => f.id), { operation: "SUBMIT" }), /contenido actual/);
  await state(master.id, r.id, "APPROVED_PENDING_EFFECTIVE"); await protectedEdit(master.id, r.id);
  await state(master.id, r.id, "DRAFT"); await protectedEdit(master.id, r.id);
  const approved = (await manualMaster()).master, ar = approved.revisions[0], af = await evidence(approved.id, ar.id);
  await planRevision(approved.id, ar.id, af.map(f => f.id), af[2].id);
  await state(approved.id, ar.id, "DRAFT"); await protectedEdit(approved.id, ar.id);
  const live = (await manualMaster()).master, lr = live.revisions[0];
  await evidence(live.id, lr.id); await state(live.id, lr.id, "IN_FORCE"); await protectedEdit(live.id, lr.id);
  await state(live.id, lr.id, "OBSOLETE"); await protectedEdit(live.id, lr.id);
  console.log("PNT final PostgreSQL OK: retorno a Borrador/editado, concurrencia, contraste del contenido actual, aprobadas/consolidadas/vigentes/obsoletas bloqueadas; bytes, enlaces de evidencia, decisiones e histórico preservados.");
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
