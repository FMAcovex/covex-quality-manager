import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { manualMaster, nextRevision, qaPrincipal, qaOnly, today, offset } from "../src/modules/controlled-documents/testing/p2c";
import { changeManualRevisionStatus } from "../src/modules/controlled-documents/manual-state/service";

async function change(id: string, revisionId: string, targetStatus: string, previousRevisionId: string | null = null) {
  const r = await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: revisionId } });
  const projection = await prisma.controlledRevisionLifecycle.findUnique({ where: { revisionId } });
  return changeManualRevisionStatus(id, revisionId, {
    requestId: randomUUID(), expectedVersion: projection?.version || 0,
    expectedUpdatedAt: r.updatedAt.toISOString(), targetStatus, reason: "Registro manual sintético respaldado por documentación QA",
    ...(targetStatus === "IN_FORCE" ? { effectiveFrom: today, reviewDueAt: offset(365), previousRevisionId } : {}),
  }, qaPrincipal);
}
async function main() {
  qaOnly();
  const { master } = await manualMaster();
  const first = master.revisions[0];
  await change(master.id, first.id, "IN_REVIEW");
  await change(master.id, first.id, "APPROVED_PENDING_EFFECTIVE");
  await change(master.id, first.id, "IN_FORCE");
  assert.equal((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: first.id } })).status, "IN_FORCE");
  const second = await nextRevision(master.id, first.id);
  await change(master.id, second, "IN_FORCE", first.id);
  const [before, after] = await Promise.all([
    prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: first.id } }),
    prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: second } }),
  ]);
  assert.equal(before.status, "OBSOLETE"); assert.equal(after.status, "IN_FORCE");
  assert.equal(await prisma.controlledDocumentRevision.count({ where: { documentId: master.id, status: "IN_FORCE" } }), 1);
  const decisions = await prisma.controlledRevisionDecision.findMany({ where: { documentId: master.id, operation: "MANUAL_STATUS" } });
  assert.equal(decisions.length, 4); assert.equal(decisions.every(d => d.identitySource === "TEST_DEMO"), true);
  assert.equal(await prisma.controlledDocumentChange.count({ where: { documentId: master.id, action: "Cambio manual de estado documental" } }), 5);
  const snapshot = await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: first.id } });
  const oldVersion = (await prisma.controlledRevisionLifecycle.findUniqueOrThrow({ where: { revisionId: second } })).version;
  await assert.rejects(change(master.id, first.id, "IN_FORCE"), /históricas/);
  assert.deepEqual(await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: first.id } }), snapshot);
  assert.equal((await prisma.controlledRevisionLifecycle.findUniqueOrThrow({ where: { revisionId: second } })).version, oldVersion);
  console.log("P3C-2 manual OK: estado declarado, aprobación no electrónica, vigencia única, obsolescencia atómica e historial append-only.");
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
