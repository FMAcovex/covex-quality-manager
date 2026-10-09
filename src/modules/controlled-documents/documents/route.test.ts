import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./service", () => ({ downloadDocument: vi.fn() }));
import { downloadDocument } from "./service";
import { GET } from "@/app/api/controlled-documents/[id]/revisions/[revisionId]/documents/[objectId]/route";
const params = Promise.resolve({ id: "master", revisionId: "revision", objectId: "object" });
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("P2A descarga autorizada", () => {
  it("deniega antes de consultar documentos; una identidad manipulada no autentica", async () => {
    vi.stubEnv("PNT_DOCUMENT_ACCESS_MODE", "trusted-proxy"); vi.stubEnv("PNT_DOCUMENT_PROXY_SECRET", "synthetic-test-key-not-a-real-secret");
    const response = await GET(new Request("http://localhost/doc", { headers: { "x-pnt-user": "QA", "x-pnt-permissions": "read,write" } }), { params });
    expect(response.status).toBe(403); expect(downloadDocument).not.toHaveBeenCalled();
  });
  it("comprueba ownership por los tres identificadores y no expone detalles", async () => {
    vi.stubEnv("PNT_DOCUMENT_ACCESS_MODE", "demo"); vi.stubEnv("APP_ENV", "test");
    vi.mocked(downloadDocument).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/doc"), { params });
    expect(response.status).toBe(404); expect(downloadDocument).toHaveBeenCalledWith("master", "revision", "object");
  });
});
