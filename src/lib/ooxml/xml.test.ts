import { describe, expect, it } from "vitest";
import { annexValueRunProperties, applyValueMarks, fillWordCellBalanced, fillWordRowCellsBalanced, markValue, setWordCellText, setWordCellTextBalanced, setWordSdtCheckbox, setWordVariableCellText } from "@/lib/ooxml/xml";

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
    // D-103: los datos van en Arial 11 aunque la etiqueta tenga otro tamaño.
    expect(xml).toContain('<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve"> OOS/MD/001/2026</w:t></w:r>');
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

describe("tipografía de los datos de los anexos (D-103)", () => {
  const arial = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>';
  it("pone Arial 11 conservando el resto del formato y el orden de w:rPr", () => {
    expect(annexValueRunProperties()).toBe(`<w:rPr>${arial}<w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>`);
    expect(annexValueRunProperties('<w:rPr><w:rStyle w:val="X"/><w:rFonts w:ascii="Calibri"/><w:b/><w:color w:val="FF0000"/><w:sz w:val="16"/><w:szCs w:val="16"/><w:u w:val="single"/><w:lang w:val="es-ES"/></w:rPr>'))
      .toBe(`<w:rPr><w:rStyle w:val="X"/>${arial}<w:b/><w:color w:val="FF0000"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:u w:val="single"/><w:lang w:val="es-ES"/></w:rPr>`);
  });

  it("separa un dato escrito dentro de una etiqueta en su propio run", () => {
    const run = `<w:p><w:r w:rsidR="1"><w:rPr><w:b/><w:sz w:val="18"/></w:rPr><w:t>Cantidad ${markValue("25 kg")} y más</w:t></w:r></w:p>`;
    expect(applyValueMarks(run)).toBe(
      '<w:p><w:r w:rsidR="1"><w:rPr><w:b/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">Cantidad </w:t></w:r>' +
      `<w:r w:rsidR="1"><w:rPr>${arial}<w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">25 kg</w:t></w:r>` +
      '<w:r w:rsidR="1"><w:rPr><w:b/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve"> y más</w:t></w:r></w:p>',
    );
    expect(applyValueMarks("<w:r><w:t>sin marcas</w:t></w:r>")).toBe("<w:r><w:t>sin marcas</w:t></w:r>");
  });

  it("los textos que escribe la aplicación en celdas van en Arial 11", () => {
    const doc = '<w:document><w:body><w:tbl><w:tr><w:tc><w:p><w:r><w:t>x</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>';
    for (const xml of [setWordCellText(doc, 0, 0, 0, "dato"), setWordCellTextBalanced(doc, 0, 0, 0, "dato", "FF0000"), setWordVariableCellText(doc, 0, 0, 0, "dato")]) {
      expect(xml).toMatch(/<w:rPr><w:rFonts w:ascii="Arial"[^>]*\/>(?:<w:color w:val="FF0000"\/>)?<w:sz w:val="22"\/><w:szCs w:val="22"\/><\/w:rPr><w:t xml:space="preserve">dato<\/w:t>/);
    }
  });
});

describe("viñetas en los datos de los anexos (D-126)", () => {
  const doc = '<w:document><w:body><w:tbl><w:tr><w:tc><w:p><w:r><w:t>x</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>';
  const text = "Hechos:\n• Alarma sin aviso & sin registro\n- guion normal";
  it("una línea «• » es un párrafo con sangría francesa y tabulación; el resto no cambia", () => {
    for (const xml of [setWordCellText(doc, 0, 0, 0, text), setWordCellTextBalanced(doc, 0, 0, 0, text), setWordVariableCellText(doc, 0, 0, 0, text)]) {
      const paragraphs = xml.match(/<w:p>[\s\S]*?<\/w:p>/g)!;
      expect(paragraphs).toHaveLength(3);
      expect(paragraphs[1]).toMatch(/^<w:p><w:pPr><w:ind w:left="284" w:hanging="284"\/>(?:<w:jc w:val="both"\/>)?<\/w:pPr><w:r><w:rPr>[\s\S]*?<\/w:rPr><w:t>•<\/w:t><w:tab\/><w:t xml:space="preserve">Alarma sin aviso &amp; sin registro<\/w:t><\/w:r><\/w:p>$/);
      expect(paragraphs[0]).not.toContain("w:ind");
      expect(paragraphs[2]).not.toContain("w:ind");
      expect(paragraphs[2]).toContain(">- guion normal<");
    }
  });
});

