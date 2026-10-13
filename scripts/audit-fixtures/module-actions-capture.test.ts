import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { isolatedTestEnvironment } from "../../src/lib/auth/config";
import { identityContext, type Principal } from "../../src/lib/auth/context";
import { fixtureUsers } from "../auth-fixtures/constants";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;` }); } }));
const url = new URL(process.env.DATABASE_URL!), ownerUrl = new URL(process.env.B2_CAPTURE_INSPECTOR_URL!);
if (!isolatedTestEnvironment() || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== ownerUrl.pathname || !/^\/covex_phase4b1_test_b2_capture_[a-f0-9]+$/.test(url.pathname)) throw Error("Own disposable capture fixture required");
const inspector = new PrismaClient({ datasourceUrl: ownerUrl.href, log: [] });
let qa: Principal, reader: Principal;
beforeAll(async () => {
  const { issueSession, sessionFromToken } = await import("../../src/lib/auth/session");
  qa = (await sessionFromToken((await issueSession(fixtureUsers.qa.id)).token)).principal;
  reader = (await sessionFromToken((await issueSession(fixtureUsers.reader.id)).token)).principal;
});
afterAll(async () => { await inspector.$disconnect(); await (await import("../../src/lib/db")).prisma.$disconnect(); });
type Action = (...args: unknown[]) => Promise<unknown>;
const asUser = (user: Principal, run: () => Promise<unknown>) => identityContext.run({ principal: user, testHarness: true }, run);
const form = (values: Record<string, string>) => { const fd = new FormData(); for (const [key, value] of Object.entries(values)) fd.set(key, value); return fd; };
const settled = async (run: () => Promise<unknown>) => {
  try { return await run(); }
  catch (error) { if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT;")) return { redirect: error.digest }; throw error; }
};
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
