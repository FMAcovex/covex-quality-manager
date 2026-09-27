import { describe, expect, it } from "vitest";
import { setWordSdtCheckbox } from "@/lib/ooxml/xml";

const XML = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"><w:body><w:tbl><w:tr><w:sdt><w:sdtPr><w14:checkbox><w14:checked w14:val="0"/></w14:checkbox></w:sdtPr><w:sdtContent><w:tc><w:p><w:r><w:t>☐</w:t></w:r></w:p></w:tc></w:sdtContent></w:sdt><w:tc><w:p><w:r><w:t>Etiqueta</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>`;

describe("Word content-control checkbox", () => {
  it("actualiza propiedad interna y glifo", () => {
    const checked = setWordSdtCheckbox(XML, 0, 0, 0, true);
    expect(checked).toContain('w14:val="1"');
    expect(checked).toContain("☒");
    expect(checked).toContain("Etiqueta");
  });
});
