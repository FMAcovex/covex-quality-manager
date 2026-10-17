import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { identityContext, type Principal } from "../../src/lib/auth/context";
import { isolatedTestEnvironment } from "../../src/lib/auth/config";
import { fixtureUsers } from "../auth-fixtures/constants";

// D-088, OOS-2b: original OOS writers inside the B2 envelope (OO01-OO05).
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;` }); } }));
const url = new URL(process.env.DATABASE_URL!), ownerUrl = new URL(process.env.B2_CAPTURE_INSPECTOR_URL!);
if (!isolatedTestEnvironment() || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== ownerUrl.pathname || !/^\/covex_phase4b1_test_b2_capture_[a-f0-9]+$/.test(url.pathname)) throw Error("Own disposable capture fixture required");
const inspector = new PrismaClient({ datasourceUrl: ownerUrl.href, log: [] });
let qa: Principal, reader: Principal, oosId = "";
beforeAll(async () => {
  const { issueSession, sessionFromToken } = await import("../../src/lib/auth/session");
  qa = (await sessionFromToken((await issueSession(fixtureUsers.qa.id)).token)).principal;
  reader = (await sessionFromToken((await issueSession(fixtureUsers.reader.id)).token)).principal;
});
afterAll(async () => { await inspector.$disconnect(); await (await import("../../src/lib/db")).prisma.$disconnect(); });
const asUser = <T>(user: Principal, execute: () => Promise<T>) => identityContext.run({ principal: user, testHarness: true }, execute);
const form = (values: Record<string, string>) => { const fd = new FormData(); Object.entries(values).forEach(([key, value]) => fd.set(key, value)); return fd; };
const settled = async (execute: () => Promise<unknown>) => { try { return await execute(); } catch (error) { if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT;")) return { redirect: error.digest }; throw error; } };
const operation = (requestId: string) => inspector.auditOperation.findUniqueOrThrow({ where: { actorUserId_origin_requestId: { actorUserId: qa.id, origin: "QMS_SERVER", requestId } }, include: { events: true, targets: true, evidence: true } });
const totals = async () => ({ operations: await inspector.auditOperation.count(), events: await inspector.auditEvent.count() });
const rejected = (result: unknown) => expect(result).toHaveProperty("error", expect.any(String));
const accepted = (result: unknown) => { if (result && typeof result === "object" && "error" in result && result.error) throw Error("Synthetic OOS command rejected: " + JSON.stringify(result)); };

it("captures original OOS opening, Phase I/II edits, critical reason and closure", async () => {
  const actions = await import("../../src/modules/oos/actions");
  const department = await inspector.department.findUniqueOrThrow({ where: { code: "GC-00" } });
  const base: Record<string, string> = { status: "OPEN", area: "MD", departmentId: department.id, issueDate: "2026-10-17", materialKind: "RAW_OR_PACKAGING_MATERIAL", materialName: "Synthetic B2 OOS material", lotNumber: "SYN-OOS-01", oosDate: "2026-10-16", detectionDescription: "Synthetic assay result outside specification", createdByText: "Spoofed actor" };
  const create = (requestId: string) => [{ error: null }, form({ ...base, _covexAuditRequestId: requestId })] as const;
  const openId = randomUUID();
  await expect(asUser(reader, () => actions.createOosAction(...create(openId)))).rejects.toMatchObject({ status: 403 });
  accepted(await settled(() => asUser(qa, () => actions.createOosAction(...create(openId)))));
  const opened = await operation(openId);
  expect(opened.operation).toBe("OO01"); expect(opened.actorUserId).toBe(qa.id); expect(opened.reason).toBeNull();
  const created = opened.events.find(event => event.entityType === "OosRecord" && event.fieldPath === "id")!;
  const record = await inspector.oosRecord.findUniqueOrThrow({ where: { id: created.entityId }, include: { qmsRecord: true } });
  oosId = record.id;
  expect(record.status).toBe("OPEN"); expect(record.qmsRecord.businessCode).toMatch(/^OOS\/MD\/\d{3}\/2026$/);
  expect(opened.targets.some(target => target.rootKey === "QMS_RECORD:" + record.qmsRecordId)).toBe(true);
  expect(opened.events.some(event => event.entityType === "QmsRecord" && event.fieldPath === "businessCode")).toBe(true);
  expect(opened.evidence.some(item => item.changeHistoryId)).toBe(true);

  const edit = async (values: Record<string, string>) => {
    const requestId = randomUUID();
    return { requestId, result: await settled(() => asUser(qa, () => actions.updateOosAction(record.id, { error: null }, form({ ...base, ...values, _covexAuditRequestId: requestId })))) };
  };
  // First value of a critical field: ordinary Phase I edit, no reason required.
  const phaseI = { phaseIInvestigation: "Synthetic Phase I investigation", phaseIConclusion: "Synthetic: no laboratory error confirmed" };
  const first = await edit(phaseI); accepted(first.result);
  const firstOperation = await operation(first.requestId);
  expect(firstOperation.operation).toBe("OO02"); expect(firstOperation.reason).toBeNull();
  expect(firstOperation.events.find(event => event.fieldPath === "phaseIInvestigation")).toMatchObject({ oldValue: { present: true, type: "NULL", value: null }, newValue: { present: true, type: "STRING", value: phaseI.phaseIInvestigation } });

  // Correcting a persisted critical value requires an explicit reason; the rejection writes nothing.
  const before = { totals: await totals(), record: await inspector.oosRecord.findUniqueOrThrow({ where: { id: record.id } }) };
  rejected((await edit({ ...phaseI, phaseIInvestigation: "Synthetic corrected investigation" })).result);
  expect(await totals()).toEqual(before.totals);
  expect(await inspector.oosRecord.findUniqueOrThrow({ where: { id: record.id } })).toEqual(before.record);
  const corrected = await edit({ ...phaseI, phaseIInvestigation: "Synthetic corrected investigation", changeReason: "Synthetic documented critical correction" }); accepted(corrected.result);
  const correction = await operation(corrected.requestId);
  expect(correction.operation).toBe("OO02"); expect(correction.reason).toBe("Synthetic documented critical correction");
  expect(correction.events.find(event => event.fieldPath === "phaseIInvestigation")?.oldValue).toEqual({ present: true, type: "STRING", value: phaseI.phaseIInvestigation });

  // Phase II (Anexo IV) and closure name their own matrix rows.
  const phaseII = { ...phaseI, phaseIInvestigation: "Synthetic corrected investigation", phaseIDisposition: "FULL_SCALE", phaseIIProductionReview: "Synthetic production review" };
  const fullScale = await edit(phaseII); accepted(fullScale.result);
  expect((await operation(fullScale.requestId)).operation).toBe("OO03");
  const closing = { ...phaseII, status: "CLOSED", phaseIIConclusion: "Synthetic: no single root cause", phaseIIVerdict: "REJECTED", phaseIIIssuedBy: "Synthetic QA", phaseIIIssuedAt: "2026-10-17", investigationResult: "INCONCLUSIVE", closedAt: "2026-10-17" };
  const unreasoned = await totals();
  rejected((await edit(closing)).result);
  expect(await totals()).toEqual(unreasoned);
  const closed = await edit({ ...closing, changeReason: "Synthetic closure of the investigation" }); accepted(closed.result);
  const closure = await operation(closed.requestId);
  expect(closure.operation).toBe("OO04"); expect(closure.reason).toBe("Synthetic closure of the investigation");
  expect(closure.events.find(event => event.fieldPath === "status")).toMatchObject({ oldValue: { value: "OPEN" }, newValue: { value: "CLOSED" } });
  expect(closure.events.find(event => event.fieldPath === "investigationResult")?.newValue).toEqual({ present: true, type: "STRING", value: "INCONCLUSIVE" });
  const assessment = await inspector.auditOperationAssessment.findUniqueOrThrow({ where: { operationId: closure.id } });
  expect(assessment.proposedCritical).toBe(true);
}, 60000);

it("captures OOS relations to CAPA and the administrative annulment across both roots", async () => {
  const actions = await import("../../src/modules/oos/actions");
  const record = await inspector.oosRecord.findUniqueOrThrow({ where: { id: oosId } });
  const capa = await inspector.capa.findFirstOrThrow({ where: { status: { not: "DRAFT" }, qmsRecord: { isActive: true, businessCode: { not: null } } }, include: { qmsRecord: true } });
  const linkId = randomUUID();
  const link = () => [record.id, { error: null }, form({ recordType: "CAPA", targetRecordId: capa.qmsRecordId, businessCode: capa.qmsRecord.businessCode!, actor: "Spoofed actor", _covexAuditRequestId: linkId })] as const;
  await expect(asUser(reader, () => actions.addOosRelationAction(...link()))).rejects.toMatchObject({ status: 403 });
  expect(await asUser(qa, () => actions.addOosRelationAction(...link()))).toMatchObject({ error: null });
  const linked = await operation(linkId);
  expect(linked.operation).toBe("OO05");
  expect(linked.events.some(event => event.entityType === "QmsRelation" && event.fieldPath === "targetRecordId")).toBe(true);
  expect(linked.targets.map(target => target.rootKey).sort()).toEqual(["QMS_RECORD:" + capa.qmsRecordId, "QMS_RECORD:" + record.qmsRecordId].sort());
  const count = await inspector.auditEvent.count();
  expect(await asUser(qa, () => actions.addOosRelationAction(...link()))).toMatchObject({ error: null });
  expect(await inspector.auditEvent.count()).toBe(count);

  const unlinkId = randomUUID();
  await settled(() => asUser(qa, () => actions.unlinkOosRelationAction(record.id, capa.qmsRecordId, form({ actor: "Spoofed actor", _covexAuditRequestId: unlinkId }))));
  const unlinked = await operation(unlinkId);
  expect(unlinked.operation).toBe("OO05");
  expect(unlinked.events.some(event => event.entityType === "QmsRelation" && event.fieldPath === "isActive" && JSON.stringify(event.newValue).includes("false"))).toBe(true);

  const { POST } = await import("../../src/app/api/qms/[id]/administrative-status/route");
  const origin = process.env.AUTH_ORIGIN!;
  const status = async (user: Principal, action: string, requestId: string) => await asUser(user, () => POST(new Request(origin + "/api/qms/" + record.qmsRecordId + "/administrative-status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, reason: "Synthetic controlled OOS annulment", actor: "Spoofed actor", _covexAuditRequestId: requestId }) }), { params: Promise.resolve({ id: record.qmsRecordId }) })) as Response;
  const annulId = randomUUID();
  expect((await status(reader, "ANNUL", annulId)).status).toBe(403);
  expect((await status(qa, "ANNUL", annulId)).status).toBe(200);
  const annulled = await inspector.auditOperation.findFirstOrThrow({ where: { requestId: annulId }, include: { events: true } });
  expect(annulled.operation).toBe("OO05"); expect(annulled.accessModule).toBe("OOS");
  expect(annulled.events.some(event => event.fieldPath === "isActive" && JSON.stringify(event.newValue).includes("false"))).toBe(true);
  expect((await status(qa, "REACTIVATE", randomUUID())).status).toBe(200);
  expect((await inspector.qmsRecord.findUniqueOrThrow({ where: { id: record.qmsRecordId } })).isActive).toBe(true);
}, 60000);
