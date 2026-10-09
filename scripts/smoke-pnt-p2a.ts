import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { writeZip } from "../src/lib/ooxml/zip";
import { incorporateDocument, downloadDocument } from "../src/modules/controlled-documents/documents/service";
import { createBatch, getBatch, decide, prepare, confirm } from "../src/modules/controlled-documents/import/service";
import { headings, syntheticWorkbook } from "../src/modules/controlled-documents/preview/synthetic-workbook";
import type { PreviewRow } from "../src/modules/controlled-documents/preview/types";
const principal = { name: "P2A QA sintético", source: "TEST_DEMO" as const, canWrite: true };
const pdf = Buffer.from("%PDF-1.4\nSynthetic P2A fixture\n%%EOF");
async function main() {
  if (process.env.APP_ENV !== "test") throw new Error("APP_ENV=test y base QA aislada requeridos");
  const gc = await prisma.department.findUniqueOrThrow({ where: { code: "GC-00" } });
  // Do not collide with P1 fixtures; no corporate files or real import.
  let code = "";
  for (let n = 900; n < 990; n++) if (!await prisma.controlledDocument.findUnique({ where: { baseCode: `GC-00/${n}` } })) { code = `GC-00/${n}`; break; }
  assert.ok(code);
  const batchId = await createBatch(syntheticWorkbook([{ name: "GC-00(", rows: [{ number: 1, cells: headings }, { number: 2, cells: { B: code, C: "P2A procedimiento ficticio", D: 0, E: "01/01/2026", F: "01/01/2031" } }] }]), "p2a-synthetic.xlsx", principal.name);
  const b = await getBatch(batchId), row = b.rows[0], n = (row.data as unknown as PreviewRow).normalized;
  await decide(batchId, { actor: principal.name, version: b.version, sourceKey: row.sourceKey, scope: "ROW", decision: "INCLUDE", reason: "QA sintético", resolution: { title: n.title, revisionCode: "00", effectiveFrom: n.effectiveFrom!, reviewDueAt: n.reviewDueAt!, declaredState: n.declaredState, departmentId: gc.id, reviewed: true, reason: "Contraste sintético" } });
  const plan = await prepare(batchId);
  await confirm(batchId, { actor: principal.name, version: plan.version, token: plan.token, eligibleKeys: plan.eligibleKeys, explicitlyConfirmed: true });
  const master = await prisma.controlledDocument.findUniqueOrThrow({ where: { baseCode: code }, include: { revisions: true } });
  const revision = master.revisions[0], input = { documentId: master.id, revisionId: revision.id, kind: "DOCUMENT_PDF", file: { name: "synthetic.pdf", mime: "application/pdf", bytes: pdf } };
  const before = JSON.stringify(master), provenance = JSON.stringify(await getBatch(batchId));
  const first = await incorporateDocument(input, principal);
  const second = await incorporateDocument({ ...input, kind: "APPROVAL_EVIDENCE" }, principal);
  const signed = await incorporateDocument({ ...input, kind: "EXTERNAL_SIGNED_PDF" }, principal);
  assert.equal(signed.state, "RECORDED_UNVERIFIED");
  const wordBytes = writeZip([
    { name: "[Content_Types].xml", data: Buffer.from('<Types><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>') },
    { name: "_rels/.rels", data: Buffer.from('<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>') },
    { name: "word/document.xml", data: Buffer.from('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>') },
  ]);
  const working = await incorporateDocument({ ...input, kind: "WORKING_WORD", file: { name: "working.docx", mime: "", bytes: wordBytes } }, principal);
  assert.equal(working.state, "WORKING");
  assert.deepEqual(Buffer.from((await downloadDocument(master.id, revision.id, working.id))!.fileData!), wordBytes);
  assert.notEqual(first.id, second.id); assert.equal(first.revisionId, revision.id); assert.equal(first.sha256, createHash("sha256").update(pdf).digest("hex"));
  const reference = await incorporateDocument({ documentId: master.id, revisionId: revision.id, kind: "ANNEX", reference: { name: "Referencia sintética", url: "https://example.invalid/pnt" } }, principal);
  assert.equal(reference.sha256, null); assert.equal(reference.sizeBytes, null);
  const newBytes = Buffer.from("%PDF-1.4\nSynthetic replacement\n%%EOF");
  await assert.rejects(incorporateDocument({ ...input, replacesId: first.id }, principal), /motivo/);
  const replacement = await incorporateDocument({ ...input, file: { ...input.file, bytes: newBytes }, replacesId: first.id, replacementReason: "Corrección sintética de copia" }, principal);
  assert.equal(replacement.replacesId, first.id);
  assert.deepEqual(Buffer.from((await downloadDocument(master.id, revision.id, first.id))!.fileData!), pdf);
  assert.deepEqual(Buffer.from((await downloadDocument(master.id, revision.id, replacement.id))!.fileData!), newBytes);
  await assert.rejects(incorporateDocument({ ...input, replacesId: first.id, replacementReason: "No repetir" }, principal), /último elemento/);
  await assert.rejects(incorporateDocument({ ...input, revisionId: randomUUID() }, principal), /Revisión no encontrada/);
  const other = await prisma.controlledDocument.create({ data: { title: "Otro maestro QA", createdByText: principal.name, revisions: { create: { revisionCode: "00", registeredByText: principal.name } } }, include: { revisions: true } });
  await assert.rejects(incorporateDocument({ ...input, documentId: other.id }, principal), /Revisión no encontrada/);
  await assert.rejects(incorporateDocument({ ...input, revisionId: other.revisions[0].id, documentId: other.id, replacesId: second.id, replacementReason: "Referencia ajena" }, principal), /mismo tipo y revisión/);
  assert.equal(await downloadDocument(other.id, revision.id, first.id), null);
  assert.equal(await downloadDocument(master.id, other.revisions[0].id, first.id), null);
  await assert.rejects(incorporateDocument(input, { ...principal, canWrite: false }), /permiso/);
  await assert.rejects(prisma.controlledRevisionDocument.update({ where: { id: first.id }, data: { originalName: "overwrite.pdf" } }));
  await assert.rejects(prisma.controlledRevisionDocument.delete({ where: { id: first.id } }));
  const races = await Promise.allSettled([1, 2].map(index => incorporateDocument({ ...input, kind: "APPROVAL_EVIDENCE", replacesId: second.id, replacementReason: `Sustitución concurrente QA ${index}` }, principal)));
  assert.equal(races.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(races.filter(result => result.status === "rejected").length, 1);
  const original = (await downloadDocument(master.id, revision.id, first.id))!;
  const alienId = randomUUID();
  await assert.rejects(prisma.controlledRevisionDocument.create({ data: { ...original, id: alienId, storageReference: `postgres:${alienId}`, documentId: other.id } }));
  const corruptId = randomUUID();
  await prisma.controlledRevisionDocument.create({ data: { ...original, id: corruptId, documentId: other.id, revisionId: other.revisions[0].id, storageReference: `postgres:${corruptId}`, sha256: "0".repeat(64) } });
  await assert.rejects(downloadDocument(other.id, other.revisions[0].id, corruptId), /integridad/);
  const consolidated = await prisma.controlledDocumentRevision.create({ data: { documentId: other.id, revisionCode: "02", status: "OBSOLETE", consolidatedAt: new Date(), registeredByText: principal.name } });
  const consolidatedBefore = JSON.stringify(consolidated);
  const historic = await incorporateDocument({ ...input, documentId: other.id, revisionId: consolidated.id }, principal);
  await assert.rejects(prisma.controlledRevisionDocument.delete({ where: { id: historic.id } }));
  assert.equal(JSON.stringify(await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: consolidated.id } })), consolidatedBefore);
  // Same revision remains byte-for-byte identical, including dates and Excel snapshots.
  assert.equal(JSON.stringify(await prisma.controlledDocument.findUniqueOrThrow({ where: { id: master.id }, include: { revisions: true } })), before);
  assert.equal(JSON.stringify(await getBatch(batchId)), provenance);
  assert.equal(master.administrativeStatus, "DRAFT"); assert.equal(revision.status, "IMPORTED_PENDING"); assert.equal(revision.verificationStatus, "UNVERIFIED");
  assert.equal(await prisma.controlledDocumentChange.count({ where: { revisionId: revision.id, action: { contains: "documental" } } }), 7);
  // A completely fresh client survives application connection teardown (not process memory / temporary FS).
  await prisma.$disconnect();
  const restarted = new PrismaClient();
  try { assert.deepEqual(Buffer.from((await downloadDocument(master.id, revision.id, first.id, restarted))!.fileData!), pdf); } finally { await restarted.$disconnect(); }
  console.log("P2A PostgreSQL OK: múltiples documentos/revisión, importación sintética, SHA/descarga íntegra y corrupción rechazada, referencia externa, sustitución inmutable/concurrente, UUID/FK/ownership, permisos, consolidados protegidos, estados/snapshots/procedencia intactos y reconexión persistente.");
  // Immutable QA fixtures intentionally retained in this disposable database, never hard-deleted.
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
