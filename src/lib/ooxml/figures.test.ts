import { describe, expect, it } from "vitest";
import { appendFiguresPage, imageSize } from "./figures";
import type { ZipEntry } from "./zip";

// D-125: hoja «Figuras» al final del Anexo III generado.
const png = (width: number, height: number) => {
  const bytes = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]).copy(bytes);
  bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20);
  return bytes;
};
const jpeg = (width: number, height: number) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, height >> 8, height & 255, width >> 8, width & 255, 3, 0, 0, 0, 0xff, 0xd9]);
const document = `<w:document xmlns:w="w" xmlns:r="r" xmlns:wp="wp"><w:body><w:p/><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="707" w:bottom="709" w:left="709"/></w:sectPr></w:body></w:document>`;
const entries = (): ZipEntry[] => [
  { name: "[Content_Types].xml", data: Buffer.from(`<Types><Default Extension="png" ContentType="image/png"/><Default Extension="xml" ContentType="application/xml"/></Types>`) },
  { name: "word/_rels/document.xml.rels", data: Buffer.from(`<Relationships><Relationship Id="rId1" Type="t" Target="styles.xml"/></Relationships>`) },
  { name: "word/document.xml", data: Buffer.from(document) },
];
const text = (zip: ZipEntry[], name: string) => zip.find((entry) => entry.name === name)!.data.toString("utf8");

describe("Hoja de figuras del Anexo III (D-125)", () => {
  it("lee el tamaño de PNG y JPEG", () => {
    expect(imageSize(png(800, 600))).toEqual({ width: 800, height: 600 });
    expect(imageSize(jpeg(1024, 768))).toEqual({ width: 1024, height: 768 });
    expect(() => imageSize(Buffer.from("no es imagen"))).toThrow("No se puede leer el tamaño de la figura.");
  });

  it("sin figuras el documento no cambia", () => {
    const zip = entries();
    appendFiguresPage(zip, [], "D/GC-00/001/2026");
    expect(text(zip, "word/document.xml")).toBe(document);
  });

  it("añade tras la última página un salto, el título y cada figura con su pie, sin tocar lo anterior", () => {
    const zip = entries();
    appendFiguresPage(zip, [
      { number: 1, caption: "C. Descripción del evento: Etiqueta <errónea>", bytes: png(2000, 1000), mimeType: "image/png" },
      { number: 2, caption: "E. Investigación: Registro", bytes: jpeg(400, 300), mimeType: "image/jpeg" },
    ], "D/GC-00/001/2026");
    const xml = text(zip, "word/document.xml");
    const body = xml.slice(xml.indexOf("<w:body>") + 8, xml.indexOf("<w:sectPr>"));
    expect(body.startsWith("<w:p/>")).toBe(true);
    expect(body).toContain('<w:br w:type="page"/>');
    expect(body).toContain("Figuras del expediente D/GC-00/001/2026");
    expect(body).toContain("Figura 1. C. Descripción del evento: Etiqueta &lt;errónea&gt;");
    expect(body).toContain("Figura 2. E. Investigación: Registro");
    // Ancho útil de la página: 11906 - 709 - 707 twips = 10490 twips = 6661150 EMU; la figura 1 se ajusta a ese ancho.
    expect(body).toContain('<wp:extent cx="6661150" cy="3330575"/>');
    // La figura 2 cabe a su tamaño (400×300 px a 96 ppp).
    expect(body).toContain('<wp:extent cx="3810000" cy="2857500"/>');
    expect(xml.endsWith("</w:sectPr></w:body></w:document>")).toBe(true);
    expect(zip.find((entry) => entry.name === "word/media/covex-figura-1.png")?.data.length).toBe(33);
    expect(zip.find((entry) => entry.name === "word/media/covex-figura-2.jpeg")).toBeTruthy();
    expect(text(zip, "word/_rels/document.xml.rels")).toContain('Id="rIdCovexFigura1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/covex-figura-1.png"');
    expect(text(zip, "[Content_Types].xml")).toContain('<Default Extension="jpeg" ContentType="image/jpeg"/>');
    expect(text(zip, "[Content_Types].xml").match(/Extension="png"/g)).toHaveLength(1);
  });

  it("una figura muy alta se ajusta al alto disponible", () => {
    const zip = entries();
    appendFiguresPage(zip, [{ number: 1, caption: "Alta", bytes: png(500, 5000), mimeType: "image/png" }], "X");
    const [, cx, cy] = text(zip, "word/document.xml").match(/<wp:extent cx="(\d+)" cy="(\d+)"\/>/)!;
    // Alto máximo: 60 % del alto útil (16838 - 1417 - 709 twips).
    expect(Number(cy)).toBe(Math.round((16838 - 1417 - 709) * 635 * 0.6));
    expect(Number(cx)).toBe(Math.round(Number(cy) / 10));
  });
});
