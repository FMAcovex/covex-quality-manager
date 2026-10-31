import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccessError } from "@/lib/auth/context";
import { TemplateTrialError } from "@/modules/configuration/template-trial-rules";

const { generateTemplateTrial, logServerError } = vi.hoisted(() => ({ generateTemplateTrial: vi.fn(), logServerError: vi.fn(() => "ERR-123") }));
vi.mock("server-only", () => ({}));
// La guarda de la ruta se prueba aparte (inventario y rechazo anónimo); aquí solo la respuesta.
vi.mock("@/lib/auth/route-guard", () => ({ authorizedRoute: (_file: string, _method: string, args: unknown[], run: (a: unknown[]) => unknown) => run(args) }));
vi.mock("@/modules/configuration/template-trial", () => ({ generateTemplateTrial }));
vi.mock("@/lib/log/server-log", () => ({ logServerError }));

import { GET } from "./route";

const call = (ref?: string) => GET(new Request(`http://127.0.0.1/api/settings/templates/tpl-1/trial${ref === undefined ? "" : `?ref=${encodeURIComponent(ref)}`}`), { params: Promise.resolve({ id: "tpl-1" }) });

describe("D-129: ruta de prueba de una plantilla", () => {
  beforeEach(() => vi.clearAllMocks());

  it("descarga el archivo «PRUEBA» como adjunto, sin caché, con el código indicado", async () => {
    generateTemplateTrial.mockResolvedValue({ buffer: Buffer.from("docx"), fileName: "PRUEBA_DEVIATION_ANNEX_III_v07_D_1.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const response = await call("D/1");
    expect(generateTemplateTrial).toHaveBeenCalledWith("tpl-1", "D/1");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="PRUEBA_DEVIATION_ANNEX_III_v07_D_1.docx"');
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("docx");
  });

  it("explica en una página legible por qué no se puede probar", async () => {
    generateTemplateTrial.mockRejectedValue(new TemplateTrialError("El expediente X está en borrador <b>", 409));
    const response = await call();
    expect(generateTemplateTrial).toHaveBeenCalledWith("tpl-1", null);
    expect(response.status).toBe(409);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("El expediente X está en borrador &lt;b&gt;");
  });

  it("sin los permisos del expediente responde 403 con una explicación", async () => {
    generateTemplateTrial.mockRejectedValue(new AccessError(403));
    const response = await call();
    expect(response.status).toBe(403);
    expect(await response.text()).toContain("mismos permisos que descargar ese documento");
  });

  it("si el generador no puede rellenar la versión, pide no activarla y da una referencia sin detalles internos", async () => {
    generateTemplateTrial.mockRejectedValue(new Error("Cannot read properties of undefined (reading 'xml') at /srv/app"));
    const response = await call();
    const body = await response.text();
    expect(response.status).toBe(422);
    expect(body).toContain("No la actives");
    expect(body).toContain("ERR-123");
    expect(body).not.toContain("/srv/app");
    expect(logServerError).toHaveBeenCalledWith("configuration.template-trial", expect.any(Error), { module: "SYSTEM" });
  });
});
