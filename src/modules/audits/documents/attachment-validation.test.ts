import { describe, expect, it } from "vitest";
import { writeZip } from "@/lib/ooxml/zip";
import { validateAuditAttachment } from "./attachment-validation";

function office(ext: "docx" | "xlsx") {
  const word = ext === "docx", part = word ? "word/document.xml" : "xl/workbook.xml";
  return writeZip([
    { name: "[Content_Types].xml", data: Buffer.from(`<Types><Override PartName="/${part}" ContentType="application/vnd.openxmlformats-officedocument.${word ? "wordprocessingml.document" : "spreadsheetml.sheet"}.main+xml"/></Types>`) },
    { name: "_rels/.rels", data: Buffer.from(`<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="${part}"/></Relationships>`) },
    { name: part, data: Buffer.from(word ? '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>' : '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets/></workbook>') },
  ]);
}
describe("Adjuntos de Auditorías: formato real", () => {
  it.each(["docx", "xlsx"] as const)("acepta paquete %s y deduce MIME si navegador no lo envía", ext => expect(validateAuditAttachment(`real.${ext}`, "", office(ext))).toContain("application/vnd.openxmlformats"));
  it("rechaza prefijo PK sin ZIP y ZIP arbitrario", () => {
    for (const bytes of [Buffer.from("PK archivo falso"), writeZip([{name:"texto.txt",data:Buffer.from("no Office")}])]) expect(() => validateAuditAttachment("falso.docx", "", bytes)).toThrow(/paquete/);
  });
  it("rechaza XLSX renombrado DOCX", () => expect(() => validateAuditAttachment("falso.docx", "", office("xlsx"))).toThrow(/paquete/));
  it("rechaza MIME incompatible", () => expect(() => validateAuditAttachment("real.docx", "application/pdf", office("docx"))).toThrow(/MIME/));
  it("rechaza ZIP con CRC manipulado", () => {
    const bytes = office("docx"), directory = bytes.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));
    bytes.writeUInt32LE(0, directory + 16);
    expect(() => validateAuditAttachment("corrupto.docx", "", bytes)).toThrow(/paquete/);
  });
  it("rechaza expansión excesiva aunque el archivo comprimido sea pequeño", () => {
    const bytes = writeZip([{name:"word/document.xml",data:Buffer.alloc(61*1024*1024,65)}]);
    expect(() => validateAuditAttachment("grande.docx", "", bytes)).toThrow(/paquete/);
    const directory = bytes.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));
    bytes.writeUInt32LE(1, directory + 24); // A false size must not bypass the inflater limit.
    expect(() => validateAuditAttachment("grande.docx", "", bytes)).toThrow(/paquete/);
  });
  it("conserva validación PDF, extensión y tamaño máximo", () => {
    expect(validateAuditAttachment("real.PDF", "application/pdf", Buffer.from("%PDF-1.7\n"))).toBe("application/pdf");
    expect(() => validateAuditAttachment("falso.pdf", "", Buffer.from("falso"))).toThrow(/PDF/);
    expect(() => validateAuditAttachment("falso.zip", "", office("docx"))).toThrow(/válidos/);
    expect(() => validateAuditAttachment("vacio.pdf", "", Buffer.alloc(0))).toThrow(/15 MB/);
    expect(() => validateAuditAttachment("grande.pdf", "", Buffer.alloc(15*1024*1024+1))).toThrow(/15 MB/);
  });
});
