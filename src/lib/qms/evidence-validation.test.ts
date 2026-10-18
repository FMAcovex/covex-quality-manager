import { describe, expect, it } from "vitest";
import { MAX_EVIDENCE_SIZE, validateEvidenceFile } from "./evidence-validation";

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const pdf = new TextEncoder().encode("%PDF-1.7\n%%EOF");

describe("validación de evidencias adjuntas (D-096)", () => {
  it("acepta PNG, JPG y PDF por su contenido real", () => {
    expect(validateEvidenceFile("foto.png", "image/png", png)).toBe("image/png");
    expect(validateEvidenceFile("foto.JPG", "", jpeg)).toBe("image/jpeg");
    expect(validateEvidenceFile("foto.jpeg", "application/octet-stream", jpeg)).toBe("image/jpeg");
    expect(validateEvidenceFile("registro.pdf", "application/pdf", pdf)).toBe("application/pdf");
  });
  it("rechaza imágenes cuyo contenido no corresponde a la extensión", () => {
    expect(() => validateEvidenceFile("foto.png", "image/png", jpeg)).toThrow(/no corresponde/);
    expect(() => validateEvidenceFile("foto.jpg", "image/jpeg", pdf)).toThrow(/no corresponde/);
  });
  it("rechaza un MIME declarado distinto del de la extensión", () => {
    expect(() => validateEvidenceFile("foto.png", "image/jpeg", png)).toThrow(/MIME/);
  });
  it("rechaza tipos no admitidos, archivos vacíos y los que superan 15 MB", () => {
    expect(() => validateEvidenceFile("macro.exe", "", png)).toThrow(/Solo se admiten PDF, DOCX, XLSX, PNG o JPG/);
    expect(() => validateEvidenceFile("vacio.png", "", new Uint8Array())).toThrow(/15 MB/);
    expect(() => validateEvidenceFile("grande.png", "", new Uint8Array(MAX_EVIDENCE_SIZE + 1))).toThrow(/15 MB/);
  });
  it("rechaza un PDF sin cabecera PDF", () => {
    expect(() => validateEvidenceFile("falso.pdf", "", png)).toThrow(/Cabecera PDF/);
  });
});
