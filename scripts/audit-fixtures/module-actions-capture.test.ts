import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { isolatedTestEnvironment } from "../../src/lib/auth/config";
import { identityContext, type Principal } from "../../src/lib/auth/context";
import { fixtureUsers } from "../auth-fixtures/constants";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;` }); } }));
const url = new URL(process.env.DATABASE_URL!), ownerUrl = new URL(process.env.B2_CAPTURE_INSPECTOR_URL!);
if (!isolatedTestEnvironment() || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== ownerUrl.pathname || !/^\/covex_phase4b1_test_b2_capture_[a-f0-9]+$/.test(url.pathname)) throw Error("Own disposable capture fixture required");
const inspector = new PrismaClient({ datasourceUrl: ownerUrl.href, log: [] });
let qa: Principal, reader: Principal, admin: Principal;
beforeAll(async () => {
  const { issueSession, sessionFromToken } = await import("../../src/lib/auth/session");
  qa = (await sessionFromToken((await issueSession(fixtureUsers.qa.id)).token)).principal;
  reader = (await sessionFromToken((await issueSession(fixtureUsers.reader.id)).token)).principal;
  admin = (await sessionFromToken((await issueSession(fixtureUsers.admin.id)).token)).principal;
});
afterAll(async () => { await inspector.$disconnect(); await (await import("../../src/lib/db")).prisma.$disconnect(); });
type Action = (...args: unknown[]) => Promise<unknown>;
const asUser = (user: Principal, run: () => Promise<unknown>) => identityContext.run({ principal: user, testHarness: true }, run);
const form = (values: Record<string, string>) => { const fd = new FormData(); for (const [key, value] of Object.entries(values)) fd.set(key, value); return fd; };
const settled = async (run: () => Promise<unknown>) => {
  try { return await run(); }
  catch (error) { if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT;")) return { redirect: error.digest }; throw error; }
};

it("expires only actual pending staging through a private technical lease, atomically and without fabricating business events", async () => {
  const { expireBatches } = await import("../../src/modules/controlled-documents/import/service");
  const { importDb } = await import("../../src/modules/controlled-documents/import/database");
  try {
    const { businessSqlFixture } = await import("./database");
    await asUser(qa, () => businessSqlFixture(importDb, qa.id, randomUUID(), "PN06", "PNT", "IMPORT", null, async tx => {
      const batch = await tx.controlledDocumentImportBatch.create({ data: { fileName: "SYNTHETIC-B2-STAGING-OWN-PARTIAL.xlsx", sha256: "c".repeat(64), analyzedAt: new Date(), actor: qa.name, state: "PARTIAL", summary: { synthetic: true }, reportMetadata: { synthetic: true }, expiresAt: new Date(Date.now()-86400000) } });
      for (const confirmed of [false,true]) await tx.controlledDocumentImportRow.create({ data: { batchId: batch.id, sourceKey: (confirmed?"d":"e").repeat(64), data: { synthetic: true }, ...(confirmed?{result:{synthetic:true}}:{}) } });
    }));
    // Another original import may have triggered expiry earlier; this test owns
    // its rollback fixture and does not depend on Vitest file execution order.
    const expired = await inspector.controlledDocumentImportBatch.findFirstOrThrow({ where: { fileName: "SYNTHETIC-B2-STAGING-OWN-PARTIAL.xlsx" }, include: { rows: true } });
    const kept = await inspector.controlledDocumentImportBatch.findMany({ where: { fileName: { in: ["SYNTHETIC-B2-STAGING-PENDING.xlsx","SYNTHETIC-B2-STAGING-CONFIRMED.xlsx"] } }, include: { rows: true }, orderBy: { id: "asc" } });
    const operations = await inspector.auditOperation.count();
    const technicalCount = await inspector.auditTechnicalEvent.count();
    await inspector.$executeRawUnsafe('ALTER TABLE "AuditTechnicalEvent" ADD CONSTRAINT b2_technical_failure CHECK (operation=\'NEVER_SUCCESS\') NOT VALID');
    try {
      await expect(asUser(reader, () => expireBatches())).rejects.toThrow();
      expect(await inspector.controlledDocumentImportBatch.findUniqueOrThrow({ where: { id: expired.id }, include: { rows: true } })).toEqual(expired);
      expect(await inspector.auditTechnicalEvent.count()).toBe(technicalCount);
    } finally { await inspector.$executeRawUnsafe('ALTER TABLE "AuditTechnicalEvent" DROP CONSTRAINT b2_technical_failure'); }
    const expiredCount = await asUser(reader, () => expireBatches()) as number;
    expect(expiredCount).toBeGreaterThanOrEqual(1);
    const current = await inspector.controlledDocumentImportBatch.findUniqueOrThrow({ where: { id: expired.id }, include: { rows: true } });
    expect(current.state).toBe("EXPIRED"); expect(current.version).toBe(expired.version + 1);
    expect(current.rows).toEqual(expired.rows.filter(row => row.result !== null));
    expect(await inspector.controlledDocumentImportBatch.findMany({ where: { id: { in: kept.map(b => b.id) } }, include: { rows: true }, orderBy: { id: "asc" } })).toEqual(kept);
    const event = await inspector.auditTechnicalEvent.findFirstOrThrow({ where: { batchId: expired.id } });
    expect(event.actorKind).toBe("SYSTEM"); expect(event.triggeredByUserId).toBe(reader.id); expect(event.triggeredByName).toBe(reader.name);
    expect(event.deletedPendingRows).toBe(1); expect(event.retainedConfirmedRows).toBe(1);
    expect(await inspector.auditOperation.count()).toBe(operations);
    expect(await asUser(reader, () => expireBatches())).toBe(0); expect(await inspector.auditTechnicalEvent.count()).toBe(technicalCount + expiredCount);
    expect(await inspector.auditTechnicalContext.count()).toBe(0);
    await expect(importDb.$queryRaw`SELECT * FROM "AuditTechnicalContext"`).rejects.toThrow();
    await expect(inspector.auditTechnicalEvent.update({ where: { id: event.id }, data: { deletedPendingRows: 0 } })).rejects.toThrow();
    await expect(inspector.controlledDocumentImportBatch.update({ where: { id: kept[0].id }, data: { state: "EXPIRED" } })).rejects.toThrow();
    const { withBusinessAuditResult } = await import("../../src/lib/audit/business-service");
    await expect(asUser(qa, () => withBusinessAuditResult({ operationCode: "PN06", module: "PNT", permission: "IMPORT" }, { requestId: randomUUID(), digest: "f".repeat(64), reason: null }, () => expireBatches()))).rejects.toThrow();
  } finally { await importDb.$disconnect(); }
}, 30000);
const cases = [
  ["DEVIATION", "deviation", "../../src/modules/deviations/actions", "createDeviationAction", "updateDeviationAction"],
  ["CAPA", "capa", "../../src/modules/capa/actions", "createCapaAction", "updateCapaAction"],
  ["CHANGE_CONTROL", "changeControl", "../../src/modules/change-control/actions", "createChangeControlAction", "updateChangeControlAction"],
  ["COMPLAINT", "complaint", "../../src/modules/complaints/actions", "createComplaintAction", "updateComplaintAction"],
  ["RETURN", "returnRecord", "../../src/modules/returns/actions", "createReturnAction", "updateReturnAction"],
  ["AUDIT", "audit", "../../src/modules/audits/actions", "saveAuditAction", "saveAuditAction"],
  ["PNT", "controlledDocument", "../../src/modules/controlled-documents/actions", "masterAction", "masterAction"],
] as const;
type Domain = { findUniqueOrThrow(args: object): Promise<{ id: string; updatedAt: Date; internalObservations?: string | null; observations?: string | null }> };

it.each(cases)("captures original %s draft create/edit actions, authenticated actor, SQL values and replay", async (module, model, file, createName, editName) => {
  const actions = await import(file) as Record<string, Action>;
  const department = await inspector.department.findFirstOrThrow({ where: module === "RETURN" ? { code: "LG-00" } : {} });
  const requestId = randomUUID();
  const values = { status: "DRAFT", finalStatus: "DRAFT", saveIntent: module === "DEVIATION" ? "draft" : "SAVE_DRAFT", operation: "DRAFT", departmentId: department.id, actor: "Spoofed executor", title: "Synthetic original action", complaintType: "CUSTOMER", returnType: "OTHER", planningStatus: "UNCLASSIFIED", dataQualityStatus: "INCOMPLETE", _covexAuditRequestId: requestId };
  const createArgs = () => module === "AUDIT" || module === "PNT" ? [null, { error: null }, form(values)] : [{ error: null }, form(values)];
  await expect(asUser(reader, () => actions[createName](...createArgs()))).rejects.toMatchObject({ status: 403 });
  const response = await settled(() => asUser(qa, () => actions[createName](...createArgs())));
  if (response && typeof response === "object" && "error" in response && response.error) throw Error("Original create rejected: " + JSON.stringify(response));
  const operation = await inspector.auditOperation.findFirstOrThrow({ where: { requestId }, include: { targets: true, events: true, commandResult: true } });
  expect(operation.actorUserId).toBe(qa.id); expect(operation.actorName).toBe(qa.name);
  expect(operation.commandResult).not.toBeNull(); expect(operation.reason).toBeNull();
  expect(operation.events.length).toBeGreaterThan(0);
  expect(operation.events.every(event => event.fieldPath !== "fileData")).toBe(true);
  const target = operation.targets.find(t => t.rootKey.startsWith(module === "PNT" ? "PNT:" : "QMS_RECORD:"))!;
  expect(target).toBeDefined();
  const rootId = target.rootKey.slice(target.rootKey.indexOf(":") + 1);
  const delegate = (inspector as unknown as Record<string, Domain>)[model];
  const entity = await delegate.findUniqueOrThrow({ where: module === "PNT" ? { id: rootId } : { qmsRecordId: rootId } });
  const operationCount = await inspector.auditOperation.count();
  expect(await settled(() => asUser(qa, () => actions[createName](...createArgs())))).toEqual(response);
  expect(await inspector.auditOperation.count()).toBe(operationCount);
  const field = module === "PNT" ? "observations" : "internalObservations";
  const editRequest = randomUUID();
  const reason = "Synthetic persisted correction context. ".repeat(30);
  const editValues: Record<string, string> = { ...values, [field]: "Persisted original-service edit", changeReason: reason, updatedAt: entity.updatedAt.toISOString(), expectedUpdatedAt: entity.updatedAt.toISOString(), _covexAuditRequestId: editRequest };
  await expect(asUser(reader, () => actions[editName](entity.id, { error: null }, form(editValues)))).rejects.toMatchObject({ status: 403 });
  const editResponse = await settled(() => asUser(qa, () => actions[editName](entity.id, { error: null }, form(editValues))));
  if (editResponse && typeof editResponse === "object" && "error" in editResponse && editResponse.error) throw Error("Original edit rejected: " + JSON.stringify(editResponse));
  const edited = await delegate.findUniqueOrThrow({ where: { id: entity.id } });
  expect(edited[field as keyof typeof edited]).toBe(editValues[field]);
  const editedOperation = await inspector.auditOperation.findFirstOrThrow({ where: { requestId: editRequest }, include: { events: true, evidence: true } });
  expect(editedOperation.reason).toBe(reason.trim());
  const event = editedOperation.events.find(e => e.entityId === entity.id && e.fieldPath === field)!;
  expect(event.oldValue).toEqual({ present: true, type: entity[field as keyof typeof entity] == null ? "NULL" : "STRING", value: entity[field as keyof typeof entity] ?? null });
  expect(event.newValue).toEqual({ present: true, type: "STRING", value: editValues[field] });
  expect(editedOperation.evidence.length).toBeGreaterThan(0);
  const events = await inspector.auditEvent.count();
  expect(await settled(() => asUser(qa, () => actions[editName](entity.id, { error: null }, form(editValues))))).toEqual(editResponse);
  expect(await inspector.auditEvent.count()).toBe(events);
}, 30000);

it.each([
  ["CAPA", "capa", "../../src/modules/capa/signed-document-actions", "uploadCapaSignedPdfAction"],
  ["CHANGE_CONTROL", "changeControl", "../../src/modules/change-control/signed-document-actions", "uploadChangeControlSignedPdfAction"],
  ["COMPLAINT", "complaint", "../../src/modules/complaints/signed-document-actions", "uploadComplaintSignedPdfAction"],
  ["RETURN", "returnRecord", "../../src/modules/returns/signed-document-actions", "uploadReturnSignedPdfAction"],
  ["AUDIT", "audit", "../../src/modules/audits/report-actions", "storeAuditSignedPdfAction"],
] as const)("retains %s signed originals through its original authorized action and preserves its replacement rules", async (module, model, file, name) => {
  const root = await inspector.qmsRecord.findFirstOrThrow({ where: { recordType: module, businessCode: { startsWith: "SYNTHETIC-B2-" + module + "-" } } });
  const entity = await (inspector as unknown as Record<string, Domain>)[model].findUniqueOrThrow({ where: { qmsRecordId: root.id } });
  const version = await inspector.qmsRecordVersion.findFirstOrThrow({ where: { qmsRecordId: root.id } });
  const action = (await import(file) as Record<string, Action>)[name];
  const bytes = Buffer.from("%PDF-1.7\nSynthetic original " + module + "\n%%EOF");
  const upload = (requestId: string, replacementReason = "") => {
    const fd = form({ actor: "Spoofed uploader", _covexAuditRequestId: requestId, replacementReason });
    fd.set("file", new File([bytes], "synthetic.pdf", { type: "application/pdf" })); return fd;
  };
  const run = (user: Principal, fd: FormData) => asUser(user, () => action(entity.id, module === "RETURN" ? "annex-iii" : version.id, { error: null, success: null }, fd));
  const requestId = randomUUID();
  await expect(run(reader, upload(requestId))).rejects.toMatchObject({ status: 403 });
  expect(await run(qa, upload(requestId))).toHaveProperty("error", null);
  const slot = await inspector.recordVersionDocument.findFirstOrThrow({ where: { recordVersionId: version.id }, include: { custody: { include: { originalDocument: true } } } });
  expect(slot.custody?.retainedByUserId).toBe(qa.id);
  expect(slot.custody?.identitySource).toBe("AUTHENTICATED_SERVER_SESSION");
  expect(Buffer.from(slot.custody!.originalDocument.fileData!)).toEqual(bytes);
  const op = await inspector.auditOperation.findFirstOrThrow({ where: { requestId }, include: { events: true, targets: true } });
  expect(op.actorUserId).toBe(qa.id); expect(op.targets.some(t => t.rootKey === "QMS_RECORD:" + root.id)).toBe(true);
  expect(op.events.some(e => e.entityType === "SignedDocumentCustody" && e.recordVersionId === version.id)).toBe(true);
  const before = { originals: await inspector.signedDocumentCustody.count(), versions: await inspector.qmsRecordVersion.count(), events: await inspector.auditEvent.count() };
  await run(qa, upload(requestId));
  expect({ originals: await inspector.signedDocumentCustody.count(), versions: await inspector.qmsRecordVersion.count(), events: await inspector.auditEvent.count() }).toEqual(before);
  expect(await run(qa, upload(randomUUID()))).toHaveProperty("error", expect.any(String));
  if (module === "AUDIT") {
    expect(await run(qa, upload(randomUUID(), "An audit requires a new formal revision"))).toHaveProperty("error", expect.any(String));
    expect(await inspector.signedDocumentCustody.count()).toBe(before.originals);
  } else {
    expect(await run(qa, upload(randomUUID(), "Synthetic explicit supersession"))).toHaveProperty("error", null);
    const current = await inspector.recordVersionDocument.findUniqueOrThrow({ where: { id: slot.id }, include: { custody: true } });
    expect(current.custody?.replacesId).toBe(slot.custodyId);
    expect(await inspector.qmsRecordVersion.count()).toBe(before.versions);
  }
}, 30000);

it("observes a stored legacy original without retrospective authenticated identity and rejects corrupt predecessors", async () => {
  const { uploadDeviationSignedPdfAction } = await import("../../src/modules/deviations/signed-document-actions");
  for (const corrupt of [false, true]) {
    const root = await inspector.qmsRecord.findFirstOrThrow({ where: { businessCode: { startsWith: "SYNTHETIC-B2-LEGACY-" + (corrupt ? "CORRUPT-" : "VALID-") } } });
    const record = await inspector.deviation.findUniqueOrThrow({ where: { qmsRecordId: root.id } });
    const version = await inspector.qmsRecordVersion.findFirstOrThrow({ where: { qmsRecordId: root.id } });
    const previous = await inspector.recordVersionDocument.findFirstOrThrow({ where: { recordVersionId: version.id } });
    const before = { originals: await inspector.generatedDocument.count(), custody: await inspector.signedDocumentCustody.count(), operations: await inspector.auditOperation.count() };
    const fd = form({ replacementReason: "Synthetic legacy original supersession", _covexAuditRequestId: randomUUID() });
    fd.set("file", new File(["%PDF-1.7\nNew received synthetic original\n%%EOF"], "new.pdf", { type: "application/pdf" }));
    const run = () => asUser(qa, () => uploadDeviationSignedPdfAction(record.id, version.id, { error: null, success: null }, fd));
    if (corrupt) {
      await expect(run()).rejects.toThrow();
      expect({ originals: await inspector.generatedDocument.count(), custody: await inspector.signedDocumentCustody.count(), operations: await inspector.auditOperation.count() }).toEqual(before);
      expect(await inspector.recordVersionDocument.findUniqueOrThrow({ where: { id: previous.id } })).toEqual(previous);
    } else {
      expect(await run()).toHaveProperty("error", null);
      const current = await inspector.recordVersionDocument.findUniqueOrThrow({ where: { id: previous.id }, include: { custody: { include: { replaces: { include: { originalDocument: true } } } } } });
      const observed = current.custody!.replaces!;
      expect(observed.sourceKind).toBe("OBSERVED_LEGACY_SIGNED_PDF"); expect(observed.retainedByUserId).toBe(qa.id);
      expect(observed.originalDocument.authenticatedUserId).toBeNull();
      expect(observed.originalDocument.generatedByText).toBe(previous.uploadedByText);
      expect(observed.originalDocument.generatedAt).toEqual(previous.uploadedAt);
      expect(observed.originalDocument.metadata).toMatchObject({ originalSnapshotKnown: false });
      expect(Buffer.from(observed.originalDocument.fileData!)).toEqual(Buffer.from(previous.fileData));
    }
  }
}, 30000);

it("rolls back a signed replacement's archive, current slot, history and receipt if mandatory capture fails", async () => {
  const { uploadDeviationSignedPdfAction } = await import("../../src/modules/deviations/signed-document-actions");
  const record = await inspector.deviation.findFirstOrThrow({ where: { qmsRecord: { businessCode: { startsWith: "SYNTHETIC-B2-LEGACY-VALID-" } } } });
  const slot = await inspector.recordVersionDocument.findFirstOrThrow({ where: { recordVersion: { qmsRecordId: record.qmsRecordId } } });
  const before = { originals: await inspector.generatedDocument.count(), custody: await inspector.signedDocumentCustody.count(), history: await inspector.changeHistory.count(), operations: await inspector.auditOperation.count(), events: await inspector.auditEvent.count(), receipts: await inspector.auditCommandResult.count() };
  await inspector.$executeRawUnsafe('ALTER TABLE "AuditEvent" ADD CONSTRAINT b2_document_capture_failure CHECK ("entityType"<>\'SignedDocumentCustody\') NOT VALID');
  try {
    const fd = form({ replacementReason: "Synthetic failed supersession", _covexAuditRequestId: randomUUID() });
    fd.set("file", new File(["%PDF-1.7\nMust roll back\n%%EOF"], "failed.pdf", { type: "application/pdf" }));
    await expect(asUser(qa, () => uploadDeviationSignedPdfAction(record.id, slot.recordVersionId, { error: null, success: null }, fd))).rejects.toThrow();
    expect(await inspector.recordVersionDocument.findUniqueOrThrow({ where: { id: slot.id } })).toEqual(slot);
    expect({ originals: await inspector.generatedDocument.count(), custody: await inspector.signedDocumentCustody.count(), history: await inspector.changeHistory.count(), operations: await inspector.auditOperation.count(), events: await inspector.auditEvent.count(), receipts: await inspector.auditCommandResult.count() }).toEqual(before);
  } finally { await inspector.$executeRawUnsafe('ALTER TABLE "AuditEvent" DROP CONSTRAINT b2_document_capture_failure'); }
}, 30000);

it("serializes signed supersessions and rejects a stale predecessor without losing either committed original", async () => {
  const record = await inspector.deviation.findFirstOrThrow({ where: { qmsRecord: { businessCode: { startsWith: "SYNTHETIC-B2-LEGACY-VALID-" } } } });
  const slot = await inspector.recordVersionDocument.findFirstOrThrow({ where: { recordVersion: { qmsRecordId: record.qmsRecordId } } });
  const { withBusinessAudit } = await import("../../src/lib/audit/business-service");
  const { retainSignedOriginal } = await import("../../src/lib/qms/signed-custody-service");
  let arrivals = 0, release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const before = { custody: await inspector.signedDocumentCustody.count(), operations: await inspector.auditOperation.count() };
  const commands = [0, 1].map(async index => asUser(qa, () => withBusinessAudit({ operationCode: "DV08", module: "DEVIATION", permission: "ATTACH_DOCUMENT" },
    { requestId: randomUUID(), digest: String(index + 1).repeat(64), reason: "Synthetic concurrent supersession" }, async tx => {
      const observed = await tx.recordVersionDocument.findUniqueOrThrow({ where: { id: slot.id } });
      if (++arrivals === 2) release(); await barrier;
      const bytes = Buffer.from("%PDF-1.7\nConcurrent original " + index + "\n%%EOF");
      const receipt = await retainSignedOriginal(tx, { recordVersionId: slot.recordVersionId, kind: slot.kind, bytes, fileName: "concurrent.pdf", actor: qa.name, expectedChecksum: observed.checksum, replacementReason: "Synthetic concurrent supersession" });
      await tx.recordVersionDocument.update({ where: { id: slot.id }, data: { custodyId: receipt.custodyId, fileName: "concurrent.pdf", fileData: bytes, fileSize: bytes.length, checksum: createHash("sha256").update(bytes).digest("hex"), uploadedByText: qa.name } });
    })));
  const results = await Promise.allSettled(commands);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1); expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
  expect(await inspector.signedDocumentCustody.count()).toBe(before.custody + 1);
  expect(await inspector.auditOperation.count()).toBe(before.operations + 1);
  const current = await inspector.recordVersionDocument.findUniqueOrThrow({ where: { id: slot.id }, include: { custody: { include: { replaces: { include: { originalDocument: true } } } } } });
  expect(current.custody?.replacesId).toBe(slot.custodyId);
  expect(Buffer.from(current.custody!.replaces!.originalDocument.fileData!)).toEqual(Buffer.from(slot.fileData));
}, 30000);

it("refuses a first formal PDF without custody even inside a valid mandatory business lease", async () => {
  const { withBusinessAudit } = await import("../../src/lib/audit/business-service");
  const root = await inspector.qmsRecord.findFirstOrThrow({ where: { businessCode: { startsWith: "SYNTHETIC-B2-LEGACY-VALID-" } } });
  const before = { versions: await inspector.qmsRecordVersion.count(), slots: await inspector.recordVersionDocument.count(), events: await inspector.auditEvent.count() };
  const bytes = Buffer.from("%PDF-1.7\nUncustodied received original\n%%EOF");
  const rejected = asUser(qa, () => withBusinessAudit({ operationCode: "DV08", module: "DEVIATION", permission: "ATTACH_DOCUMENT" }, { requestId: randomUUID(), digest: "e".repeat(64), reason: null }, async tx => {
    const version = await tx.qmsRecordVersion.create({ data: { qmsRecordId: root.id, sequenceNumber: 99, kind: "INITIAL", snapshot: { synthetic: true } } });
    await tx.recordVersionDocument.create({ data: { recordVersionId: version.id, kind: "SIGNED_PDF", fileName: "uncustodied.pdf", fileData: bytes, fileSize: bytes.length, checksum: createHash("sha256").update(bytes).digest("hex") } });
  }));
  await expect(rejected).rejects.toMatchObject({ cause: { message: expect.stringContaining("Mandatory original custody unavailable") } });
  expect({ versions: await inspector.qmsRecordVersion.count(), slots: await inspector.recordVersionDocument.count(), events: await inspector.auditEvent.count() }).toEqual(before);
}, 30000);

it("rolls back an original action's business, children, versions and journal when history fails", async () => {
  const { createDeviationAction } = await import("../../src/modules/deviations/actions");
  const before = { business: await inspector.deviation.count(), children: await inspector.deviationImmediateAction.count(), roots: await inspector.qmsRecord.count(), versions: await inspector.qmsRecordVersion.count(), events: await inspector.auditEvent.count(), operations: await inspector.auditOperation.count() };
  await inspector.$executeRawUnsafe('ALTER TABLE "ChangeHistory" ADD CONSTRAINT b2_original_history_failure CHECK (source::text=\'NEVER_SUCCESS\') NOT VALID');
  try {
    const response = await settled(() => asUser(qa, () => createDeviationAction({ error: null }, form({ status: "DRAFT", saveIntent: "draft", whatHappened: "Must roll back", immediateActionsJson: '[{"description":"Synthetic child","responsible":"External business owner"}]' }))));
    expect(response).toHaveProperty("error", expect.any(String));
    expect({ business: await inspector.deviation.count(), children: await inspector.deviationImmediateAction.count(), roots: await inspector.qmsRecord.count(), versions: await inspector.qmsRecordVersion.count(), events: await inspector.auditEvent.count(), operations: await inspector.auditOperation.count() }).toEqual(before);
  } finally { await inspector.$executeRawUnsafe('ALTER TABLE "ChangeHistory" DROP CONSTRAINT b2_original_history_failure'); }
});

it("rolls back an original action when PostgreSQL cannot persist its mandatory captured events", async () => {
  const { createDeviationAction } = await import("../../src/modules/deviations/actions");
  const before = { business: await inspector.deviation.count(), roots: await inspector.qmsRecord.count(), versions: await inspector.qmsRecordVersion.count(), history: await inspector.changeHistory.count(), events: await inspector.auditEvent.count(), operations: await inspector.auditOperation.count(), receipts: await inspector.auditCommandResult.count() };
  await inspector.$executeRawUnsafe('ALTER TABLE "AuditEvent" ADD CONSTRAINT b2_original_capture_failure CHECK ("fieldPath"<>\'id\') NOT VALID');
  try {
    const response = await settled(() => asUser(qa, () => createDeviationAction({ error: null }, form({ status: "DRAFT", saveIntent: "draft", whatHappened: "Mandatory capture failure must roll back" }))));
    expect(response).toHaveProperty("error", expect.any(String));
    expect({ business: await inspector.deviation.count(), roots: await inspector.qmsRecord.count(), versions: await inspector.qmsRecordVersion.count(), history: await inspector.changeHistory.count(), events: await inspector.auditEvent.count(), operations: await inspector.auditOperation.count(), receipts: await inspector.auditCommandResult.count() }).toEqual(before);
  } finally { await inspector.$executeRawUnsafe('ALTER TABLE "AuditEvent" DROP CONSTRAINT b2_original_capture_failure'); }
});

it("captures original user admission/role policy writers, typed authorization evidence and retry without changing the permission matrix", async () => {
  const { administerUser, configureRole } = await import("../../src/lib/auth/administration");
  const role = await inspector.authRole.findUniqueOrThrow({ where: { key: "READER" } });
  const input = { objectId: randomUUID(), displayName: "Synthetic B2 administration subject", email: "b2-subject@example.invalid", active: true, roleIds: [role.id], departmentIds: [], assignments: [], reason: "Synthetic controlled user admission" };
  await expect(asUser(reader, () => administerUser(input))).rejects.toMatchObject({ status: 403 });
  const requestId = randomUUID(), fd = form({ _covexAuditRequestId: requestId });
  const userId = await asUser(admin, () => administerUser(input, fd));
  expect(typeof userId).toBe("string");
  const operation = await inspector.auditOperation.findFirstOrThrow({ where: { requestId }, include: { events: true, evidence: true } });
  expect(operation.actorUserId).toBe(admin.id); expect(operation.operation).toBe("TR05");
  expect(operation.events.some(e => e.entityType === "AuthUser" && e.fieldPath === "authorizedAt")).toBe(true);
  expect(operation.events.every(e => !["email", "displayName", "tenantId", "objectId", "tokenHash"].includes(e.fieldPath))).toBe(true);
  const history = await inspector.authAuthorizationChange.findFirstOrThrow({ where: { targetUserId: String(userId) } });
  expect(operation.evidence.some(e => e.authorizationChangeId === history.id)).toBe(true);
  const count = await inspector.auditOperation.count();
  expect(await asUser(admin, () => administerUser(input, fd))).toBe(userId);
  expect(await inspector.auditOperation.count()).toBe(count);
  const candidate = await inspector.authRole.findUniqueOrThrow({ where: { key: "B2_CANDIDATE_ROLE_FIXTURE" } });
  const proposalId = randomUUID();
  await asUser(admin, () => configureRole({ roleId: candidate.id, grants: [{ module: "DEVIATION", permission: "EDIT", scope: "ASSIGNED" }], reason: "Synthetic role proposal without acceptance" }, form({ _covexAuditRequestId: proposalId })));
  const proposed = await inspector.auditOperation.findFirstOrThrow({ where: { requestId: proposalId }, include: { events: true } });
  expect(proposed.events.some(e => e.entityType === "AuthRolePermission" && e.fieldPath === "permission")).toBe(true);
  expect((await inspector.authRole.findUniqueOrThrow({ where: { id: candidate.id } })).qaAcceptedAt).toBeNull();
  const before = { user: await inspector.authUser.findUniqueOrThrow({ where: { id: String(userId) } }), events: await inspector.auditEvent.count(), operations: await inspector.auditOperation.count() };
  await inspector.$executeRawUnsafe('ALTER TABLE "AuthAuthorizationChange" ADD CONSTRAINT b2_auth_history_failure CHECK (action=\'NEVER_SUCCESS\') NOT VALID');
  try {
    await expect(asUser(admin, () => administerUser({ ...input, id: String(userId), active: false, reason: "Synthetic failed withdrawal must roll back" }))).rejects.toThrow();
    expect(await inspector.authUser.findUniqueOrThrow({ where: { id: String(userId) } })).toEqual(before.user);
    expect(await inspector.auditOperation.count()).toBe(before.operations); expect(await inspector.auditEvent.count()).toBe(before.events);
  } finally { await inspector.$executeRawUnsafe('ALTER TABLE "AuthAuthorizationChange" DROP CONSTRAINT b2_auth_history_failure'); }
}, 30000);

it("captures original Review thread/message/acceptance/resolution actions without treating comments as GMP approval", async () => {
  const actions = await import("../../src/lib/qms/review/actions");
  const record = await inspector.deviation.findFirstOrThrow({ where: { internalObservations: "Persisted original-service edit", status: "DRAFT" } });
  const requestId = randomUUID();
  const input = { qmsRecordId: record.qmsRecordId, targetKind: "FIELD" as const, tabKey: "summary", sectionKey: "identification", fieldPath: "classification", initialMessage: "Synthetic review observation", createdByText: "Spoofed reviewer", _covexAuditRequestId: requestId };
  await expect(asUser(reader, () => actions.createReviewThreadAction(input))).rejects.toMatchObject({ status: 403 });
  const response = await asUser(qa, () => actions.createReviewThreadAction(input)) as Awaited<ReturnType<typeof actions.createReviewThreadAction>>;
  expect(response.error).toBeNull(); expect(response.threads?.length).toBeGreaterThan(0);
  const thread = await inspector.reviewThread.findUniqueOrThrow({ where: { id: response.reviewThreadId! }, include: { messages: true } });
  expect(thread.authenticatedUserId).toBe(qa.id); expect(thread.createdByText).toBe(qa.name);
  expect(thread.messages[0].authenticatedUserId).toBe(qa.id);
  const op = await inspector.auditOperation.findFirstOrThrow({ where: { requestId }, include: { events: true, commandResult: true } });
  expect(op.operation).toBe("TR01"); expect(op.events.some(e => e.entityType === "ReviewThread")).toBe(true); expect(op.events.some(e => e.entityType === "ReviewMessage")).toBe(true);
  expect(JSON.stringify(op.commandResult!.outcome)).not.toContain("Synthetic review observation");
  const count = await inspector.auditEvent.count();
  const retried = await asUser(qa, () => actions.createReviewThreadAction(input)) as typeof response;
  expect(retried.reviewThreadId).toBe(response.reviewThreadId); expect(retried.threads?.length).toBeGreaterThan(0);
  expect(await inspector.auditEvent.count()).toBe(count);
  const replyId = randomUUID();
  const replied = await asUser(qa, () => actions.replyToReviewThreadAction({ qmsRecordId: record.qmsRecordId, reviewThreadId: thread.id, message: "Synthetic reply", _covexAuditRequestId: replyId })) as typeof response;
  expect(replied.error).toBeNull();
  const reply = await inspector.auditOperation.findFirstOrThrow({ where: { requestId: replyId }, include: { events: true } });
  expect(reply.events.some(e => e.entityType === "ReviewMessage" && e.fieldPath === "message" && JSON.stringify(e.newValue).includes("Synthetic reply"))).toBe(true);
  const accepted = await asUser(qa, () => actions.acceptReviewThreadAction({ qmsRecordId: record.qmsRecordId, reviewThreadId: thread.id, _covexAuditRequestId: randomUUID() })) as typeof response;
  expect(accepted.status).toBe("ACCEPTED");
  const resolved = await asUser(qa, () => actions.resolveReviewThreadAction({ qmsRecordId: record.qmsRecordId, reviewThreadId: thread.id, resolutionNote: "Synthetic documented resolution", _covexAuditRequestId: randomUUID() })) as typeof response;
  expect(resolved.status).toBe("RESOLVED");
  const noReply = await asUser(qa, () => actions.replyToReviewThreadAction({ qmsRecordId: record.qmsRecordId, reviewThreadId: thread.id, message: "Rejected after resolution" })) as typeof response;
  expect(noReply.error).toBeTruthy();
  expect(await inspector.reviewMessage.count({ where: { reviewThreadId: thread.id } })).toBe(2);
}, 30000);

it("captures the original administrative-status HTTP writer, rejects readers and preserves response/retry", async () => {
  const { POST } = await import("../../src/app/api/qms/[id]/administrative-status/route");
  const record = await inspector.qmsRecord.findFirstOrThrow({ where: { recordType: "DEVIATION", businessCode: { startsWith: "SYNTHETIC-B2-DEVIATION-" } } });
  const origin = process.env.AUTH_ORIGIN!;
  const requestId = randomUUID();
  const request = (action: string, id = requestId) => new Request(origin + "/api/qms/" + record.id + "/administrative-status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, reason: "Synthetic controlled administrative transition", actor: "Spoofed actor", _covexAuditRequestId: id }) });
  const route = async (user: Principal, action: string, id = requestId) => await asUser(user, () => POST(request(action, id), { params: Promise.resolve({ id: record.id }) })) as Response;
  expect((await route(reader, "ANNUL")).status).toBe(403);
  const response = await route(qa, "ANNUL"); expect(response.status).toBe(200); expect(await response.json()).toEqual({ ok: true, status: "ANNULLED" });
  const operation = await inspector.auditOperation.findFirstOrThrow({ where: { requestId }, include: { events: true, evidence: true } });
  expect(operation.operation).toBe("DV07"); expect(operation.actorUserId).toBe(qa.id);
  expect(operation.events.some(e => e.fieldPath === "isActive" && JSON.stringify(e.newValue).includes("false"))).toBe(true);
  expect(operation.evidence.length).toBeGreaterThan(0);
  const count = await inspector.auditEvent.count();
  expect(await (await route(qa, "ANNUL")).json()).toEqual({ ok: true, status: "ANNULLED" });
  expect(await inspector.auditEvent.count()).toBe(count);
  const restored = await route(qa, "REACTIVATE", randomUUID()); expect(restored.status).toBe(200);
  expect((await inspector.qmsRecord.findUniqueOrThrow({ where: { id: record.id } })).businessCode).toBe(record.businessCode);
});

it("captures original PNT document and manual-state HTTP services with preserved originals, identity and SERIALIZABLE composition", async () => {
  const { masterAction } = await import("../../src/modules/controlled-documents/actions");
  const { POST: attach } = await import("../../src/app/api/controlled-documents/[id]/revisions/[revisionId]/documents/route");
  const { POST: state } = await import("../../src/app/api/controlled-documents/[id]/revisions/[revisionId]/manual-status/route");
  const department = await inspector.department.findUniqueOrThrow({ where: { code: "GC-00" } });
  const saved = await asUser(qa, () => masterAction(null, {}, form({ operation: "REGISTER", baseCode: "GC-00/999", title: "Synthetic audited PNT master", departmentId: department.id, revisionCode: "00", changeReason: "Synthetic explicit master and revision registration" }))) as { url?: string; error?: string };
  expect(saved.error).toBeUndefined();
  const master = await inspector.controlledDocument.findUniqueOrThrow({ where: { baseCode: "GC-00/999" }, include: { revisions: true } });
  const revision = master.revisions[0];
  const origin = process.env.AUTH_ORIGIN!;
  const params = { params: Promise.resolve({ id: master.id, revisionId: revision.id }) };
  const bytes = new TextEncoder().encode("%PDF-1.7\nSynthetic retained PNT original\n%%EOF");
  const uploadId = randomUUID();
  const upload = () => { const fd = form({ mode: "file", kind: "DOCUMENT_PDF", _covexAuditRequestId: uploadId }); fd.set("file", new File([bytes], "synthetic-original.pdf", { type: "application/pdf" })); return new Request(origin + "/api/controlled-documents/" + master.id + "/revisions/" + revision.id + "/documents", { method: "POST", headers: { origin }, body: fd }); };
  expect((await asUser(reader, () => attach(upload(), params)) as Response).status).toBe(403);
  const response = await asUser(qa, () => attach(upload(), params)) as Response; expect(response.status).toBe(201);
  const objectId = (await response.json()).id as string;
  const object = await inspector.controlledRevisionDocument.findUniqueOrThrow({ where: { id: objectId } });
  expect(Array.from(object.fileData!)).toEqual(Array.from(bytes)); expect(object.authenticatedUserId).toBe(qa.id);
  const operation = await inspector.auditOperation.findFirstOrThrow({ where: { requestId: uploadId }, include: { events: true } });
  expect(operation.operation).toBe("PN05"); expect(operation.events.every(e => e.fieldPath !== "fileData")).toBe(true);
  expect((await asUser(qa, () => attach(upload(), params)) as Response).status).toBe(201);
  expect(await inspector.controlledRevisionDocument.count({ where: { revisionId: revision.id } })).toBe(1);
  const stateId = randomUUID();
  const change = () => new Request(origin + "/api/controlled-documents/" + master.id + "/revisions/" + revision.id + "/manual-status", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ requestId: stateId, expectedVersion: 0, expectedUpdatedAt: revision.updatedAt.toISOString(), targetStatus: "IN_REVIEW", reason: "Synthetic explicit manual-state change" }) });
  const changed = await asUser(qa, () => state(change(), params)) as Response; expect(changed.status).toBe(201);
  expect((await inspector.controlledDocumentRevision.findUniqueOrThrow({ where: { id: revision.id } })).status).toBe("IN_REVIEW");
  expect((await inspector.auditOperation.findFirstOrThrow({ where: { requestId: stateId } })).operation).toBe("PN04");
  expect((await asUser(qa, () => state(change(), params)) as Response).status).toBe(201);
  const updated = await inspector.controlledDocumentRevision.findUniqueOrThrow({ where: { id: revision.id } });
  const subsequentId = randomUUID();
  const subsequent = () => new Request(origin + "/api/controlled-documents/" + master.id + "/revisions/" + revision.id + "/manual-status", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ requestId: subsequentId, expectedVersion: 1, expectedUpdatedAt: updated.updatedAt.toISOString(), targetStatus: "DRAFT", reason: "Synthetic return to draft with an existing lifecycle projection" }) });
  expect((await asUser(qa, () => state(subsequent(), params)) as Response).status).toBe(201);
  expect((await inspector.controlledRevisionLifecycle.findUniqueOrThrow({ where: { revisionId: revision.id } })).version).toBe(2);
}, 30000);

it("captures the original PNT lifecycle, explicit successor activation, predecessor retirement and rectification with existing projections", async () => {
  const { POST } = await import("../../src/app/api/controlled-documents/[id]/revisions/[revisionId]/lifecycle/route");
  const { POST: attach } = await import("../../src/app/api/controlled-documents/[id]/revisions/[revisionId]/documents/route");
  const { revisionAction } = await import("../../src/modules/controlled-documents/actions");
  const master = await inspector.controlledDocument.findUniqueOrThrow({ where: { baseCode: "GC-00/999" }, include: { revisions: true } });
  const origin = process.env.AUTH_ORIGIN!;
  const execute = async (revisionId: string, operation: string, evidenceId: string, extra: Record<string, unknown> = {}) => {
    const projection = await inspector.controlledRevisionLifecycle.findUnique({ where: { revisionId } });
    const requestId = randomUUID();
    const input = { requestId, expectedVersion: projection?.version ?? 0, operation, reason: "Synthetic documented " + operation, notes: "Synthetic documentary assessment", evidenceIds: [evidenceId], ...extra };
    const request = () => new Request(origin + "/api/controlled-documents/" + master.id + "/revisions/" + revisionId + "/lifecycle", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(input) });
    const params = { params: Promise.resolve({ id: master.id, revisionId }) };
    expect((await asUser(reader, () => POST(request(), params)) as Response).status).toBe(403);
    const response = await asUser(qa, () => POST(request(), params)) as Response;
    const body = await response.json(); if (response.status !== 201) throw Error("Original lifecycle rejected: " + JSON.stringify(body));
    const journal = await inspector.auditOperation.findFirstOrThrow({ where: { requestId }, include: { events: true, evidence: true } });
    expect(journal.actorUserId).toBe(qa.id); expect(journal.reason).toBe(input.reason);
    expect(journal.events.some(e => e.entityType === "ControlledRevisionDecision" && e.fieldPath === "operation" && JSON.stringify(e.newValue).includes(operation))).toBe(true);
    expect(journal.evidence.some(e => e.controlledDocumentChangeId)).toBe(true);
    const count = await inspector.auditEvent.count();
    expect((await asUser(qa, () => POST(request(), params)) as Response).status).toBe(201); expect(await inspector.auditEvent.count()).toBe(count);
    return body.id as string;
  };
  const activate = async (revisionId: string, evidenceId: string, previousRevisionId: string | null) => {
    await execute(revisionId, "VERIFY", evidenceId, { result: "FAVORABLE" });
    for (const functionName of ["PREPARATION", "REVIEW"] as const) {
      const registrationId = await execute(revisionId, "REGISTER_EXTERNAL", evidenceId, { function: functionName, externalPerson: "External synthetic " + functionName, responsibility: "Synthetic business responsibility", authorityBasis: "Synthetic documentary basis", accreditedDate: "2025-12-01" });
      await execute(revisionId, "CONTRAST_EXTERNAL", evidenceId, { result: "ACCEPTED", registrationId });
    }
    await execute(revisionId, "SUBMIT", evidenceId);
    const registrationId = await execute(revisionId, "REGISTER_EXTERNAL", evidenceId, { function: "APPROVAL", externalPerson: "External synthetic approver", responsibility: "Synthetic business responsibility", authorityBasis: "Synthetic documentary basis", accreditedDate: "2025-12-02" });
    await execute(revisionId, "CONTRAST_EXTERNAL", evidenceId, { result: "ACCEPTED", registrationId });
    await execute(revisionId, "PLAN", evidenceId, { finalDocumentId: evidenceId, separationConfirmed: true, effectiveFrom: "2026-01-01", reviewDueAt: "2027-01-01" });
    await execute(revisionId, "ACTIVATE", evidenceId, { previousRevisionId });
    expect((await inspector.controlledDocumentRevision.findUniqueOrThrow({ where: { id: revisionId } })).status).toBe("IN_FORCE");
  };
  const first = master.revisions[0], firstObject = await inspector.controlledRevisionDocument.findFirstOrThrow({ where: { revisionId: first.id } });
  await activate(first.id, firstObject.id, null);
  expect(await asUser(qa, () => revisionAction(master.id, null, {}, form({ operation: "REGISTER", revisionCode: "01", changeReason: "Synthetic explicit successor revision" })))).not.toHaveProperty("error");
  const successor = await inspector.controlledDocumentRevision.findUniqueOrThrow({ where: { documentId_revisionCode: { documentId: master.id, revisionCode: "01" } } });
  const fd = form({ mode: "file", kind: "DOCUMENT_PDF", _covexAuditRequestId: randomUUID() });
  fd.set("file", new File(["%PDF-1.7\nSynthetic successor original\n%%EOF"], "successor.pdf", { type: "application/pdf" }));
  const attached = await asUser(qa, () => attach(new Request(origin + "/api/controlled-documents/" + master.id + "/revisions/" + successor.id + "/documents", { method: "POST", headers: { origin }, body: fd }), { params: Promise.resolve({ id: master.id, revisionId: successor.id }) })) as Response;
  expect(attached.status).toBe(201); const successorObjectId = (await attached.json()).id as string;
  await activate(successor.id, successorObjectId, first.id);
  expect((await inspector.controlledDocumentRevision.findUniqueOrThrow({ where: { id: first.id } })).status).toBe("OBSOLETE");
  expect((await inspector.controlledRevisionDocument.findUniqueOrThrow({ where: { id: firstObject.id } })).fileData).toEqual(firstObject.fileData);
  const retirement = await execute(successor.id, "RETIRE", successorObjectId);
  await execute(successor.id, "RECTIFY", successorObjectId, { rectifiesId: retirement });
  expect((await inspector.controlledDocumentRevision.findUniqueOrThrow({ where: { id: successor.id } })).status).toBe("OBSOLETE");
}, 60000);

it("retains exact immutable signed originals and an authenticated supersession through the original deviation upload action", async () => {
  const { uploadDeviationSignedPdfAction } = await import("../../src/modules/deviations/signed-document-actions");
  const record = await inspector.deviation.findFirstOrThrow({ where: { internalObservations: "Persisted original-service edit", status: "DRAFT" } });
  const version = await inspector.qmsRecordVersion.findFirstOrThrow({ where: { qmsRecordId: record.qmsRecordId }, orderBy: { sequenceNumber: "desc" } });
  const originals = [new TextEncoder().encode("%PDF-1.7\nSynthetic original one\n%%EOF"), new TextEncoder().encode("%PDF-1.7\nSynthetic replacement two\n%%EOF")];
  const upload = (index: number, requestId: string, reason = "") => {
    const fd = form({ actor: "Spoofed PDF uploader", replacementReason: reason, _covexAuditRequestId: requestId });
    fd.set("file", new File([originals[index]], "synthetic-original-" + index + ".pdf", { type: "application/pdf" })); return fd;
  };
  const firstId = randomUUID();
  await expect(asUser(reader, () => uploadDeviationSignedPdfAction(record.id, version.id, { error: null, success: null }, upload(0, firstId)))).rejects.toMatchObject({ status: 403 });
  const first = await asUser(qa, () => uploadDeviationSignedPdfAction(record.id, version.id, { error: null, success: null }, upload(0, firstId))) as { error: string | null };
  expect(first.error).toBeNull();
  const firstSlot = await inspector.recordVersionDocument.findUniqueOrThrow({ where: { recordVersionId_kind: { recordVersionId: version.id, kind: "SIGNED_PDF" } }, include: { custody: { include: { originalDocument: true } } } });
  const { purgeLegacyFixtureDocuments } = await import("./legacy-cleanup");
  await expect(purgeLegacyFixtureDocuments(inspector, { id: firstSlot.id })).rejects.toThrow("Non-audited disposable fixture and its controlled owner required");
  expect(firstSlot.custody?.retainedByUserId).toBe(qa.id); expect(firstSlot.uploadedByText).toBe(qa.name);
  expect(firstSlot.custody?.sourceKind).toBe("RECEIVED_SIGNED_PDF");
  expect(Array.from(firstSlot.custody!.originalDocument.fileData!)).toEqual(Array.from(originals[0]));
  expect(firstSlot.checksum).toBe(createHash("sha256").update(originals[0]).digest("hex"));
  const firstOperation = await inspector.auditOperation.findFirstOrThrow({ where: { requestId: firstId }, include: { events: true } });
  expect(firstOperation.events.some(e => e.entityType === "SignedDocumentCustody")).toBe(true);
  expect(firstOperation.events.some(e => e.generatedDocumentId === firstSlot.custody!.originalDocumentId && e.documentChecksum === firstSlot.checksum)).toBe(true);
  const count = { custody: await inspector.signedDocumentCustody.count(), events: await inspector.auditEvent.count(), versions: await inspector.qmsRecordVersion.count() };
  const denied = await asUser(qa, () => uploadDeviationSignedPdfAction(record.id, version.id, { error: null, success: null }, upload(1, randomUUID()))) as typeof first;
  expect(denied.error).toBeTruthy(); expect(await inspector.signedDocumentCustody.count()).toBe(count.custody);
  const replacementId = randomUUID(), reason = "Synthetic explicit replacement of received original";
  const second = await asUser(qa, () => uploadDeviationSignedPdfAction(record.id, version.id, { error: null, success: null }, upload(1, replacementId, reason))) as typeof first;
  expect(second.error).toBeNull();
  const secondSlot = await inspector.recordVersionDocument.findUniqueOrThrow({ where: { id: firstSlot.id }, include: { custody: { include: { originalDocument: true, replaces: { include: { originalDocument: true } } } } } });
  expect(secondSlot.custody!.replacesId).toBe(firstSlot.custodyId); expect(secondSlot.custody!.reason).toBe(reason);
  expect(Array.from(secondSlot.custody!.originalDocument.fileData!)).toEqual(Array.from(originals[1]));
  expect(Array.from(secondSlot.custody!.replaces!.originalDocument.fileData!)).toEqual(Array.from(originals[0]));
  expect(await inspector.qmsRecordVersion.count()).toBe(count.versions);
  const totals = { custody: await inspector.signedDocumentCustody.count(), events: await inspector.auditEvent.count() };
  await asUser(qa, () => uploadDeviationSignedPdfAction(record.id, version.id, { error: null, success: null }, upload(1, replacementId, reason)));
  expect({ custody: await inspector.signedDocumentCustody.count(), events: await inspector.auditEvent.count() }).toEqual(totals);
  const app = (await import("../../src/lib/db")).prisma;
  await expect(app.generatedDocument.update({ where: { id: firstSlot.custody!.originalDocumentId }, data: { fileName: "Forbidden rewrite.pdf" } })).rejects.toThrow();
  const { withBusinessAudit } = await import("../../src/lib/audit/business-service");
  await expect(asUser(qa, () => withBusinessAudit({ operationCode: "DV08", module: "DEVIATION", permission: "ATTACH_DOCUMENT" }, { requestId: randomUUID(), digest: "c".repeat(64), reason: "Synthetic forbidden original metadata rewrite" }, async tx => {
    await tx.generatedDocument.update({ where: { id: firstSlot.custody!.originalDocumentId }, data: { fileName: "Forbidden within a valid audited command.pdf" } });
  }))).rejects.toThrow();
  await expect(inspector.generatedDocument.update({ where: { id: firstSlot.custody!.originalDocumentId }, data: { fileData: originals[1] } })).rejects.toThrow();
  await expect(inspector.generatedDocument.delete({ where: { id: firstSlot.custody!.originalDocumentId } })).rejects.toThrow();
  await expect(inspector.signedDocumentCustody.update({ where: { id: firstSlot.custodyId! }, data: { reason: "Forbidden rewrite" } })).rejects.toThrow();
  expect(await inspector.signedDocumentCustody.count()).toBe(totals.custody);
  const { GET } = await import("../../src/app/api/qms/[id]/document-originals/[custodyId]/route");
  const request = () => new Request(process.env.AUTH_ORIGIN! + "/api/qms/" + record.qmsRecordId + "/document-originals/" + firstSlot.custodyId);
  const params = { params: Promise.resolve({ id: record.qmsRecordId, custodyId: firstSlot.custodyId! }) };
  expect((await asUser(admin, () => GET(request(), params)) as Response).status).toBe(403);
  expect((await asUser(reader, () => GET(request(), params)) as Response).status).toBe(200); // Existing fixture role explicitly grants DOWNLOAD.
  const downloaded = await asUser(qa, () => GET(request(), params)) as Response;
  expect(downloaded.status).toBe(200); expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(originals[0]);
  expect(downloaded.headers.get("x-checksum-sha256")).toBe(firstSlot.checksum);
  const other = await inspector.qmsRecord.findFirstOrThrow({ where: { id: { not: record.qmsRecordId }, recordType: "DEVIATION" } });
  expect((await asUser(qa, () => GET(request(), { params: Promise.resolve({ id: other.id, custodyId: firstSlot.custodyId! }) })) as Response).status).toBe(404);
}, 30000);
