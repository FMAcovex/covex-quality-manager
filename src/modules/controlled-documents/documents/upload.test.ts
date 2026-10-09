import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./service", () => ({ incorporateDocument: vi.fn() }));
import { incorporateDocument } from "./service";
import { POST } from "@/app/api/controlled-documents/[id]/revisions/[revisionId]/documents/route";
const id = "12345678-1234-4234-8234-123456789abc", revisionId = "12345678-1234-4234-8234-123456789def";
const secret = "synthetic-test-key-not-a-real-secret", url = "https://covex.example/api/documents";
const params = Promise.resolve({ id, revisionId });
function request(permission = "read,write", origin = "https://covex.example", body?: BodyInit) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ mode: "reference", kind: "ANNEX", referenceName: "QA", referenceUrl: "https://example.invalid/doc", actor: "Actor manipulado" })) form.set(key, value);
  return new Request(url, { method: "POST", headers: { "x-pnt-user": "Identidad autenticada", "x-pnt-proxy-secret": secret, "x-pnt-permissions": permission, origin }, body: body || form });
}
beforeEach(() => {
  vi.stubEnv("PNT_DOCUMENT_ACCESS_MODE", "trusted-proxy"); vi.stubEnv("PNT_DOCUMENT_PROXY_SECRET", secret); vi.stubEnv("PNT_DOCUMENT_ALLOWED_ORIGIN", "https://covex.example");
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("P2A incorporación HTTP en servidor", () => {
  it("deniega lectura y cabeceras sin autenticación antes de incorporar", async () => {
    expect((await POST(request("read"), { params })).status).toBe(403);
    expect((await POST(new Request(url, { method: "POST" }), { params })).status).toBe(403);
    expect(incorporateDocument).not.toHaveBeenCalled();
  });
  it("deniega origen ajeno aunque gateway autentique al usuario", async () => {
    expect((await POST(request("read,write", "https://attacker.invalid"), { params })).status).toBe(403);
    expect(incorporateDocument).not.toHaveBeenCalled();
  });
  it("ignora actor del formulario y usa identidad autenticada y revisión de la ruta", async () => {
    vi.mocked(incorporateDocument).mockResolvedValue({ id } as Awaited<ReturnType<typeof incorporateDocument>>);
    expect((await POST(request(), { params })).status).toBe(201);
    expect(incorporateDocument).toHaveBeenCalledWith(expect.objectContaining({ documentId: id, revisionId, reference: { name: "QA", url: "https://example.invalid/doc" } }), { name: "Identidad autenticada", source: "TRUSTED_PROXY", canWrite: true });
  });
  it("rechaza identificadores manipulados antes de consultar", async () => {
    expect((await POST(request(), { params: Promise.resolve({ id: "../path", revisionId }) })).status).toBe(400);
    expect(incorporateDocument).not.toHaveBeenCalled();
  });
  it("acota el cuerpo real independientemente de Content-Length", async () => {
    const r = request("read,write", "https://covex.example", new Uint8Array(17 * 1024 * 1024));
    r.headers.set("content-type", "multipart/form-data; boundary=synthetic"); r.headers.set("content-length", "1");
    expect((await POST(r, { params })).status).toBe(413);
    expect(incorporateDocument).not.toHaveBeenCalled();
  });
});
