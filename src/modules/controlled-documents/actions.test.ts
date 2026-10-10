import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ master: vi.fn(), revision: vi.fn(), headers: vi.fn() }));
vi.mock("./service", () => ({ saveMaster: mocks.master, saveRevision: mocks.revision }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
import { masterAction, revisionAction } from "./actions";
const secret = "synthetic-test-key-not-a-real-secret";
function historical() {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ operation: "REGISTER", actor: "Nombre escrito no autenticado", baseCode: "GC-00/600", title: "Fixture histórico QA", departmentId: "12345678-1234-4234-8234-123456789abc", changeReason: "Registro histórico contrastado QA", revisionCode: "00", existingDocument: "on", verified: "on", sourceReference: "Fuente QA contrastada", existingStatus: "IN_FORCE", effectiveFrom: "2020-01-01" })) fd.set(k, v);
  return fd;
}
beforeEach(() => { vi.stubEnv("PNT_DOCUMENT_ACCESS_MODE", "trusted-proxy"); vi.stubEnv("PNT_DOCUMENT_PROXY_SECRET", secret); mocks.master.mockResolvedValue("master"); mocks.revision.mockResolvedValue("revision"); });
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("P2C P1A Server Actions y registro histórico", () => {
  it.each(["anonymous", "read", "read,write", "read,verify", "wrong-secret"])("%s no elude legacy-register con nombre de formulario", async profile => {
    mocks.headers.mockResolvedValue(profile === "anonymous" ? new Headers() : new Headers({ "x-pnt-proxy-secret": profile === "wrong-secret" ? "wrong" : secret, "x-pnt-user": "Actor QA proxy", "x-pnt-permissions": profile === "wrong-secret" ? "read,legacy-register" : profile }));
    expect((await masterAction(null, {}, historical())).error).toMatch(/autorizad/);
    expect((await revisionAction("master", null, {}, historical())).error).toMatch(/autorizad/);
    expect(mocks.master).not.toHaveBeenCalled(); expect(mocks.revision).not.toHaveBeenCalled();
  });
  it("legacy-register autentica responsable en ambas acciones", async () => {
    mocks.headers.mockResolvedValue(new Headers({ "x-pnt-proxy-secret": secret, "x-pnt-user": "Actor QA proxy", "x-pnt-permissions": "read,legacy-register" }));
    expect((await masterAction(null, {}, historical())).url).toBe("/controlled-documents/master");
    expect((await revisionAction("master", null, {}, historical())).url).toContain("tab=revisions");
    expect(mocks.master.mock.calls[0][0].actor).toBe("Actor QA proxy"); expect(mocks.revision.mock.calls[0][1].actor).toBe("Actor QA proxy");
  });
  it("el borrador ordinario P1A mantiene su funcionamiento anterior", async () => {
    const fd = new FormData(); fd.set("operation", "DRAFT"); fd.set("actor", "P1A sintético");
    expect((await masterAction(null, {}, fd)).url).toBe("/controlled-documents/master");
    expect(mocks.headers).not.toHaveBeenCalled(); expect(mocks.master.mock.calls[0][0].actor).toBe("P1A sintético");
  });
});

describe("PNT returnTo en guardados", () => {
  it("conserva contexto en alta, edición y revisión", async () => {
    const fd = new FormData(); fd.set("operation", "DRAFT"); fd.set("actor", "QA");
    const back = "/controlled-documents?q=QA&sort=title&view=latest&page=2"; fd.set("returnTo", back);
    const result = await masterAction(null, {}, fd);
    expect(new URL(result.url!, "https://qa.invalid").searchParams.get("returnTo")).toBe(back);
    fd.set("changeReason", "Cambio QA"); fd.set("revisionCode", "00");
    const revision = await revisionAction("master", "revision", {}, fd);
    expect(new URL(revision.url!, "https://qa.invalid").searchParams.get("returnTo")).toBe(back);
    expect(new URL(revision.url!, "https://qa.invalid").searchParams.get("tab")).toBe("revisions");
  });
  it("no redirige fuera del listado PNT", async () => {
    const fd = new FormData(); fd.set("operation", "DRAFT"); fd.set("actor", "QA"); fd.set("returnTo", "https://example.invalid");
    expect((await masterAction(null, {}, fd)).url).toBe("/controlled-documents/master");
  });
});
