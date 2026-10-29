import { describe, expect, it } from "vitest";
import { canPreview, contentDisposition, previewHref, previewTypeFromName } from "./file-preview";

// D-121: solo PDF e imágenes se abren en el navegador; el resto se descarga siempre.
describe("Vista previa de archivos", () => {
  it("admite PDF, PNG y JPG; nunca Word, Excel ni tipos desconocidos", () => {
    expect(["application/pdf", "image/png", "image/jpeg", "IMAGE/PNG"].every(canPreview)).toBe(true);
    for (const type of ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "image/svg+xml", "text/html", "application/octet-stream", null, undefined, ""]) expect(canPreview(type)).toBe(false);
  });

  it("añade el parámetro a la ruta de descarga", () => {
    expect(previewHref("/api/qms/1/evidence/2")).toBe("/api/qms/1/evidence/2?preview=1");
    expect(previewHref("/api/audits/1/documents?document=2&signed=1")).toBe("/api/audits/1/documents?document=2&signed=1&preview=1");
  });

  it("solo abre en línea si se pide y el tipo lo admite", () => {
    const get = (query = "") => new Request("http://localhost/api/x" + query);
    expect(contentDisposition(get("?preview=1"), "a.pdf", "application/pdf")).toBe('inline; filename="a.pdf"');
    expect(contentDisposition(get(), "a.pdf", "application/pdf")).toBe('attachment; filename="a.pdf"');
    expect(contentDisposition(get("?preview=1"), "a.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe('attachment; filename="a.docx"');
    expect(contentDisposition(get("?preview=true"), "a.png", "image/png")).toBe('attachment; filename="a.png"');
  });

  it("deduce el tipo por la extensión solo para mostrar el botón", () => {
    expect(previewTypeFromName("Informe.PDF")).toBe("application/pdf");
    expect(previewTypeFromName("foto.jpeg")).toBe("image/jpeg");
    expect(previewTypeFromName("acta.docx")).toBeNull();
    expect(previewTypeFromName(null)).toBeNull();
  });
});
