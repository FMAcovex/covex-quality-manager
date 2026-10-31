import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessPermission, Principal } from "./context";

const mocks = vi.hoisted(() => ({ user: null as unknown as Principal, templateFindUnique: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./session", () => ({ requireUser: async () => mocks.user, requireCsrf: async () => undefined }));
vi.mock("../db", () => ({ prisma: { templateVersion: { findUnique: mocks.templateFindUnique } } }));
vi.mock("../audit/activation", () => ({ auditPolicyState: async () => ({ required: false }) }));

import { authorizedRoute } from "./route-guard";

const TRIAL = "src/app/api/settings/templates/[id]/trial/route.ts";
const user = (grants: Array<[string, AccessPermission]>): Principal => ({ id: "u", tenantId: "t", objectId: "o", name: "Calidad", email: "c@example.invalid", roles: [], active: true, authorized: true, departmentIds: [], assignments: [], grants: grants.map(([module, permission]) => ({ module: module as Principal["grants"][number]["module"], permission, scope: "ALL" })) });
const call = async () => {
  const run = vi.fn(async () => new Response("ok"));
  const response = await authorizedRoute(TRIAL, "GET", [new Request("http://127.0.0.1/api/settings/templates/tpl/trial"), { params: Promise.resolve({ id: "tpl" }) }], run);
  return { response, run };
};

describe("D-129/D-130: la prueba de una plantilla exige «Configuración» en el módulo de la plantilla", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.templateFindUnique.mockResolvedValue({ module: "DEVIATION" }); });

  it("con «Configuración» de Desviaciones se ejecuta", async () => {
    mocks.user = user([["DEVIATION", "MANAGE_CONFIGURATION"]]);
    const { response, run } = await call();
    expect(response.status).toBe(200);
    expect(run).toHaveBeenCalled();
    expect(mocks.templateFindUnique).toHaveBeenCalledWith({ where: { id: "tpl" }, select: { module: true } });
  });

  it("con «Configuración» solo de Sistema o de otro módulo se rechaza", async () => {
    for (const grants of [[["SYSTEM", "MANAGE_CONFIGURATION"]], [["CAPA", "MANAGE_CONFIGURATION"]], [["DEVIATION", "DOWNLOAD"]]] as Array<Array<[string, AccessPermission]>>) {
      mocks.user = user(grants);
      const { response, run } = await call();
      expect(response.status).toBe(403);
      expect(run).not.toHaveBeenCalled();
    }
  });

  it("una plantilla que no existe se rechaza sin ejecutar nada", async () => {
    mocks.user = user([["DEVIATION", "MANAGE_CONFIGURATION"]]);
    mocks.templateFindUnique.mockResolvedValue(null);
    const { response, run } = await call();
    expect(response.status).toBe(403);
    expect(run).not.toHaveBeenCalled();
  });
});
