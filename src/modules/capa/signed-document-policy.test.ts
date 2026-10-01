import { describe, expect, it } from "vitest";
import { capaSignedPdfUploadError } from "./signed-document-policy";

describe("CAPA signed PDF policy", () => {
  it("blocks signed PDF upload while the CAPA is in draft", () => {
    expect(capaSignedPdfUploadError("DRAFT")).toBe(
      "No se puede cargar un PDF firmado mientras la CAPA está en Borrador.",
    );
  });

  it("allows operational CAPA statuses", () => {
    expect(capaSignedPdfUploadError("OPEN")).toBeNull();
    expect(capaSignedPdfUploadError("CLOSED")).toBeNull();
    expect(capaSignedPdfUploadError("CANCELLED")).toBeNull();
  });
});
