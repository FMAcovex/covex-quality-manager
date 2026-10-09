import { describe, expect, it } from "vitest";
import { documentPrincipal, requireDocumentWrite } from "./access";
import { externalReference, kind, MAX_DOCUMENT_SIZE, originalName, uuid, validateDocumentFile } from "./domain";
import { writeZip } from "@/lib/ooxml/zip";
const pdf = Buffer.from("%PDF-1.4\nsynthetic\n%%EOF");
const docx = writeZip([
  { name: "[Content_Types].xml", data: Buffer.from('<Types><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>') },
  { name: "_rels/.rels", data: Buffer.from('<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>') },
  { name: "word/document.xml", data: Buffer.from('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>') },
]);
describe("P2A validación documental", () => {
  it("permite DOCX de elaboración y PDF, sin deducir aprobación", () => {
    expect(validateDocumentFile("trabajo.docx", "", docx, "WORKING_WORD")).toContain("wordprocessingml");
    expect(validateDocumentFile("evidencia.pdf", "application/pdf", pdf, "APPROVAL_EVIDENCE")).toBe("application/pdf");
    expect(kind("EXTERNAL_SIGNED_PDF")).toBe("EXTERNAL_SIGNED_PDF");
  });
  it.each(["../../x.pdf", "C:\\x.pdf", "bad\n.pdf", "", ".."])("rechaza rutas/nombres %s", name => expect(() => originalName(name)).toThrow());
  it("rechaza extensión, MIME, contenido, vacíos y exceso de tamaño", () => {
    for (const [name, mime, data] of [["x.exe", "", pdf], ["x.pdf", "text/html", pdf], ["x.pdf", "", Buffer.from("html")], ["x.docx", "", pdf], ["x.pdf", "", Buffer.alloc(0)], ["x.pdf", "", Buffer.alloc(MAX_DOCUMENT_SIZE + 1)]] as const)
      expect(() => validateDocumentFile(name, mime, data, "ANNEX")).toThrow();
    expect(() => validateDocumentFile("x.pdf", "", pdf, "WORKING_WORD")).toThrow();
    expect(() => validateDocumentFile("x.docx", "", docx, "DOCUMENT_PDF")).toThrow();
    expect(() => kind("APPROVED")).toThrow();
    expect(() => uuid("../anything")).toThrow();
  });
  it.each(["file:///etc/passwd", "http://host/doc", "javascript:alert(1)", "https://user:pass@host/doc", "not-url"])("rechaza referencia insegura %s", url => expect(() => externalReference(url)).toThrow());
  it("admite HTTPS sin descargar ni acreditar su contenido", () => expect(externalReference("https://example.invalid/doc")).toBe("https://example.invalid/doc"));
});
describe("P2A acceso servidor", () => {
  const secret = "synthetic-test-key-not-a-real-secret";
  const env = { PNT_DOCUMENT_ACCESS_MODE: "trusted-proxy", PNT_DOCUMENT_PROXY_SECRET: secret };
  it("falla cerrado por defecto y no acepta identidad de formulario/cabecera aislada", () => {
    expect(() => documentPrincipal(new Headers({ "x-pnt-user": "Supuesto responsable" }), {})).toThrow();
    expect(() => documentPrincipal(new Headers({ "x-pnt-user": "QA", "x-pnt-proxy-secret": "wrong" }), env)).toThrow();
    expect(() => documentPrincipal(new Headers(), { PNT_DOCUMENT_ACCESS_MODE: "demo", APP_ENV: "production" })).toThrow();
  });
  it("exige permiso de escritura independiente", () => {
    const h = new Headers({ "x-pnt-proxy-secret": secret, "x-pnt-user": "QA autenticado", "x-pnt-permissions": "read" });
    const principal = documentPrincipal(h, env);
    expect(principal.name).toBe("QA autenticado");
    expect(() => requireDocumentWrite(principal)).toThrow();
    h.set("x-pnt-permissions", "read,write"); expect(() => requireDocumentWrite(documentPrincipal(h, env))).not.toThrow();
  });
  it("el modo demo exige configuración explícita y entorno no operativo", () => {
    expect(documentPrincipal(new Headers(), { PNT_DOCUMENT_ACCESS_MODE: "demo", APP_ENV: "test" }).source).toBe("TEST_DEMO");
    expect(() => documentPrincipal(new Headers(), { APP_ENV: "test" })).toThrow();
  });
});
