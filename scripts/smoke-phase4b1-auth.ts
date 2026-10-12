import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { authConfiguration, isolatedTestEnvironment } from "../src/lib/auth/config";
import { identityContext, type AccessModule, type Principal } from "../src/lib/auth/context";
import { assertPermission } from "../src/lib/auth/policy";
import { authorizedAction } from "../src/lib/auth/action-guard";
import { authorizedRoute } from "../src/lib/auth/route-guard";
import { administerUser, configureRole } from "../src/lib/auth/administration";
import { principalById, hash, sessionFromToken } from "../src/lib/auth/session";
import { fixtureUsers } from "./auth-fixtures/constants";
import { installAuthFixtures } from "./auth-fixtures/install";
import { fixtureLogin, fixtureRequest } from "./auth-fixtures/http";

async function main() {
  assert(isolatedTestEnvironment()); authConfiguration(); await installAuthFixtures();
  const qaLogin = await fixtureLogin(); assert(qaLogin.success, "Positive OIDC login with signed ID token, state/nonce/PKCE");
  const user = await principalById(fixtureUsers.qa.id), reader = await principalById(fixtureUsers.reader.id), admin = await principalById(fixtureUsers.admin.id);
  const asUser = <T>(principal: Principal, run: () => T) => identityContext.run({ principal, testHarness: true }, run);
  assert.equal((await fixtureRequest(qaLogin.jar, "/api/auth/session")).status, 200);
  assert.equal((await prisma.authSession.findUniqueOrThrow({ where: { tokenHash: hash(qaLogin.jar.get("covex-session")!) } })).userId, user.id);
  assert.equal((await fixtureRequest(qaLogin.jar, qaLogin.callback)).headers.get("location")?.includes("error=access"), true, "Callback replay refused");
  for (const testCase of ["state", "nonce", "issuer", "audience", "tenant", "signature", "expired"]) assert.equal((await fixtureLogin("qa", testCase)).success, false, "OIDC negative: " + testCase);
  for (const fixture of ["inactive", "unadmitted"] as const) assert.equal((await fixtureLogin(fixture)).success, false, fixture + " account refused");
  assert.equal((await fixtureLogin("qa", "", randomUUID())).success, false, "A tenant account absent from the admission registry is refused");

  const departments = await prisma.department.findMany({ take: 2, orderBy: { code: "asc" } }); assert.equal(departments.length, 2);
  await prisma.authUserDepartment.upsert({ where: { userId_departmentId: { userId: fixtureUsers.manager.id, departmentId: departments[0].id } }, create: { userId: fixtureUsers.manager.id, departmentId: departments[0].id }, update: {} });
  const manager = await principalById(fixtureUsers.manager.id), marker = "AUTH4B1-" + randomUUID().slice(0, 8);
  const modules: AccessModule[] = ["DEVIATION", "CAPA", "CHANGE_CONTROL", "COMPLAINT", "RETURN", "AUDIT", "PNT"];
  const actions = ["updateDeviationAction", "updateCapaAction", "updateChangeControlAction", "updateComplaintAction", "updateReturnAction", "saveAuditAction", "masterAction"];
  const routes = ["deviations", "capa", "changes", "complaints", "returns", "audits", "controlled-documents"];
  for (let i = 0; i < modules.length; i++) {
    const accessModule = modules[i], form = new FormData(); form.set("actor", "Impostor del navegador"); form.set("completedByText", "Responsable de negocio externo");
    const entities: { id: string; qmsRecordId?: string }[] = [];
    for (const department of departments) {
      const common = { department: { connect: { id: department.id } }, qmsRecord: { create: { recordType: accessModule as "DEVIATION", businessCode: marker + "-" + accessModule + "-" + department.id, year: 2026 } } };
      if (accessModule === "DEVIATION") entities.push(await prisma.deviation.create({ data: common }));
      if (accessModule === "CAPA") entities.push(await prisma.capa.create({ data: { ...common, actionType: "CORRECTIVE" } }));
      if (accessModule === "CHANGE_CONTROL") entities.push(await prisma.changeControl.create({ data: common }));
      if (accessModule === "COMPLAINT") entities.push(await prisma.complaint.create({ data: { ...common, complaintType: "CUSTOMER" } }));
      if (accessModule === "RETURN") entities.push(await prisma.returnRecord.create({ data: { ...common, returnType: "COMMERCIAL" } }));
      if (accessModule === "AUDIT") entities.push(await prisma.audit.create({ data: { qmsRecord: common.qmsRecord, title: marker, codingDepartment: { connect: { id: department.id } }, departments: { create: { departmentId: department.id, departmentCodeSnapshot: department.code, departmentNameSnapshot: department.name } } } }));
      if (accessModule === "PNT") entities.push(await prisma.controlledDocument.create({ data: { departmentId: department.id, title: marker, createdByText: "Autor histórico sintético" } }));
    }
    const readerLogin = await fixtureLogin("reader"); assert(readerLogin.success);
    for (const entity of entities) {
      const path = "/" + routes[i] + "/" + entity.id;
      const anonymous = await fetch(authConfiguration().origin + path, { redirect: "manual" }), html = await anonymous.text();
      assert(anonymous.status === 307 || (html.includes("NEXT_REDIRECT") && html.includes("/login")), "Anonymous page redirects to login " + accessModule);
      assert(!html.includes(marker), "Anonymous streaming response contains no business data " + accessModule);
      assert.equal((await fixtureRequest(readerLogin.jar, path)).status, 200, "Global cross-department read " + accessModule);
    }
    const args = (id: string) => accessModule === "AUDIT" || accessModule === "PNT" ? [id, {}, form] : [id, {}, form];
    const blocked = async (principal: Principal, id: string) => {
      let executed = false;
      await assert.rejects(asUser(principal, () => authorizedAction(actions[i], args(id), async () => { executed = true; })), e => Boolean(e && typeof e === "object" && "status" in e && e.status === 403)); assert.equal(executed, false);
    };
    await blocked(reader, entities[0].id); await blocked(admin, entities[0].id); await blocked(manager, entities[1].id);
    let actor = "";
    await asUser(manager, () => authorizedAction(actions[i], args(entities[0].id), async values => { actor = String((values[2] as FormData).get("actor")); })); assert.equal(actor, manager.name);
    form.set("status", "CLOSED"); await blocked(manager, entities[0].id); form.delete("status");
    const assigned = entities[1].qmsRecordId ?? entities[1].id;
    await prisma.authRecordAssignment.upsert({ where: { userId_module_recordId: { userId: manager.id, module: accessModule, recordId: assigned } }, create: { userId: manager.id, module: accessModule, recordId: assigned }, update: {} });
    await asUser(manager, () => authorizedAction(actions[i], args(entities[1].id), async () => undefined));
    await prisma.authRecordAssignment.deleteMany({ where: { userId: manager.id, module: accessModule, recordId: assigned } });
    await blocked(manager, entities[1].id);
    const qaRole = await prisma.authRole.findUniqueOrThrow({ where: { key: "QUALITY_ASSURANCE" } });
    await prisma.authRolePermission.deleteMany({ where: { roleId: qaRole.id, module: accessModule, permission: "EDIT" } });
    await blocked(user, entities[0].id);
    assert.equal((await fixtureRequest(qaLogin.jar, "/api/auth/session")).status, 200, "Session stays valid while grants reload");
    await prisma.authRolePermission.create({ data: { roleId: qaRole.id, module: accessModule, permission: "EDIT", scope: "ALL" } });
    if (entities[0].qmsRecordId) {
      const recordId = entities[0].qmsRecordId!, before = await prisma.qmsRecordVersion.create({ data: { qmsRecordId: recordId, sequenceNumber: 0, kind: "INITIAL", snapshot: { synthetic: marker }, frozenAt: new Date(), createdByText: "Autor histórico sintético" } });
      await asUser(user, () => authorizedAction(actions[i], args(entities[0].id), async values => {
        assert.equal((values[2] as FormData).get("actor"), user.name); assert.equal((values[2] as FormData).get("completedByText"), "Responsable de negocio externo");
        await prisma.changeHistory.create({ data: { qmsRecordId: recordId, changedByText: "Impostor", fieldPath: "__auth_test__", source: "UI" } });
      }));
      const event = await prisma.changeHistory.findFirstOrThrow({ where: { qmsRecordId: recordId, fieldPath: "__auth_test__" } }); assert.equal(event.authenticatedUserId, user.id); assert.equal(event.changedByText, user.name);
      assert.deepEqual(await prisma.qmsRecordVersion.findUniqueOrThrow({ where: { id: before.id } }), before, "Frozen historical snapshot and attribution remain byte-equivalent");
    }
  }
  await assert.rejects(asUser(admin, () => administerUser({ id: admin.id, objectId: admin.objectId, displayName: admin.name, email: admin.email, active: true, roleIds: [], departmentIds: [], assignments: [], reason: "Intento de elevar privilegios propios" })), /propias/);
  const technical = await prisma.authRole.findUniqueOrThrow({ where: { key: "TECHNICAL_ADMIN" } });
  await assert.rejects(asUser(admin, () => configureRole({ roleId: technical.id, grants: [], reason: "Intento de alterar rol propio" })), /propio/);
  const readerRole = await prisma.authRole.findUniqueOrThrow({ where: { key: "READER" } });
  const objectId = randomUUID(), newId = await asUser(admin, () => administerUser({ objectId, displayName: "Alta administrativa sintética", email: "admission@example.invalid", active: true, roleIds: [readerRole.id], departmentIds: [], assignments: [], reason: "Admisión sintética expresamente autorizada para regresión" }));
  const admitted = await fixtureLogin("qa", "", objectId); assert(admitted.success);
  const administrativeEvent = await prisma.authAuthorizationChange.findFirstOrThrow({ where: { targetUserId: newId, action: "USER_ADMITTED" } }); assert.equal(administrativeEvent.actorUserId, admin.id);
  await assert.rejects(asUser(admin, () => administerUser({ id: newId, objectId: randomUUID(), displayName: "Cambio indebido", email: "admission@example.invalid", active: true, roleIds: [], departmentIds: [], assignments: [], reason: "Intento de cambiar identidad estable" })), /estable/);
  await asUser(admin, () => administerUser({ id: newId, objectId, displayName: "Alta administrativa sintética", email: "admission@example.invalid", active: false, roleIds: [readerRole.id], departmentIds: [], assignments: [], reason: "Baja sintética autorizada para verificar revocación" }));
  assert.equal((await fixtureRequest(admitted.jar, "/api/auth/session")).status, 401);
  const operator = await prisma.authRole.findUniqueOrThrow({ where: { key: "OPERATOR" } });
  await asUser(admin, () => configureRole({ roleId: operator.id, grants: [{ module: "PNT", permission: "ATTACH_DOCUMENT", scope: "ALL" }], reason: "Nueva política sintética todavía pendiente de QA/DT" }));
  const pendingOperator = await principalById(fixtureUsers.documentWriter.id);
  assert.throws(() => assertPermission(pendingOperator, "PNT", "ATTACH_DOCUMENT"));
  assert.doesNotThrow(() => assertPermission(pendingOperator, "PNT", "READ"));
  await installAuthFixtures();
  for (const permission of ["REVIEW", "CLOSE", "PNT_ACCEPT_APPROVAL"] as const) assert.throws(() => assertPermission(admin, "PNT", permission));
  const beforeCsrf = await prisma.authAuthorizationChange.count();
  const invalid = await fetch(authConfiguration().origin + "/auth/logout", { method: "POST", headers: { cookie: [...qaLogin.jar].map(([k, v]) => k + "=" + v).join("; "), origin: authConfiguration().origin } }); assert.equal(invalid.status, 403); assert.equal(await prisma.authAuthorizationChange.count(), beforeCsrf);
  const token = qaLogin.jar.get("covex-session")!, where = { tokenHash: hash(token) };
  const configuredTenant = process.env.AUTH_ENTRA_TENANT_ID;
  try {
    process.env.AUTH_ENTRA_TENANT_ID = "55555555-5555-4555-8555-555555555555";
    await assert.rejects(sessionFromToken(token), /tenant autorizado/, "Server sessions also remain bound to the configured tenant");
  } finally { process.env.AUTH_ENTRA_TENANT_ID = configuredTenant; }
  await prisma.authSession.update({ where, data: { expiresAt: new Date(Date.now() - 1) } }); await assert.rejects(sessionFromToken(token), /vigente/);
  await prisma.authSession.update({ where, data: { expiresAt: new Date(Date.now() + 60000), lastSeenAt: new Date(Date.now() - 31 * 60000) } }); await assert.rejects(sessionFromToken(token), /vigente/);
  await prisma.authSession.update({ where, data: { lastSeenAt: new Date(), revokedAt: new Date() } }); await assert.rejects(sessionFromToken(token), /vigente/);
  const login = await fixtureLogin(); assert(login.success); assert.equal((await fixtureRequest(login.jar, "/auth/logout", { method: "POST" })).status, 303); assert.equal((await fixtureRequest(login.jar, "/api/auth/session")).status, 401);
  const run = async () => Response.json({ shouldNeverRun: true });
  const route = await authorizedRoute("src/app/api/deviations/export/simple/route.ts", "GET", [new Request(authConfiguration().origin + "/api/deviations/export/simple")], run); assert.equal(route.status, 401);
  console.log("4B1 PostgreSQL/OIDC OK: signature/issuer/audience/tenant/state/nonce/expiry/replay; admission; all seven modules global reads and scoped operations; session/grant revocation; self-escalation; authenticated actor; historic snapshot integrity; CSRF and logout.");
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Security regression failed"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
