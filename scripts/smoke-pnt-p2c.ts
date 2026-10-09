import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { previewIndex } from "../src/modules/controlled-documents/preview/service";
import { confirm, getBatch, prepare } from "../src/modules/controlled-documents/import/service";
import { downloadDocument, incorporateDocument } from "../src/modules/controlled-documents/documents/service";
import { lifecycleDecision } from "../src/modules/controlled-documents/lifecycle/service";
import { permissions } from "../src/modules/controlled-documents/lifecycle/domain";
import { parseRevisionForm } from "../src/modules/controlled-documents/domain";
import { saveRevision } from "../src/modules/controlled-documents/service";
import { qaOnly, freeCode, workbook, selectedBatch, confirmation, evidence, planRevision, command, qaPrincipal, nextRevision, pdf, form, manualMaster, decideLifecycle, externalRole, offset, today } from "../src/modules/controlled-documents/testing/p2c";
import type { ControlledDocumentRevision } from "@prisma/client";
const frozen = (r: ControlledDocumentRevision) => JSON.stringify([r.id, r.baseCodeSnapshot, r.titleSnapshot, r.departmentCodeSnapshot, r.departmentNameSnapshot, r.sourceMetadata, r.sourceReference, r.effectiveFrom, r.reviewDueAt, r.obsoletedAt, r.registeredAt, r.registeredByText]);
async function state(id: string) { return JSON.stringify(await prisma.controlledDocument.findUniqueOrThrow({ where: { id }, include: { revisions: { include: { lifecycle: true, decisions: { include: { evidence: true } }, documents: true } }, changes: true } })); }
async function main() {
  qaOnly(); const code = await freeCode(), bytes = workbook(code), before = await prisma.controlledDocument.count();
  const report = await previewIndex(bytes, "p2c.xlsx"); assert.equal(await prisma.controlledDocument.count(), before);
  assert.equal(report.rows.length, 3); assert.equal(report.rows.some(r => r.source.sheet === "GC-00"), false);
  assert.equal(report.summary.uniqueCodes, 2);
  const batchId = await selectedBatch(bytes, code), input = await confirmation(batchId);
  await Promise.allSettled([confirm(batchId, input), confirm(batchId, input)]);
  assert.equal((await confirm(batchId, input)).retried, true);
  const batch = await getBatch(batchId); assert.equal(batch.state, "PARTIAL"); assert.equal(batch.events.filter(e => e.action === "CONFIRMED").length, 1);
  assert.equal(batch.rows.filter(r => r.decision === "EXCLUDED").length, 1); assert.equal(batch.rows.filter(r => r.decision === "PENDING").length, 1);
  const m = await prisma.controlledDocument.findUniqueOrThrow({ where: { baseCode: code }, include: { revisions: true } }), r = m.revisions[0], source = frozen(r);
  assert.equal(r.revisionCode, "00"); assert.equal(m.administrativeStatus, "DRAFT"); assert.equal(r.status, "IMPORTED_PENDING");
  const docs = await evidence(m.id, r.id), ids = docs.map(d => d.id);
  assert.deepEqual(await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r.id } }), r);
  const masterAfterFiles = await prisma.controlledDocument.findUniqueOrThrow({ where: { id: m.id } });
  assert.equal(masterAfterFiles.administrativeStatus, m.administrativeStatus); assert.equal(masterAfterFiles.verificationStatus, m.verificationStatus); assert.deepEqual(masterAfterFiles.sourceMetadata, m.sourceMetadata);
  for (const d of docs) {
    assert.equal(d.revisionId, r.id); assert.equal(d.state, d.kind === "WORKING_WORD" ? "WORKING" : "RECORDED_UNVERIFIED");
    if (d.sha256) { const file = await downloadDocument(m.id, r.id, d.id); assert.ok(file?.fileData); assert.equal(createHash("sha256").update(file.fileData).digest("hex"), d.sha256); }
  }
  // Every service capability fails closed before any transactional mutation, not just in UI.
  const deniedBefore = await state(m.id);
  for (const [operation, capability] of Object.entries(permissions)) {
    const c = await command(m.id, r.id, ids, { operation: operation as keyof typeof permissions });
    for (const principal of [{ ...qaPrincipal, name: "" }, { ...qaPrincipal, capabilities: [] }, { ...qaPrincipal, capabilities: qaPrincipal.capabilities.filter(p => p !== capability) }])
      await assert.rejects(lifecycleDecision(m.id, r.id, c, principal), /no autorizada/);
  }
  assert.equal(await state(m.id), deniedBefore);
  await planRevision(m.id, r.id, ids, docs[2].id);
  const activation = await command(m.id, r.id, ids, { operation: "ACTIVATE", previousRevisionId: null });
  const activations = [activation, { ...activation, requestId: randomUUID() }];
  const concurrent = await Promise.allSettled(activations.map(c => lifecycleDecision(m.id, r.id, c, qaPrincipal)));
  assert.equal(concurrent.filter(v => v.status === "fulfilled").length, 1);
  const afterActivation = await state(m.id);
  const succeeded = activations[concurrent.findIndex(v => v.status === "fulfilled")];
  assert.ok(await lifecycleDecision(m.id, r.id, succeeded, qaPrincipal)); assert.equal(await state(m.id), afterActivation);
  await assert.rejects(lifecycleDecision(m.id, r.id, { ...succeeded, reason: "UUID reutilizado con otro contenido" }, qaPrincipal)); assert.equal(await state(m.id), afterActivation);
  assert.equal(frozen(await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r.id } })), source);
  assert.equal((await prisma.controlledDocument.findUniqueOrThrow({ where: { id: m.id } })).administrativeStatus, "ACTIVE");
  await assert.rejects(saveRevision(m.id, parseRevisionForm(form({ operation: "DRAFT", actor: qaPrincipal.name, revisionCode: "00", changeReason: "Intento P1A QA" })), r.id), /P2B/);
  const next = await nextRevision(m.id, r.id), nextDocs = await evidence(m.id, next), nextIds = nextDocs.map(d => d.id);
  const original = await prisma.controlledRevisionDocument.findUniqueOrThrow({ where: { id: docs[2].id } });
  await planRevision(m.id, next, nextIds, nextDocs[2].id);
  const planned = await state(m.id);
  await assert.rejects(lifecycleDecision(m.id, next, await command(m.id, next, [docs[2].id], { operation: "ACTIVATE", previousRevisionId: r.id }), qaPrincipal), /revisión/);
  assert.equal(await state(m.id), planned);
  const replacement = await incorporateDocument({ documentId: m.id, revisionId: next, kind: "EXTERNAL_SIGNED_PDF", file: { name: "p2c-replacement.pdf", mime: "application/pdf", bytes: pdf }, replacesId: nextDocs[2].id, replacementReason: "Sustitución explícita sintética entre planificación y activación" }, qaPrincipal);
  assert.equal(replacement.replacesId, nextDocs[2].id);
  const replaced = await state(m.id);
  await assert.rejects(lifecycleDecision(m.id, next, await command(m.id, next, nextIds, { operation: "ACTIVATE", previousRevisionId: r.id }), qaPrincipal), /sustitu/);
  assert.equal(await state(m.id), replaced); assert.deepEqual(await prisma.controlledRevisionDocument.findUniqueOrThrow({ where: { id: docs[2].id } }), original);
  const decision = await prisma.controlledRevisionDecision.findFirstOrThrow({ where: { revisionId: r.id } });
  await assert.rejects(prisma.controlledRevisionDecision.update({ where: { id: decision.id }, data: { reason: "Mutación QA bloqueada" } }));
  await assert.rejects(prisma.controlledRevisionDocument.delete({ where: { id: docs[2].id } }));
  const repeat = await selectedBatch(bytes, code); assert.equal((await prepare(repeat)).summary.businessWrites, 0); await confirm(repeat, await confirmation(repeat));
  assert.equal(await state(m.id), replaced);
  assert.equal(await prisma.controlledDocument.count({ where: { baseCode: code } }), 1);
  const client = new PrismaClient(); try { const file = await downloadDocument(m.id, r.id, docs[2].id, client); assert.deepEqual(Buffer.from(file!.fileData!), pdf); } finally { await client.$disconnect(); }
  // Independent manual route through the same production services, without workbook.
  const manual = (await manualMaster()).master, mr = manual.revisions[0], manualSource = frozen(mr), md = await evidence(manual.id, mr.id);
  await planRevision(manual.id, mr.id, md.map(d => d.id), md[2].id);
  await lifecycleDecision(manual.id, mr.id, await command(manual.id, mr.id, md.map(d => d.id), { operation: "ACTIVATE", previousRevisionId: null }), qaPrincipal);
  assert.equal(frozen(await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: mr.id } })), manualSource);
  // Negative integrated gates: reject approval, incoherent dates, expiry and corrupt read.
  const adverse = (await manualMaster()).master, ar = adverse.revisions[0], ad = await evidence(adverse.id, ar.id), ai = ad.map(d => d.id);
  const corruptReader = prisma.$extends({ query: { controlledRevisionDocument: { async findMany({ args, query }) {
    const rows = await query(args); return rows.map(row => row.revisionId === ar.id && row.fileData ? { ...row, fileData: Buffer.from("Synthetic corrupted read") } : row);
  } } } });
  const adverseBefore = await state(adverse.id);
  await assert.rejects(lifecycleDecision(adverse.id, ar.id, await command(adverse.id, ar.id, ai, { result: "FAVORABLE" }), qaPrincipal, corruptReader as unknown as PrismaClient), /Integridad SHA-256/);
  assert.equal(await state(adverse.id), adverseBefore);
  await decideLifecycle(adverse.id, ar.id, ai, { result: "DISCREPANCY", discrepancies: "Fuente discrepante QA" });
  assert.equal((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: ar.id } })).status, "DRAFT");
  await decideLifecycle(adverse.id, ar.id, ai, { result: "FAVORABLE" });
  await externalRole(adverse.id, ar.id, ai, "PREPARATION", offset(-3)); await externalRole(adverse.id, ar.id, ai, "REVIEW", offset(-3));
  await decideLifecycle(adverse.id, ar.id, ai, { operation: "SUBMIT" });
  const approval = await externalRole(adverse.id, ar.id, ai, "APPROVAL", offset(-3));
  await decideLifecycle(adverse.id, ar.id, ai, { operation: "CONTRAST_EXTERNAL", registrationId: approval.id, result: "REJECTED" });
  const plan = { operation: "PLAN" as const, finalDocumentId: ad[2].id, effectiveFrom: today, reviewDueAt: offset(365), separationConfirmed: true };
  await assert.rejects(decideLifecycle(adverse.id, ar.id, ai, plan), /Falta aprobación/);
  await decideLifecycle(adverse.id, ar.id, ai, { operation: "CONTRAST_EXTERNAL", registrationId: approval.id, result: "ACCEPTED" });
  await assert.rejects(decideLifecycle(adverse.id, ar.id, ai, { ...plan, reviewDueAt: offset(-1) }), /Fechas/);
  await decideLifecycle(adverse.id, ar.id, ai, { ...plan, effectiveFrom: offset(-2), reviewDueAt: offset(-1) });
  const expired = await state(adverse.id); await assert.rejects(decideLifecycle(adverse.id, ar.id, ai, { operation: "ACTIVATE", previousRevisionId: null }), /vencida/); assert.equal(await state(adverse.id), expired);
  await decideLifecycle(adverse.id, ar.id, ai, { operation: "ANNUL" });
  assert.equal((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: ar.id } })).status, "ANNULLED");
  console.log("P2C PostgreSQL OK: índice real sintético→lote parcial→cinco soportes→vigencia; manual sin Excel; origen/snapshots/fechas intactos; permisos servidor por capacidad; doble confirmación/activación/reintentos; evidencia ajena/sustituida, rollback, SQL inmutable, reimportación sin escrituras y reconexión íntegra.");
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
