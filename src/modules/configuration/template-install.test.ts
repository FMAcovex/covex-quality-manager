import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { getZipEntryText, readZip, writeZip } from "@/lib/ooxml/zip";
import { templateCatalog, templateKey, type CatalogTemplate } from "@/modules/configuration/template-catalog";
import { decideInstall, expandTemplateInput, resolveCatalogTemplates, sha256 } from "@/modules/configuration/template-install";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
const { requiredControlledTemplates } = await import("@/modules/configuration/template-readiness");

// D-099: instalador único por huella. Archivos sintéticos; las plantillas reales no se versionan.
const docx = (...paragraphs: string[]) =>
  writeZip([{ name: "word/document.xml", data: Buffer.from(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.map((text) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`).join("")}<w:sectPr/></w:body></w:document>`) }]);

const annex = docx("Anexo ficticio");
const pnt = docx("Portada del PNT", "Anexo IV: HOJA", "Contenido IV", "Anexo V: DECLARACIÓN", "Contenido V", "Anexo VI: LISTADO");
const catalog: CatalogTemplate[] = [
  { module: "DEVIATION", documentType: "DEVIATION_ANNEX_III", versionCode: "06", label: "Anexo directo", fileName: "a.docx", effectiveFrom: "2026-01-01", sources: [{ kind: "file", sha256: sha256(annex) }] },
  { module: "RETURN", documentType: "RETURN_ANNEX_IV", versionCode: "03", label: "Anexo del PNT", fileName: "b.docx", effectiveFrom: "2026-01-01", sources: [{ kind: "pnt-range", sha256: sha256(pnt), start: "Anexo IV:", end: "Anexo V:" }] },
  { module: "AUDIT", documentType: "AUDIT_ANNUAL_INTERNAL_PROGRAMME", versionCode: "PMAI", label: "Programa .doc", fileName: "c.docx", effectiveFrom: "2026-01-01", sources: [{ kind: "office-normalized", sha256: sha256(Buffer.from("doc antiguo")), convertDoc: true }] },
];
const text = (data: Buffer) => getZipEntryText(readZip(data), "word/document.xml").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("Catálogo único de plantillas", () => {
  it("una entrada por anexo y versión, con huellas SHA-256 válidas", () => {
    const keys = templateCatalog.map(templateKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const item of templateCatalog) for (const source of item.sources) expect(source.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("cubre todas las plantillas que la configuración exige", () => {
    const keys = new Set(templateCatalog.map(templateKey));
    for (const required of requiredControlledTemplates) expect(keys.has(templateKey(required)), templateKey(required)).toBe(true);
  });

  it("los cargadores de los módulos no guardan huellas propias", () => {
    const modules = path.resolve("src/modules");
    for (const name of readdirSync(modules)) {
      const file = path.join(modules, name, "documents", "templates.ts");
      let source = "";
      try { source = readFileSync(file, "utf8"); } catch { continue; }
      expect(source, file).not.toMatch(/[0-9a-f]{64}/);
    }
  });

  it("Devoluciones IV y V solo se aceptan recortadas del PNT GC-00/028/03 (opción A)", () => {
    for (const type of ["RETURN_ANNEX_IV", "RETURN_ANNEX_V"]) {
      const entry = templateCatalog.find((item) => item.documentType === type)!;
      expect(entry.sources.map((source) => source.kind)).toEqual(["pnt-range"]);
    }
  });
});

describe("Archivos recibidos (terminal o Configuración)", () => {
  it("de un ZIP toma solo los archivos de Office y no ejecuta ni guarda lo demás", () => {
    const zip = writeZip([
      { name: "plantillas/", data: Buffer.alloc(0) },
      { name: "plantillas/Anexo.docx", data: annex },
      { name: "plantillas/Listado.XLSX", data: Buffer.from("xlsx") },
      { name: "plantillas/instalar.sh", data: Buffer.from("echo no") },
      { name: "__MACOSX/plantillas/._Anexo.docx", data: Buffer.from("meta") },
    ]);
    expect(expandTemplateInput("paquete.zip", zip).map((file) => file.name)).toEqual(["paquete.zip › plantillas/Anexo.docx", "paquete.zip › plantillas/Listado.XLSX"]);
  });

  it("un anexo suelto se toma tal cual y lo que no es de Office se ignora", () => {
    expect(expandTemplateInput("Anexo III.docx", annex)).toEqual([{ name: "Anexo III.docx", data: annex }]);
    expect(expandTemplateInput("LEEME.txt", Buffer.from("x"))).toEqual([]);
  });

  it("un ZIP dañado no se acepta y un ZIP que se expande demasiado tampoco", () => {
    expect(() => expandTemplateInput("roto.zip", Buffer.from("no es un zip"))).toThrow();
    const big = writeZip([{ name: "a.docx", data: Buffer.alloc(2 * 1024 * 1024) }]);
    expect(() => expandTemplateInput("grande.zip", big, 1024 * 1024)).toThrow();
  });
});

describe("Reconocimiento de archivos por huella", () => {
  it("reconoce por contenido aunque el archivo tenga otro nombre e ignora lo desconocido", () => {
    const { resolved, unrecognized, missing } = resolveCatalogTemplates([
      { name: "renombrado.docx", data: annex },
      { name: "otro.docx", data: docx("No es una plantilla") },
    ], undefined, catalog);
    expect(resolved.map((item) => item.entry.label)).toEqual(["Anexo directo"]);
    expect(resolved[0].checksum).toBe(sha256(annex));
    expect(unrecognized).toEqual(["otro.docx"]);
    expect(missing.map((item) => item.label)).toEqual(["Anexo del PNT", "Programa .doc"]);
  });

  it("recorta el anexo del PNT y el resultado es siempre el mismo", () => {
    const first = resolveCatalogTemplates([{ name: "pnt.docx", data: pnt }], undefined, catalog).resolved[0];
    const second = resolveCatalogTemplates([{ name: "copia.docx", data: pnt }], undefined, catalog).resolved[0];
    expect(text(first.data)).toBe("Anexo IV: HOJA Contenido IV");
    expect(first.derived).toBe(true);
    expect(second.checksum).toBe(first.checksum);
  });

  it("un anexo que no se puede preparar no impide instalar los demás", () => {
    const { resolved, failed } = resolveCatalogTemplates([{ name: "a.docx", data: annex }, { name: "p.doc", data: Buffer.from("doc antiguo") }], undefined, catalog);
    expect(resolved.map((item) => item.entry.label)).toEqual(["Anexo directo"]);
    expect(failed.map((item) => item.entry.label)).toEqual(["Programa .doc"]);
    expect(failed[0].error).toMatch(/LibreOffice/);
  });
});

describe("Una versión instalada no se sustituye", () => {
  const [direct, , converted] = catalog;
  const superseded: CatalogTemplate = { ...direct, supersededChecksums: ["a".repeat(64)] };

  it("versión nueva: activa solo si no hay otra activa", () => {
    expect(decideInstall(direct, "x", null, false)).toEqual({ action: "create", isActive: true });
    expect(decideInstall(direct, "x", null, true)).toEqual({ action: "create", isActive: false });
  });

  it("completa una versión registrada sin archivo y no repite una ya instalada", () => {
    expect(decideInstall(direct, "x", { checksum: null, hasBinary: false }, false)).toEqual({ action: "fill" });
    expect(decideInstall(direct, "x", { checksum: "x", hasBinary: true }, false)).toEqual({ action: "unchanged" });
  });

  it("rechaza otro archivo para la misma versión", () => {
    const decision = decideInstall(direct, "x", { checksum: "y".repeat(64), hasBinary: true }, false);
    expect(decision.action).toBe("conflict");
    expect(decision.action === "conflict" && decision.reason).toMatch(/no se sustituye/);
  });

  it("solo sustituye una derivación anterior documentada y nunca reconvierte un .doc", () => {
    expect(decideInstall(superseded, "x", { checksum: "a".repeat(64), hasBinary: true }, false)).toEqual({ action: "replace-superseded" });
    expect(decideInstall(converted, "x", { checksum: "otra conversión", hasBinary: true }, false)).toEqual({ action: "unchanged" });
  });
});
