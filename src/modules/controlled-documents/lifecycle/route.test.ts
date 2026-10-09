import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./service", () => ({ lifecycleDecision: vi.fn() }));
import { lifecycleDecision } from "./service";
import { POST } from "@/app/api/controlled-documents/[id]/revisions/[revisionId]/lifecycle/route";
const secret = "synthetic-test-key-not-a-real-secret", params = Promise.resolve({ id: "master", revisionId: "revision" });
beforeEach(() => { vi.stubEnv("PNT_DOCUMENT_ACCESS_MODE", "trusted-proxy"); vi.stubEnv("PNT_DOCUMENT_PROXY_SECRET", secret); });
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
const request = (extra: Record<string, string> = {}, body = "{}") => new Request("http://localhost/api/lifecycle", { method: "POST", headers: { origin: "http://localhost", "content-type": "application/json", ...extra }, body });
const auth = { "x-pnt-proxy-secret": secret, "x-pnt-user": "Usuario autenticado QA", "x-pnt-permissions": "read,verify" };
describe("P2B endpoint sensible", () => {
  it("no consulta decisiones con identidad sin autenticar", async () => {
    expect((await POST(request({ "x-pnt-user": "Suplantado", "x-pnt-permissions": "read,verify" }), { params })).status).toBe(403);
    expect(lifecycleDecision).not.toHaveBeenCalled();
  });
  it("rechaza origen ajeno antes de escritura", async () => {
    expect((await POST(request({ ...auth, origin: "https://example.invalid" }), { params })).status).toBe(403); expect(lifecycleDecision).not.toHaveBeenCalled();
  });
  it("propaga exclusivamente identidad autenticada y capacidades explícitas al servicio", async () => {
    vi.mocked(lifecycleDecision).mockResolvedValue({ id: "decision", sequence: 1 } as Awaited<ReturnType<typeof lifecycleDecision>>);
    const response = await POST(request(auth), { params }); expect(response.status).toBe(201);
    expect(lifecycleDecision).toHaveBeenCalledWith("master", "revision", {}, { name: "Usuario autenticado QA", source: "TRUSTED_PROXY", canWrite: false, capabilities: ["verify"] });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("limita tamaño real aunque no haya content-length", async () => {
    expect((await POST(request(auth, "x".repeat(65537)), { params })).status).toBe(413); expect(lifecycleDecision).not.toHaveBeenCalled();
  });
  it("no expone mensajes internos de Prisma", async () => {
    const e = new Error("metadata privada"); e.name = "PrismaClientKnownRequestError"; vi.mocked(lifecycleDecision).mockRejectedValue(e);
    const response = await POST(request(auth), { params }); expect(response.status).toBe(400); expect(await response.text()).not.toContain("metadata privada");
  });
});
