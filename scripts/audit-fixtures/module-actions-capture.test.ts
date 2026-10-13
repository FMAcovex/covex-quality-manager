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
}, 30000);
