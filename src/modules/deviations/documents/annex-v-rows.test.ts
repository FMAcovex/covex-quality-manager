import { describe, expect, it } from "vitest";
import { ensureAnnexVDetailRows } from "@/modules/deviations/documents/xlsx";

describe("Anexo V detailed rows", () => {
  it("adds styled B:M cells before existing P cells through row 65", () => {
    const rows = Array.from({ length: 57 }, (_, index) => {
      const row = index + 9;
      return `<row r="${row}" spans="2:18"><c r="P${row}" s="2"></c></row>`;
    }).join("");
    const xml = `<worksheet><sheetData>${rows}</sheetData></worksheet>`;
    const updated = ensureAnnexVDetailRows(xml);
    expect(updated).toContain('<c r="B9" s="20"></c>');
    expect(updated).toContain('<c r="M65" s="26"></c>');
    expect(updated.indexOf('r="M9"')).toBeLessThan(updated.indexOf('r="P9"'));
  });
});
