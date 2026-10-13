import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { identityContext, type Principal } from "../../src/lib/auth/context";
import { isolatedTestEnvironment } from "../../src/lib/auth/config";
import { fixtureUsers } from "../auth-fixtures/constants";
import { syntheticWorkbook, headings } from "../../src/modules/controlled-documents/preview/synthetic-workbook";
import type { PreviewRow } from "../../src/modules/controlled-documents/preview/types";

vi.mock("server-only", () => ({}));
const url = new URL(process.env.DATABASE_URL!), ownerUrl = new URL(process.env.B2_CAPTURE_INSPECTOR_URL!);
if (!isolatedTestEnvironment() || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== ownerUrl.pathname || !/^\/covex_phase4b1_test_b2_capture_[a-f0-9]+$/.test(url.pathname)) throw Error("Own disposable capture fixture required");
const inspector = new PrismaClient({ datasourceUrl: ownerUrl.href, log: [] });
let qa: Principal, reader: Principal;
beforeAll(async () => {
  const audit = await import("../../src/lib/audit/business-service"), original = audit.withBusinessAuditResult;
  vi.spyOn(audit, "withBusinessAuditResult").mockImplementation(async <T>(...args: Parameters<typeof original>): Promise<T> => {
    try { return await original(...args) as T; }
    catch (error) {
      const cause = (error as { cause?: { name?: string; code?: string; meta?: {code?: string}; message?: string } }).cause;
      // Disposable fixtures only; no DETAIL, SQL statement or workbook payload.
      console.error("Synthetic import command rejected", (error as {code?: string}).code, cause?.name, cause?.code ?? cause?.meta?.code, cause?.name === "Error" ? cause.message?.slice(0,150) : cause?.message?.match(/message: "([^"\n]*)"/)?.[1]);
      throw error;
    }
  });
  const { issueSession, sessionFromToken } = await import("../../src/lib/auth/session");
  qa = (await sessionFromToken((await issueSession(fixtureUsers.qa.id)).token)).principal;
  reader = (await sessionFromToken((await issueSession(fixtureUsers.reader.id)).token)).principal;
});
afterAll(async () => { await inspector.$disconnect(); await (await import("../../src/modules/controlled-documents/import/database")).importDb.$disconnect(); await (await import("../../src/lib/db")).prisma.$disconnect(); });
const asUser = <T>(user: Principal, execute: () => Promise<T>) => identityContext.run({ principal: user, testHarness: true }, execute);
const bytes = (codes: string[]) => syntheticWorkbook([{ name: "GC-00(", rows: [{ number: 1, cells: headings }, ...codes.map((code, index) => ({ number: index + 2, cells: { B: code, C: "Synthetic import " + code, D: 0 } }))] }]);
async function upload(user: Principal, codes: string[], requestId = randomUUID()) {
  const { POST } = await import("../../src/app/api/controlled-documents/index-preview/route");
  const form = new FormData(); form.set("file", new File([new Uint8Array(bytes(codes))], "synthetic-index.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })); form.set("saveBatch", "on"); form.set("actor", "Spoofed import executor");
  return asUser(user, () => POST(new Request(process.env.AUTH_ORIGIN! + "/api/controlled-documents/index-preview", { method: "POST", headers: { "idempotency-key": requestId }, body: form })));
}
async function command(user: Principal, id: string, operation: string, input: unknown, requestId = randomUUID()) {
  const { POST } = await import("../../src/app/api/controlled-documents/import-batches/[id]/route");
  return asUser(user, () => POST(new Request(process.env.AUTH_ORIGIN! + "/api/controlled-documents/import-batches/" + id, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": requestId }, body: JSON.stringify({ operation, input }) }), { params: Promise.resolve({ id }) }));
}
async function reconcile(id: string) {
  const department = await inspector.department.findUniqueOrThrow({ where: { code: "GC-00" } });
  const rows = await inspector.controlledDocumentImportRow.findMany({ where: { batchId: id }, orderBy: { sourceKey: "asc" } });
  for (const row of rows) {
    const batch = await inspector.controlledDocumentImportBatch.findUniqueOrThrow({ where: { id } });
    const normalized = (row.data as unknown as PreviewRow).normalized;
    const response = await command(qa, id, "DECIDE", { actor: "Spoofed decision actor", version: batch.version, sourceKey: row.sourceKey, decision: "INCLUDE", scope: "ROW", reason: "Synthetic manually reconciled source", resolution: { title: normalized.title, revisionCode: normalized.revisionCode ?? "", effectiveFrom: "", reviewDueAt: "", declaredState: normalized.declaredState, departmentId: department.id, reviewed: true, reason: "Synthetic manual documentary reconciliation" } });
    expect(response.status).toBe(200);
  }
  const prepared = await command(qa, id, "PREPARE", { actor: "Spoofed proposal actor" });
  expect(prepared.status).toBe(200);
  const { plan } = await prepared.json();
  return { actor: "Spoofed confirmation actor", version: plan.version, token: plan.token, eligibleKeys: plan.eligibleKeys, explicitlyConfirmed: true };
}

it("captures original HTTP index import, authenticated provenance, persisted proposal/confirmation references and replay", async () => {
  const codes = ["GC-00/951"];
  expect((await upload(reader, codes)).status).toBe(403);
  const createId = randomUUID(), uploaded = await upload(qa, codes, createId);
  expect(uploaded.status).toBe(200); const id = (await uploaded.json()).batchId as string;
  const created = await inspector.auditOperation.findUniqueOrThrow({ where: { actorUserId_origin_requestId: { actorUserId: qa.id, origin: "QMS_SERVER", requestId: createId } }, include: { events: true, commandResult: true } });
  expect(created.operation).toBe("PN06"); expect(created.actorName).toBe(qa.name);
  expect(created.events.some(e => e.entityType === "ControlledDocumentImportRow")).toBe(true);
  expect((await inspector.controlledDocumentImportBatch.findUniqueOrThrow({ where: { id } })).actor).toBe(qa.name);
  expect((await (await upload(qa, codes, createId)).json()).batchId).toBe(id);
  const input = await reconcile(id);
  const proposal = await inspector.controlledDocumentImportEvent.findFirstOrThrow({ where: { batchId: id, action: "PROPOSED" } });
  expect(proposal.authenticatedUserId).toBe(qa.id); expect(proposal.actor).toBe(qa.name);
  const confirmationId = randomUUID();
  expect((await command(reader, id, "CONFIRM", input, confirmationId)).status).toBe(403);
  const response = await command(qa, id, "CONFIRM", input, confirmationId); if (!response.ok) throw Error("Synthetic original import rejected: " + JSON.stringify(await response.json())); expect(response.status).toBe(200);
  const result = await response.json(); expect(result.result.retried).toBe(false);
  const record = await inspector.controlledDocument.findUniqueOrThrow({ where: { baseCode: codes[0] }, include: { revisions: true, changes: true } });
  expect(record.createdByText).toBe(qa.name); expect(record.administrativeStatus).toBe("DRAFT"); expect(record.verificationStatus).toBe("UNVERIFIED");
  expect(record.revisions[0].status).toBe("IMPORTED_PENDING"); expect(record.revisions[0].registeredByText).toBe(qa.name);
  expect(record.changes.every(change => change.authenticatedUserId === qa.id)).toBe(true);
  const captured = await inspector.auditOperation.findUniqueOrThrow({ where: { actorUserId_origin_requestId: { actorUserId: qa.id, origin: "QMS_SERVER", requestId: confirmationId } }, include: { events: true, targets: true, evidence: true, commandResult: true } });
  expect(captured.targets.some(target => target.rootKey === "ADMINISTRATION:PNT_IMPORT")).toBe(true);
  expect(captured.targets.some(target => target.rootKey === "PNT:" + record.id)).toBe(true);
  expect(captured.events.some(event => event.entityType === "ControlledDocumentRevision" && event.fieldPath === "status" && JSON.stringify(event.oldValue).includes("ABSENT") && JSON.stringify(event.newValue).includes("IMPORTED_PENDING"))).toBe(true);
  expect(captured.events.some(event => event.entityType === "ControlledDocumentImportRow" && event.fieldPath === "result" && JSON.stringify(event.oldValue).includes("NULL") && JSON.stringify(event.newValue).includes(record.id))).toBe(true);
  expect(captured.evidence.filter(e => e.controlledDocumentChangeId)).toHaveLength(2);
  const receipt = JSON.stringify(captured.commandResult!.outcome);
  expect(receipt.length).toBeLessThan(500); expect(receipt).not.toContain(input.token); expect(receipt).not.toContain("Synthetic import");
  const totals = { operations: await inspector.auditOperation.count(), events: await inspector.auditEvent.count(), history: await inspector.controlledDocumentChange.count(), confirmations: await inspector.controlledDocumentImportEvent.count({ where: { batchId: id, action: "CONFIRMED" } }) };
  expect((await command(qa, id, "CONFIRM", input, confirmationId)).status).toBe(200);
  expect({ operations: await inspector.auditOperation.count(), events: await inspector.auditEvent.count(), history: await inspector.controlledDocumentChange.count(), confirmations: await inspector.controlledDocumentImportEvent.count({ where: { batchId: id, action: "CONFIRMED" } }) }).toEqual(totals);
  expect((await (await command(qa, id, "CONFIRM", input)).json()).result.retried).toBe(true);
  const reimport = await upload(qa, codes); const nextId = (await reimport.json()).batchId as string;
  const nextInput = await reconcile(nextId); expect((await command(qa, nextId, "CONFIRM", nextInput)).status).toBe(200);
  expect(await inspector.controlledDocument.findUniqueOrThrow({ where: { id: record.id }, include: { revisions: true, changes: true } })).toEqual(record);
}, 30000);

it("rolls back an original two-row import after the second business insertion loses mandatory capture", async () => {
  const codes = ["GC-00/956","GC-00/957"], uploaded = await upload(qa, codes), id = (await uploaded.json()).batchId as string;
  const input = await reconcile(id);
  const before = { documents: await inspector.controlledDocument.count(), revisions: await inspector.controlledDocumentRevision.count(), history: await inspector.controlledDocumentChange.count(), events: await inspector.auditEvent.count(), operations: await inspector.auditOperation.count(), receipts: await inspector.auditCommandResult.count(), batch: await inspector.controlledDocumentImportBatch.findUniqueOrThrow({ where: { id }, include: { rows: { orderBy: { id: "asc" } } } }) };
  const failedCode = before.batch.rows.find(row => row.sourceKey === input.eligibleKeys[1])!.baseCode;
  expect(codes).toContain(failedCode);
  await inspector.$executeRawUnsafe(`ALTER TABLE "AuditEvent" ADD CONSTRAINT b2_import_second_capture_failure CHECK ("entityType"<>'ControlledDocument' OR "fieldPath"<>'baseCode' OR "newValue"->>'value'<>'${failedCode}') NOT VALID`);
  try {
    expect((await command(qa, id, "CONFIRM", input)).status).toBe(400);
    expect({ documents: await inspector.controlledDocument.count(), revisions: await inspector.controlledDocumentRevision.count(), history: await inspector.controlledDocumentChange.count(), events: await inspector.auditEvent.count(), operations: await inspector.auditOperation.count(), receipts: await inspector.auditCommandResult.count(), batch: await inspector.controlledDocumentImportBatch.findUniqueOrThrow({ where: { id }, include: { rows: { orderBy: { id: "asc" } } } }) }).toEqual(before);
    const marker = await inspector.controlledDocumentImportEvent.findFirstOrThrow({ where: { batchId: id, action: "ERROR" } });
    expect(marker.authenticatedUserId).toBe(qa.id); expect(marker.detail).toEqual({ category: "CONFIRMATION_REJECTED_OR_ROLLED_BACK" });
  } finally { await inspector.$executeRawUnsafe('ALTER TABLE "AuditEvent" DROP CONSTRAINT b2_import_second_capture_failure'); }
}, 30000);

it("preserves original SERIALIZABLE confirmation under concurrent requests without duplicate records or confirmations", async () => {
  const codes = ["GC-00/958"], uploaded = await upload(qa, codes), id = (await uploaded.json()).batchId as string;
  const input = await reconcile(id);
  const results = await Promise.all([command(qa, id, "CONFIRM", input), command(qa, id, "CONFIRM", input)]);
  expect(results.some(response => response.status === 200)).toBe(true);
  expect(results.every(response => [200,400].includes(response.status))).toBe(true);
  expect(await inspector.controlledDocument.count({ where: { baseCode: codes[0] } })).toBe(1);
  expect(await inspector.controlledDocumentImportEvent.count({ where: { batchId: id, action: "CONFIRMED" } })).toBe(1);
  const row = await inspector.controlledDocumentImportRow.findFirstOrThrow({ where: { batchId: id } }); expect(row.result).not.toBeNull();
}, 30000);
