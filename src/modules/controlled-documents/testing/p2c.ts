// Synthetic regression fixtures only. No application imports this module.
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { writeZip } from "@/lib/ooxml/zip";
import { saveMaster, saveRevision } from "../service";
import { parseMasterForm, parseRevisionForm } from "../domain";
import { lifecycleDecision } from "../lifecycle/service";
import { lifecyclePermissions, type LifecyclePrincipal } from "../lifecycle/access";
import type { LifecycleCommand } from "../lifecycle/domain";
import { incorporateDocument } from "../documents/service";
import { headings, syntheticWorkbook } from "../preview/synthetic-workbook";
import { createBatch, getBatch, decide, prepare, confirm } from "../import/service";
import type { PreviewRow } from "../preview/types";
export const qaActor = "P2C QA sintético";
export const qaPrincipal: LifecyclePrincipal = { name: qaActor, source: "TEST_DEMO", canWrite: true, capabilities: [...lifecyclePermissions] };
export const today = new Date().toISOString().slice(0, 10);
export function offset(days: number) { const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
export const pdf = Buffer.from("%PDF-1.4\nSynthetic P2C controlled content\n%%EOF");
export const word = writeZip([
  { name: "[Content_Types].xml", data: Buffer.from('<Types><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>') },
  { name: "_rels/.rels", data: Buffer.from('<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>') },
  { name: "word/document.xml", data: Buffer.from('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>P2C synthetic working text</w:t></w:r></w:p></w:body></w:document>') },
]);
export function qaOnly() { if (process.env.APP_ENV !== "test") throw new Error("P2C requiere QA aislado y APP_ENV=test."); }
export async function freeCode() { qaOnly(); for (let n = 400; n < 650; n++) if (!await prisma.controlledDocument.findUnique({ where: { baseCode: `GC-00/${n}` } })) return `GC-00/${n}`; throw new Error("Sin códigos QA libres."); }
export function form(values: Record<string, string>) { const f = new FormData(); for (const [k, v] of Object.entries(values)) f.set(k, v); return f; }
export async function manualMaster(operation = "REGISTER", sourceDate = offset(30)) {
  qaOnly(); const code = await freeCode(), gc = await prisma.department.findUniqueOrThrow({ where: { code: "GC-00" } });
  const input = parseMasterForm(form({ operation, baseCode: code, title: `P2C manual ${randomUUID()}`, departmentId: gc.id, actor: qaActor, changeReason: "Alta manual sintética", revisionCode: "00", effectiveFrom: sourceDate, reviewDueAt: offset(365) }));
  const id = await saveMaster(input);
  return { master: await prisma.controlledDocument.findUniqueOrThrow({ where: { id }, include: { revisions: true } }), input };
}
export async function nextRevision(documentId: string, previousRevisionId: string) {
  qaOnly(); return saveRevision(documentId, parseRevisionForm(form({ operation: "DRAFT", actor: qaActor, changeReason: "Revisión siguiente explícita QA", revisionCode: "01", previousRevisionId })));
}
export function workbook(code: string) {
  const number = Number(code.split("/")[1]);
  return syntheticWorkbook([
    { name: "GC-00", rows: [], xml: "invalid discarded worksheet" },
    { name: "GC-00(", rows: [{ number: 1, cells: headings },
      { number: 2, cells: { B: code, C: "P2C fuente seleccionada", D: 0, E: offset(30), F: offset(365) } },
      { number: 3, cells: { B: code, C: "P2C título discrepante descartado", D: 0, E: offset(31), F: offset(365) } },
      { number: 4, cells: { B: `GC-00/${number + 1}`, C: "P2C pendiente sin revisión", D: "", E: "", F: "" } },
    ] },
  ]);
}
export async function selectedBatch(bytes: Buffer, code: string) {
  qaOnly(); const id = await createBatch(bytes, "p2c-synthetic.xlsx", qaActor), b = await getBatch(id);
  const row = b.rows.find(r => r.baseCode === code && (r.data as unknown as PreviewRow).source.row === 2)!;
  const n = (row.data as unknown as PreviewRow).normalized;
  const gc = await prisma.department.findUniqueOrThrow({ where: { code: "GC-00" } });
  await decide(id, { actor: qaActor, version: b.version, sourceKey: row.sourceKey, decision: "INCLUDE", scope: "GROUP", reason: "Procedencia elegida expresamente; segunda fuente discrepante excluida", resolution: {
    title: n.title, revisionCode: n.revisionCode || "", effectiveFrom: n.effectiveFrom || "", reviewDueAt: n.reviewDueAt || "", declaredState: n.declaredState,
    departmentId: gc.id, reviewed: true, reason: "Datos originales conservados, no acreditan vigencia" } });
  return id;
}
export async function confirmation(id: string) { const p = await prepare(id); return { actor: qaActor, version: p.version, token: p.token, eligibleKeys: p.eligibleKeys, explicitlyConfirmed: true }; }
export async function importedMaster() {
  qaOnly(); const code = await freeCode(), bytes = workbook(code), batchId = await selectedBatch(bytes, code);
  await confirm(batchId, await confirmation(batchId));
  return { master: await prisma.controlledDocument.findUniqueOrThrow({ where: { baseCode: code }, include: { revisions: true } }), batchId, bytes };
}
export async function evidence(documentId: string, revisionId: string) {
  qaOnly(); const out = [];
  for (const [kind, name, bytes, mime] of [
    ["WORKING_WORD", "p2c-working.docx", word, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["DOCUMENT_PDF", "p2c-document.pdf", pdf, "application/pdf"],
    ["EXTERNAL_SIGNED_PDF", "p2c-signed.pdf", pdf, "application/pdf"],
    ["APPROVAL_EVIDENCE", "p2c-evidence.pdf", pdf, "application/pdf"],
  ] as const) out.push(await incorporateDocument({ documentId, revisionId, kind, file: { name, mime, bytes } }, qaPrincipal));
  out.push(await incorporateDocument({ documentId, revisionId, kind: "ANNEX", reference: { name: "SharePoint sintético", url: "https://example.invalid/sharepoint/pnt" } }, qaPrincipal));
  return out;
}
export async function command(documentId: string, revisionId: string, ids: string[], extra: Partial<LifecycleCommand>) {
  return { requestId: randomUUID(), expectedVersion: (await prisma.controlledRevisionLifecycle.findUnique({ where: { revisionId } }))?.version || 0,
    operation: "VERIFY" as const, reason: "P2C contraste humano sintético", notes: "Contraste explícito: fechas documentales operativas diferentes del índice/plan original conservado", evidenceIds: ids,
    referenceBasis: "Referencia sintética contrastada humanamente; sin custodia/hash comprobado", ...extra };
}
export async function decideLifecycle(documentId: string, revisionId: string, ids: string[], extra: Partial<LifecycleCommand>, principal = qaPrincipal) {
  qaOnly(); return lifecycleDecision(documentId, revisionId, await command(documentId, revisionId, ids, extra), principal);
}
export async function externalRole(documentId: string, revisionId: string, ids: string[], role: "PREPARATION" | "REVIEW" | "APPROVAL", accreditedDate = today) {
  const registration = await decideLifecycle(documentId, revisionId, ids, { operation: "REGISTER_EXTERNAL", function: role, externalPerson: `P2C persona ${role}`, responsibility: role === "APPROVAL" ? "Garantía de Calidad" : "Responsable de sección", authorityBasis: "Designación sintética contrastada conforme al ámbito del PNT", accreditedDate });
  await decideLifecycle(documentId, revisionId, ids, { operation: "CONTRAST_EXTERNAL", registrationId: registration.id, result: "ACCEPTED" });
  return registration;
}
export async function planRevision(documentId: string, revisionId: string, ids: string[], finalDocumentId: string, effectiveFrom = today, accreditedDate = today) {
  await decideLifecycle(documentId, revisionId, ids, { result: "FAVORABLE" });
  await externalRole(documentId, revisionId, ids, "PREPARATION", accreditedDate); await externalRole(documentId, revisionId, ids, "REVIEW", accreditedDate);
  await decideLifecycle(documentId, revisionId, ids, { operation: "SUBMIT" }); await externalRole(documentId, revisionId, ids, "APPROVAL", accreditedDate);
  return decideLifecycle(documentId, revisionId, ids, { operation: "PLAN", finalDocumentId, effectiveFrom, reviewDueAt: offset(365), separationConfirmed: true });
}
