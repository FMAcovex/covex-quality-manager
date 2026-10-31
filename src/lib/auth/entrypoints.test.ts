import { describe, expect, it, vi } from "vitest";
import { identityContext, type Principal } from "./context";
import { authConfiguration } from "./config";
import { authorizedRoute } from "./route-guard";
import { authorizedAction, authenticatedArguments } from "./action-guard";
import inventory from "./operation-inventory.json";
import { createDeviationAction } from "@/modules/deviations/actions";
import { createCapaAction } from "@/modules/capa/actions";
import { createChangeControlAction } from "@/modules/change-control/actions";
import { createComplaintAction } from "@/modules/complaints/actions";
import { createReturnAction } from "@/modules/returns/actions";
import { saveAuditAction } from "@/modules/audits/actions";
import { masterAction } from "@/modules/controlled-documents/actions";
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));
const principal: Principal = { id: "reader", tenantId: "tenant", objectId: "oid", name: "Consulta sintética", email: "reader@example.invalid", roles: ["READER"], active: true, authorized: true, grants: [], departmentIds: [], assignments: [] };
function configureTest() {
  vi.stubEnv("AUTH_PROVIDER", "synthetic"); vi.stubEnv("AUTH_SYNTHETIC_IDENTITY", "1"); vi.stubEnv("APP_ENV", "test"); vi.stubEnv("DATABASE_URL", "postgresql://test:test@127.0.0.1/covex_phase4b1_test_unit"); vi.stubEnv("AUTH_ORIGIN", "http://127.0.0.1:3000"); vi.stubEnv("AUTH_TEST_ISSUER", "http://127.0.0.1:5459"); vi.stubEnv("AUTH_ENTRA_TENANT_ID", "11111111-1111-4111-8111-111111111111"); vi.stubEnv("AUTH_ENTRA_CLIENT_ID", "22222222-2222-4222-8222-222222222222"); vi.stubEnv("AUTH_ENTRA_CLIENT_SECRET", "synthetic_unit_test_secret");
}
describe("4B1 protección directa de entradas", () => {
  it.each(inventory.routes.filter(r => !r.public))("$method $file: rechazo anónimo antes de leer datos", async route => {
    configureTest(); const run = vi.fn(async () => Response.json({ confidential: true }));
    const response = await authorizedRoute(route.file, route.method, [new Request("http://127.0.0.1:3000/api/test", { method: route.method })], run);
    expect(response.status).toBe(401); expect(run).not.toHaveBeenCalled();
  });
  it("las siete Server Actions reales deniegan un usuario solo de consulta", async () => {
    const calls = [() => createDeviationAction({ error: null }, new FormData()), () => createCapaAction({ error: null }, new FormData()), () => createChangeControlAction({ error: null }, new FormData()), () => createComplaintAction({ error: null }, new FormData()), () => createReturnAction({ error: null }, new FormData()), () => saveAuditAction(null, { error: null }, new FormData()), () => masterAction(null, {}, new FormData())];
    for (const call of calls) await identityContext.run({ principal, unitTest: true }, () => expect(call()).rejects.toMatchObject({ status: 403 }));
  });
  it.each(inventory.actions)("$name: llamada directa anónima falla antes del núcleo", async action => {
    configureTest(); const run = vi.fn(async () => "mutation");
    await expect(authorizedAction(action.name, [], run)).rejects.toMatchObject({ status: 401 }); expect(run).not.toHaveBeenCalled();
  });
  it("la autoría autenticada sustituye solo actores operativos y conserva responsables de negocio", () => {
    const form = new FormData(); form.set("actor", "Impostor"); form.set("createdByText", "Autor histórico"); form.set("completedByText", "Responsable externo");
    const [edit] = authenticatedArguments([form], "Sesión QA") as FormData[];
    expect(edit.get("actor")).toBe("Sesión QA"); expect(edit.get("createdByText")).toBe("Autor histórico"); expect(edit.get("completedByText")).toBe("Responsable externo");
    const [creation] = authenticatedArguments([form], "Sesión QA", true) as FormData[]; expect(creation.get("createdByText")).toBe("Sesión QA");
    expect(authenticatedArguments([{ qmsRecordId: "id", acceptedByText: "Impostor", _covexCsrf: "transient" }], "Sesión QA", false, "acceptReviewThreadAction")[0]).toEqual({ qmsRecordId: "id", acceptedByText: "Sesión QA" });
  });
  it("un tipo de operación de auditoría desconocido no convierte EDIT en FOLLOWUP", async () => {
    configureTest();
    const editor: Principal = { ...principal, id: "synthetic-editor", grants: [{ module: "AUDIT", permission: "EDIT", scope: "ALL" }] };
    const run = vi.fn(async () => "must not write a followup");
    const args = ["synthetic-audit", "unknown-kind", undefined, undefined, { error: null }, new FormData()];
    for (const kind of ["unknown-kind", ["followup"], ["finding"], null, {}]) {
      await identityContext.run({ principal: editor, unitTest: true }, () => expect(authorizedAction("saveAuditChildAction", [args[0],kind,...args.slice(2)], run)).rejects.toMatchObject({ status: 403 }));
    }
    expect(run).not.toHaveBeenCalled();
    await identityContext.run({ principal: editor, unitTest: true }, () => expect(authorizedAction("saveAuditChildAction", [args[0],"followup",...args.slice(2)], run)).rejects.toMatchObject({ status: 403 }));
    await identityContext.run({ principal: editor, unitTest: true }, () => expect(authorizedAction("saveAuditChildAction", [args[0],"finding",...args.slice(2)], run)).resolves.toBe("must not write a followup"));
  });
  it("cerrar un hallazgo de auditoría (treatmentStatus CLOSED) exige CLOSE (R5B1)", async () => {
    configureTest();
    const editor: Principal = { ...principal, id: "synthetic-audit-finding-editor", grants: [{ module: "AUDIT", permission: "EDIT", scope: "ALL" }] };
    const run = vi.fn(async () => "saved");
    const form = (treatmentStatus: string) => { const data = new FormData(); data.set("treatmentStatus", treatmentStatus); return data; };
    const args = (status: string) => ["synthetic-audit", "finding", undefined, "synthetic-finding", { error: null }, form(status)];
    await identityContext.run({ principal: editor, unitTest: true }, () => expect(authorizedAction("saveAuditChildAction", args("CLOSED"), run)).rejects.toMatchObject({ status: 403 }));
    expect(run).not.toHaveBeenCalled();
    await identityContext.run({ principal: editor, unitTest: true }, () => expect(authorizedAction("saveAuditChildAction", args("NOT_APPLICABLE"), run)).resolves.toBe("saved"));
    const closer: Principal = { ...editor, grants: [...editor.grants, { module: "AUDIT", permission: "CLOSE", scope: "ALL" }] };
    await identityContext.run({ principal: closer, unitTest: true }, () => expect(authorizedAction("saveAuditChildAction", args("CLOSED"), run)).resolves.toBe("saved"));
  });
  it("crear una CAPA o Desviación desde un hallazgo exige EDIT en Auditorías (R5B2)", async () => {
    configureTest();
    const creator: Principal = { ...principal, id: "synthetic-capa-creator", grants: [{ module: "CAPA", permission: "CREATE", scope: "ALL" }, { module: "DEVIATION", permission: "CREATE", scope: "ALL" }] };
    const run = vi.fn(async () => "saved");
    const form = () => { const data = new FormData(); data.set("fromAuditFindingId", "6f2b1c7e-9a4d-4b8e-8c1f-2d3e4f5a6b7c"); return data; };
    for (const name of ["createCapaAction", "createDeviationAction"]) {
      await identityContext.run({ principal: creator, unitTest: true }, () => expect(authorizedAction(name, [{ error: null }, form()], run)).rejects.toMatchObject({ status: 403 }));
    }
    expect(run).not.toHaveBeenCalled();
  });
  it("descargar una versión congelada del CAPA plan exige DOWNLOAD, no GENERATE_DOCUMENT (R5C1)", async () => {
    configureTest();
    const downloader: Principal = { ...principal, id: "synthetic-audit-downloader", grants: [{ module: "AUDIT", permission: "READ", scope: "ALL" }, { module: "AUDIT", permission: "DOWNLOAD", scope: "ALL" }] };
    const run = vi.fn(async () => new Response("xlsx"));
    const call = (query: string) => identityContext.run({ principal: downloader, unitTest: true }, () => authorizedRoute("src/app/api/audits/[id]/documents/route.ts", "GET", [new Request(`http://127.0.0.1:3000/api/audits/a/documents?${query}`), { params: Promise.resolve({ id: "a" }) }], run));
    expect((await call("capaPlanVersion=0")).status).toBe(200);
    expect((await call("type=AUDIT_CAPA_PLAN")).status).toBe(403);
    expect(run).toHaveBeenCalledTimes(1);
  });
  it("cerrar una acción o un hallazgo en el seguimiento del CAPA plan exige CLOSE (R5C2)", async () => {
    configureTest();
    const follower: Principal = { ...principal, id: "synthetic-audit-follower", grants: [{ module: "AUDIT", permission: "FOLLOWUP", scope: "ALL" }] };
    const run = vi.fn(async () => ({ error: null }));
    const form = (values: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };
    const call = (values: Record<string, string>) => identityContext.run({ principal: follower, unitTest: true }, () => authorizedAction("recordCapaPlanFollowupAction", ["audit", { error: null }, form(values)], run));
    await expect(call({ "a.x1.status": "IN_PROGRESS", "f.f1.treatmentStatus": "OPEN" })).resolves.toEqual({ error: null });
    await expect(call({ "a.x1.status": "CLOSED" })).rejects.toMatchObject({ status: 403 });
    await expect(call({ "f.f1.treatmentStatus": "CLOSED" })).rejects.toMatchObject({ status: 403 });
    // Un estado con espacios no puede esquivar la comprobación (el servidor normaliza los valores).
    await expect(call({ "a.x1.status": " CLOSED" })).rejects.toMatchObject({ status: 403 });
    await expect(call({ "f.f1.treatmentStatus": "CLOSED\n" })).rejects.toMatchObject({ status: 403 });
    expect(run).toHaveBeenCalledTimes(1);
  });
  it("cerrar una reclamación exige CLOSE aunque el estado llegue en saveStatus", async () => {
    configureTest();
    const editor: Principal = { ...principal, id: "synthetic-complaint-editor", grants: [{ module: "COMPLAINT", permission: "CREATE", scope: "ALL" }] };
    const run = vi.fn(async () => "saved");
    const form = (saveStatus: string) => { const data = new FormData(); data.set("saveStatus", saveStatus); return data; };
    await identityContext.run({ principal: editor, unitTest: true }, () => expect(authorizedAction("createComplaintAction", [{ error: null }, form("CLOSED")], run)).rejects.toMatchObject({ status: 403 }));
    expect(run).not.toHaveBeenCalled();
    await identityContext.run({ principal: editor, unitTest: true }, () => expect(authorizedAction("createComplaintAction", [{ error: null }, form("OPEN")], run)).resolves.toBe("saved"));
    const closer: Principal = { ...editor, grants: [...editor.grants, { module: "COMPLAINT", permission: "CLOSE", scope: "ALL" }] };
    await identityContext.run({ principal: closer, unitTest: true }, () => expect(authorizedAction("createComplaintAction", [{ error: null }, form("CLOSED")], run)).resolves.toBe("saved"));
  });
  it("el estado se compara como lo lee el formulario: una viñeta vacía no evita CLOSE ni ANNUL", async () => {
    configureTest();
    const editor: Principal = { ...principal, id: "synthetic-status-editor", grants: (["DEVIATION", "CAPA", "COMPLAINT"] as const).flatMap((module) => (["EDIT", "CREATE"] as const).map((permission) => ({ module, permission, scope: "ALL" as const }))) };
    const run = vi.fn(async () => "saved");
    const form = (entries: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(entries)) data.set(key, value); return data; };
    const denied = (action: string, args: unknown[]) => identityContext.run({ principal: editor, unitTest: true }, () => expect(authorizedAction(action, args, run)).rejects.toMatchObject({ status: 403 }));
    await denied("updateDeviationAction", ["dev-1", {}, form({ status: "CLOSED\n•" })]);
    await denied("updateComplaintAction", ["rec-1", {}, form({ saveStatus: "•\nCLOSED" })]);
    await denied("createComplaintAction", [{ error: null }, form({ saveStatus: "• \r\nCLOSED" })]);
    await denied("updateCapaAction", ["capa-1", {}, form({ status: "CANCELLED\n•" })]);
    expect(run).not.toHaveBeenCalled();
  });
  it("no habilita el arnés unitario por bandera sintética en producción", () => {
    configureTest(); vi.stubEnv("APP_ENV", "production"); expect(() => authConfiguration()).toThrow();
  });
});
