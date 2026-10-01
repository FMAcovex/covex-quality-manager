import { describe, expect, it } from "vitest";
import {
  MAX_SIGNED_PDF_SIZE,
  hasPdfHeader,
  parseRecordVersionSequence,
  safeSignedPdfFileName,
  validateSignedPdfMetadata,
} from "./signed-version-document";

describe("signed version document helpers", () => {
  it("accepts PDF metadata within the existing 15 MB limit", () => {
    expect(validateSignedPdfMetadata("seguimiento-01.pdf", 1024)).toBeNull();
  });

  it("rejects a non-PDF extension and an oversized PDF", () => {
    expect(validateSignedPdfMetadata("seguimiento-01.docx", 1024)).toBe(
      "Solo se admite un archivo PDF.",
    );
    expect(validateSignedPdfMetadata("seguimiento-01.pdf", MAX_SIGNED_PDF_SIZE + 1)).toBe(
      "El PDF supera el límite de 15 MB.",
    );
  });

  it("validates the PDF magic header", () => {
    expect(hasPdfHeader(new TextEncoder().encode("%PDF-1.7\n"))).toBe(true);
    expect(hasPdfHeader(new TextEncoder().encode("NOTPDF"))).toBe(false);
  });

  it("parses only non-negative integer version sequences", () => {
    expect(parseRecordVersionSequence("0")).toBe(0);
    expect(parseRecordVersionSequence("12")).toBe(12);
    expect(parseRecordVersionSequence("-1")).toBeNull();
    expect(parseRecordVersionSequence("1.5")).toBeNull();
    expect(parseRecordVersionSequence("abc")).toBeNull();
  });

  it("sanitizes download filenames", () => {
    expect(safeSignedPdfFileName("CAPA Seguimiento 01 firmado.pdf")).toBe(
      "CAPA_Seguimiento_01_firmado.pdf",
    );
  });
});
