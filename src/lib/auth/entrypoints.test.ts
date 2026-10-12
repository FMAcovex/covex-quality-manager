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
  it("no habilita el arnés unitario por bandera sintética en producción", () => {
    configureTest(); vi.stubEnv("APP_ENV", "production"); expect(() => authConfiguration()).toThrow();
  });
});
