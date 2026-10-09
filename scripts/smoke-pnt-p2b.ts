import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { lifecycleDecision } from "../src/modules/controlled-documents/lifecycle/service";
import { lifecyclePermissions, type LifecyclePrincipal } from "../src/modules/controlled-documents/lifecycle/access";
import type { LifecycleCommand } from "../src/modules/controlled-documents/lifecycle/domain";
import { incorporateDocument, downloadDocument } from "../src/modules/controlled-documents/documents/service";
import { createBatch, getBatch, decide, prepare, confirm } from "../src/modules/controlled-documents/import/service";
import { headings, syntheticWorkbook } from "../src/modules/controlled-documents/preview/synthetic-workbook";
import type { PreviewRow } from "../src/modules/controlled-documents/preview/types";
const p: LifecyclePrincipal = { name: "P2B registrador sintético", source: "TEST_DEMO", canWrite: true, capabilities: [...lifecyclePermissions] };
const today = new Date().toISOString().slice(0, 10);
const offset = (days: number) => { const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const due = offset(365);
const bytes = Buffer.from("%PDF-1.4\nP2B synthetic controlled document\n%%EOF");
async function command(documentId: string, revisionId: string, extra: Partial<LifecycleCommand>, ids: string[]) {
  return { requestId: randomUUID(), expectedVersion: (await prisma.controlledRevisionLifecycle.findUnique({ where: { revisionId } }))?.version || 0,
    operation: "VERIFY" as const, reason: "QA ciclo documental", notes: "Contraste humano sintético; sin autenticidad automática de firma", evidenceIds: ids, ...extra };
}
async function run(documentId: string, revisionId: string, extra: Partial<LifecycleCommand>, ids: string[]) {
  return lifecycleDecision(documentId, revisionId, await command(documentId, revisionId, extra, ids), p);
}
async function roles(documentId: string, revisionId: string, ids: string[]) {
  for (const role of ["PREPARATION", "REVIEW"] as const) {
    const reg = await run(documentId, revisionId, { operation: "REGISTER_EXTERNAL", function: role, externalPerson: `Persona ${role}`, responsibility: "Responsable de sección QA", authorityBasis: "Designación sintética contrastada GC-00/001/03", accreditedDate: offset(-1) }, ids);
    await run(documentId, revisionId, { operation: "CONTRAST_EXTERNAL", registrationId: reg.id, result: "ACCEPTED" }, ids);
  }
  await run(documentId, revisionId, { operation: "SUBMIT" }, ids);
  const approval = await run(documentId, revisionId, { operation: "REGISTER_EXTERNAL", function: "APPROVAL", externalPerson: "Persona aprobación", responsibility: "Garantía de Calidad", authorityBasis: "Designación sintética conforme al ámbito PNT", accreditedDate: today }, ids);
  await run(documentId, revisionId, { operation: "CONTRAST_EXTERNAL", registrationId: approval.id, result: "INSUFFICIENT" }, ids);
  await assert.rejects(run(documentId, revisionId, { operation: "PLAN", effectiveFrom: today, reviewDueAt: due, finalDocumentId: ids[0], separationConfirmed: true }, ids), /Falta aprobación/);
  await run(documentId, revisionId, { operation: "CONTRAST_EXTERNAL", registrationId: approval.id, result: "ACCEPTED" }, ids);
}
async function main() {
  if (process.env.APP_ENV !== "test") throw new Error("Base QA aislada requerida.");
  const gc = await prisma.department.findUniqueOrThrow({ where: { code: "GC-00" } }); let code = "";
  for (let n = 700; n < 790; n++) if (!await prisma.controlledDocument.findUnique({ where: { baseCode: `GC-00/${n}` } })) { code = `GC-00/${n}`; break; }
  assert.ok(code);
  const batchId = await createBatch(syntheticWorkbook([{ name: "GC-00(", rows: [{ number: 1, cells: headings }, { number: 2, cells: { B: code, C: "P2B QA importado", D: 0, E: "01/01/2026", F: "01/01/2031" } }] }]), "p2b-synthetic.xlsx", p.name);
  const b = await getBatch(batchId), row = b.rows[0], n = (row.data as unknown as PreviewRow).normalized;
  await decide(batchId, { actor: p.name, version: b.version, sourceKey: row.sourceKey, scope: "ROW", decision: "INCLUDE", reason: "Contraste sintético", resolution: { title: n.title, revisionCode: "00", effectiveFrom: n.effectiveFrom!, reviewDueAt: n.reviewDueAt!, declaredState: n.declaredState, departmentId: gc.id, reviewed: true, reason: "QA" } });
  const prep = await prepare(batchId); await confirm(batchId, { actor: p.name, version: prep.version, token: prep.token, eligibleKeys: prep.eligibleKeys, explicitlyConfirmed: true });
  const master = await prisma.controlledDocument.findUniqueOrThrow({ where: { baseCode: code }, include: { revisions: true } }), r = master.revisions[0];
  const provenance = JSON.stringify(await getBatch(batchId));
  const frozen = (v: typeof r) => JSON.stringify([v.baseCodeSnapshot, v.titleSnapshot, v.departmentCodeSnapshot, v.departmentNameSnapshot, v.effectiveFrom, v.reviewDueAt, v.obsoletedAt, v.sourceMetadata, v.sourceReference, v.revisionCode]);
  const original = frozen(r), masterSource = JSON.stringify(master.sourceMetadata);
  const object = await incorporateDocument({ documentId: master.id, revisionId: r.id, kind: "EXTERNAL_SIGNED_PDF", file: { name: "p2b-final.pdf", mime: "application/pdf", bytes } }, p), ids = [object.id];
  assert.equal(r.status, "IMPORTED_PENDING"); assert.equal(object.state, "RECORDED_UNVERIFIED");
  await assert.rejects(run(master.id, r.id, { operation: "ACTIVATE", previousRevisionId: null }, ids), /Transición/);
  await assert.rejects(run(master.id, r.id, { evidenceIds: [] }, ids));
  await assert.rejects(lifecycleDecision(master.id, r.id, await command(master.id, r.id, { result: "FAVORABLE" }, ids), { ...p, capabilities: [] }), /autorizada/);
  await assert.rejects(run(master.id, r.id, { result: "FAVORABLE" }, [randomUUID()]), /Evidencia/);
  await run(master.id, r.id, { result: "DISCREPANCY", discrepancies: "Fecha del índice discrepante" }, ids);
  assert.equal((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r.id } })).status, "IMPORTED_PENDING");
  const verify = await command(master.id, r.id, { result: "FAVORABLE" }, ids), first = await lifecycleDecision(master.id, r.id, verify, p);
  assert.equal((first.after as { projection: { version: number } }).projection.version, first.sequence);
  assert.equal((await lifecycleDecision(master.id, r.id, verify, p)).id, first.id);
  await assert.rejects(lifecycleDecision(master.id, r.id, { ...verify, reason: "Solicitud alterada" }, p), /reutilizado/);
  await assert.rejects(run(master.id, r.id, { operation: "SUBMIT" }, ids), /Faltan preparación/);
  await assert.rejects(run(master.id, r.id, { operation: "REGISTER_EXTERNAL", function: "APPROVAL", externalPerson: "Prematuro" }, ids), /Transición/);
  await roles(master.id, r.id, ids);
  const future = await run(master.id, r.id, { operation: "PLAN", effectiveFrom: offset(1), reviewDueAt: due, finalDocumentId: ids[0], separationConfirmed: true }, ids);
  assert.equal(future.newState, "APPROVED_PENDING_EFFECTIVE");
  await assert.rejects(run(master.id, r.id, { operation: "ACTIVATE", previousRevisionId: null }, ids), /futura/);
  await run(master.id, r.id, { operation: "RECTIFY", rectifiesId: future.id }, ids);
  await assert.rejects(run(master.id, r.id, { operation: "SUBMIT" }, ids), /Falta verificación/);
  await run(master.id, r.id, { result: "FAVORABLE" }, ids); await roles(master.id, r.id, ids);
  await run(master.id, r.id, { operation: "PLAN", effectiveFrom: today, reviewDueAt: due, finalDocumentId: ids[0], separationConfirmed: true }, ids);
  const activate = await command(master.id, r.id, { operation: "ACTIVATE", previousRevisionId: null }, ids);
  const races = await Promise.allSettled([lifecycleDecision(master.id, r.id, activate, p), lifecycleDecision(master.id, r.id, { ...activate, requestId: randomUUID() }, p)]);
  assert.equal(races.filter(v => v.status === "fulfilled").length, 1); assert.equal(races.filter(v => v.status === "rejected").length, 1);
  assert.equal((await prisma.controlledDocument.findUniqueOrThrow({ where: { id: master.id } })).administrativeStatus, "ACTIVE");
  await assert.rejects(run(master.id, r.id, { operation: "RECTIFY", rectifiesId: first.id }, ids), /Transición/);
  const next = await prisma.controlledDocumentRevision.create({ data: { documentId: master.id, revisionCode: "01", baseCodeSnapshot: code, titleSnapshot: master.title, departmentCodeSnapshot: "GC-00", registeredByText: p.name } });
  const nextObject = await incorporateDocument({ documentId: master.id, revisionId: next.id, kind: "DOCUMENT_PDF", file: { name: "p2b-next.pdf", mime: "application/pdf", bytes } }, p), nextIds = [nextObject.id];
  await assert.rejects(run(master.id, next.id, { result: "FAVORABLE" }, ids), /Evidencia/);
  await run(master.id, next.id, { result: "FAVORABLE" }, nextIds); await roles(master.id, next.id, nextIds);
  await run(master.id, next.id, { operation: "PLAN", effectiveFrom: today, reviewDueAt: due, finalDocumentId: nextIds[0], separationConfirmed: true }, nextIds);
  await assert.rejects(run(master.id, next.id, { operation: "ACTIVATE", previousRevisionId: null }, nextIds), /anterior/);
  await run(master.id, next.id, { operation: "ACTIVATE", previousRevisionId: r.id }, nextIds);
  assert.equal(await prisma.controlledDocumentRevision.count({ where: { documentId: master.id, status: "IN_FORCE" } }), 1);
  const old = await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r.id } }); assert.equal(old.status, "OBSOLETE"); assert.equal(frozen(old), original);
  await assert.rejects(prisma.controlledDocumentRevision.create({ data: { documentId: master.id, revisionCode: "02", status: "IN_FORCE", registeredByText: p.name } }));
  await assert.rejects(prisma.controlledRevisionDecision.update({ where: { id: first.id }, data: { reason: "sobrescribir" } }));
  await assert.rejects(prisma.controlledRevisionDecision.delete({ where: { id: first.id } }));
  const link = await prisma.controlledDecisionEvidence.findFirstOrThrow({ where: { decisionId: first.id } });
  await assert.rejects(prisma.controlledDecisionEvidence.delete({ where: { id: link.id } }));
  await assert.rejects(prisma.controlledDecisionEvidence.update({ where: { id: link.id }, data: { snapshot: {} } }));
  assert.equal(JSON.stringify(await getBatch(batchId)), provenance); assert.equal(JSON.stringify((await prisma.controlledDocument.findUniqueOrThrow({ where: { id: master.id } })).sourceMetadata), masterSource);
  assert.deepEqual(Buffer.from((await downloadDocument(master.id, r.id, object.id))!.fileData!), bytes);
  await run(master.id, next.id, { operation: "RETIRE" }, nextIds);
  const terminal = await run(master.id, r.id, { operation: "RECTIFY", rectifiesId: first.id }, ids); assert.equal(terminal.newState, "OBSOLETE");
  const pending = await prisma.controlledDocumentRevision.create({ data: { documentId: master.id, revisionCode: "03", baseCodeSnapshot: code, titleSnapshot: master.title, departmentCodeSnapshot: "GC-00", registeredByText: p.name } });
  const ref = await incorporateDocument({ documentId: master.id, revisionId: pending.id, kind: "DOCUMENT_PDF", reference: { name: "Referencia QA", url: "https://example.invalid/p2b" } }, p);
  await assert.rejects(run(master.id, pending.id, { result: "FAVORABLE" }, [ref.id]), /referencia externa/);
  await run(master.id, pending.id, { result: "FAVORABLE", referenceBasis: "Documento comparado humanamente, sin custodia verificable" }, [ref.id]);
  await run(master.id, pending.id, { operation: "ANNUL", referenceBasis: "Referencia de anulación sintética" }, [ref.id]);
  // A later replacement invalidates the evidence gate, not the immutable prior decisions.
  const replaceRevision = await prisma.controlledDocumentRevision.create({ data: { documentId: master.id, revisionCode: "04", baseCodeSnapshot: code, titleSnapshot: master.title, departmentCodeSnapshot: "GC-00", registeredByText: p.name } });
  const originalObject = await incorporateDocument({ documentId: master.id, revisionId: replaceRevision.id, kind: "DOCUMENT_PDF", file: { name: "replace-controlled.pdf", mime: "application/pdf", bytes } }, p);
  const replaceIds = [originalObject.id];
  const simultaneous = await command(master.id, replaceRevision.id, { result: "FAVORABLE" }, replaceIds);
  const contrasts = await Promise.allSettled([lifecycleDecision(master.id, replaceRevision.id, simultaneous, p), lifecycleDecision(master.id, replaceRevision.id, { ...simultaneous, requestId: randomUUID() }, p)]);
  assert.equal(contrasts.filter(v => v.status === "fulfilled").length, 1); assert.equal(contrasts.filter(v => v.status === "rejected").length, 1);
  await roles(master.id, replaceRevision.id, replaceIds);
  const samePerson = await run(master.id, replaceRevision.id, { operation: "REGISTER_EXTERNAL", function: "APPROVAL", externalPerson: "Persona PREPARATION", responsibility: "Garantía Calidad", authorityBasis: "QA contraste identidad", accreditedDate: today }, replaceIds);
  await run(master.id, replaceRevision.id, { operation: "CONTRAST_EXTERNAL", registrationId: samePerson.id, result: "ACCEPTED" }, replaceIds);
  await assert.rejects(run(master.id, replaceRevision.id, { operation: "PLAN", effectiveFrom: today, reviewDueAt: due, finalDocumentId: replaceIds[0], separationConfirmed: true }, replaceIds), /personas distintas/);
  const separate = await run(master.id, replaceRevision.id, { operation: "REGISTER_EXTERNAL", function: "APPROVAL", externalPerson: "Persona aprobación distinta", responsibility: "Garantía Calidad", authorityBasis: "QA separación contrastada", accreditedDate: today }, replaceIds);
  await run(master.id, replaceRevision.id, { operation: "CONTRAST_EXTERNAL", registrationId: separate.id, result: "ACCEPTED" }, replaceIds);
  const planBeforeReplacement = await run(master.id, replaceRevision.id, { operation: "PLAN", effectiveFrom: today, reviewDueAt: due, finalDocumentId: replaceIds[0], separationConfirmed: true }, replaceIds);
  const replacement = await incorporateDocument({ documentId: master.id, revisionId: replaceRevision.id, kind: "DOCUMENT_PDF", file: { name: "replace-corrected.pdf", mime: "application/pdf", bytes }, replacesId: originalObject.id, replacementReason: "Corrección sintética copia" }, p);
  await assert.rejects(run(master.id, replaceRevision.id, { operation: "ACTIVATE", previousRevisionId: null }, [replacement.id]), /sustituida/);
  assert.equal((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: replaceRevision.id } })).status, "APPROVED_PENDING_EFFECTIVE");
  await run(master.id, replaceRevision.id, { operation: "RECTIFY", rectifiesId: planBeforeReplacement.id }, [replacement.id]);
  await assert.rejects(run(master.id, replaceRevision.id, { operation: "SUBMIT" }, [replacement.id]), /Falta verificación/);
  // No automatic approval of consolidated P1A, including after a controlled retirement.
  const legacyMaster = await prisma.controlledDocument.create({ data: { title: "Histórico P1A QA", createdByText: p.name, administrativeStatus: "ACTIVE" } });
  const legacy = await prisma.controlledDocumentRevision.create({ data: { documentId: legacyMaster.id, revisionCode: "00", status: "IN_FORCE", verificationStatus: "VERIFIED", consolidatedAt: new Date(), effectiveFrom: new Date("2025-01-01"), reviewDueAt: new Date("2025-01-01"), registeredByText: "Histórico sintético", verifiedByText: "Histórico sintético", verifiedAt: new Date() } });
  const legacyDoc = await incorporateDocument({ documentId: legacyMaster.id, revisionId: legacy.id, kind: "DOCUMENT_PDF", file: { name: "legacy.pdf", mime: "application/pdf", bytes } }, p);
  await run(legacyMaster.id, legacy.id, { operation: "RETIRE" }, [legacyDoc.id]);
  const legacyProjection = await prisma.controlledRevisionLifecycle.findUniqueOrThrow({ where: { revisionId: legacy.id } });
  assert.equal(legacyProjection.legacyOrigin, true); assert.equal(legacyProjection.approvalAt, null); assert.deepEqual(legacyProjection.effectiveFrom, legacy.effectiveFrom);
  assert.deepEqual(legacyProjection.reviewDueAt, legacy.reviewDueAt); // P1A allowed same-day dates; do not retrospectively tighten them.
  assert.equal(frozen(await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: legacy.id } })), frozen(legacy));
  await prisma.$disconnect(); const fresh = new PrismaClient();
  try { assert.equal((await fresh.controlledRevisionDecision.findUniqueOrThrow({ where: { id: first.id } })).actor, p.name); assert.deepEqual(Buffer.from((await downloadDocument(master.id, r.id, object.id, fresh))!.fileData!), bytes); } finally { await fresh.$disconnect(); }
  console.log("P2B PostgreSQL OK: importación pendiente/discrepancias/favorable, preservación de procedencia y fechas/snapshots, PDF firmado no implica aprobación, funciones externas registradas y contrastadas, evidencia insuficiente, planificación futura sin activación, rectificación enlazada, vigencia explícita/obsolescencia atómica, unicidad, saltos/UUID/permisos/concurrencia/idempotencia, inmutabilidad y reconexión.");
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
