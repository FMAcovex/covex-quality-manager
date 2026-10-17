import { describe, expect, it } from "vitest";
import { fillWordCellBalanced, fillWordRowCellsBalanced, setWordSdtCheckbox } from "@/lib/ooxml/xml";

const XML = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"><w:body><w:tbl><w:tr><w:sdt><w:sdtPr><w14:checkbox><w14:checked w14:val="0"/></w14:checkbox></w:sdtPr><w:sdtContent><w:tc><w:p><w:r><w:t>☐</w:t></w:r></w:p></w:tc></w:sdtContent></w:sdt><w:tc><w:p><w:r><w:t>Etiqueta</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>`;

describe("Word content-control checkbox", () => {
  it("actualiza propiedad interna y glifo", () => {
    const checked = setWordSdtCheckbox(XML, 0, 0, 0, true);
    expect(checked).toContain('w14:val="1"');
    expect(checked).toContain("☒");
    expect(checked).toContain("Etiqueta");
  });
});

describe("relleno de celdas de plantillas controladas", () => {
  const cell = (inner: string) => `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr><w:tc><w:tcPr><w:tcW w:w="100"/></w:tcPr>${inner}</w:tc></w:tr></w:tbl></w:body></w:document>`;
  const label = '<w:p><w:pPr><w:rPr><w:b/><w:sz w:val="20"/></w:rPr></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Nº INFORME:</w:t></w:r></w:p>';

  it("añade el valor tras la etiqueta sin negrita y conserva propiedades de celda", () => {
    const xml = fillWordCellBalanced(cell(label), 0, 0, 0, "OOS/MD/001/2026");
    expect(xml).toContain("<w:t>Nº INFORME:</w:t>");
    expect(xml).toContain('<w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve"> OOS/MD/001/2026</w:t></w:r>');
    expect(xml).toContain('<w:tcW w:w="100"/>');
  });

  it("sustituye la indicación gris, escribe párrafos bajo la guía y no toca celdas sin valor", () => {
    const hint = '<w:p><w:pPr><w:rPr><w:i/></w:rPr></w:pPr><w:r><w:rPr><w:color w:val="A6A6A6"/></w:rPr><w:t>fecha</w:t></w:r></w:p>';
    expect(fillWordCellBalanced(cell(hint), 0, 0, 0, "09/03/2096", { replaceHint: true })).not.toContain(">fecha<");
    const guided = fillWordCellBalanced(cell('<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>(Establecer causa raíz)</w:t></w:r></w:p><w:p/>'), 0, 0, 0, "Línea 1\nLínea 2", { mode: "paragraphs" });
    expect(guided.indexOf("(Establecer causa raíz)")).toBeLessThan(guided.indexOf("Línea 1"));
    expect(guided.match(/<w:p><w:pPr><\/w:pPr><w:r>/g)).toHaveLength(2);
    expect(fillWordCellBalanced(cell(label), 0, 0, 0, "")).toBe(cell(label));
  });

  it("colorea la fila completa y rellena solo las celdas indicadas", () => {
    const row = '<w:tr><w:tc><w:tcPr><w:shd w:val="clear" w:fill="FFFFFF"/></w:tcPr><w:p/></w:tc><w:tc><w:p/></w:tc></w:tr>';
    const filled = fillWordRowCellsBalanced(row, { 1: "Cerrado" }, { shade: "92D050" });
    expect(filled.match(/w:fill="92D050"/g)).toHaveLength(2);
    expect(filled).not.toContain('w:fill="FFFFFF"');
    expect(filled).toContain(">Cerrado<");
  });
});
