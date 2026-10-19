import { describe, expect, it } from "vitest";
import { documentUnavailableResponse } from "./template-error-response";

describe("documentUnavailableResponse", () => {
  it("devuelve una página HTML legible con el mensaje escapado", async () => {
    const response = documentUnavailableResponse("<b>x</b>");
    expect(response.status).toBe(409);
    expect(response.headers.get("content-type")).toContain("text/html");
    const body = await response.text();
    expect(body).toContain("Documento no disponible");
    expect(body).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(body).not.toContain("<b>x</b>");
  });
});
