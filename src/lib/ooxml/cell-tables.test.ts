import { describe, expect, it } from "vitest";
import { insertWordCellTables, setWordCellText } from "@/lib/ooxml/xml";

const cell = (text: string, width = 9000) => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
const doc = `<w:document><w:body>` +
  `<w:tbl><w:tr>${cell("A1")}${cell("A2")}</w:tr></w:tbl>` +
  `<w:tbl><w:tr>${cell("B1", 4000)}</w:tr><w:tr>${cell("B2")}</w:tr></w:tbl>` +
  `<w:sectPr/></w:body></w:document>`;
const lots = { title: "Lotes & muestras", columns: ["Lote", "Temp."], rows: [["L-1", "9,4"], ["L-2", "línea 1\nlínea 2"]] };

describe("tablas dentro de la casilla del anexo (D-127)", () => {
  it("añade el título y la tabla al final de la casilla, con cabecera repetida y Arial 11", () => {
    const xml = insertWordCellTables(doc, [{ table: 1, row: 0, cell: 0, tables: [{ number: 3, table: lots }] }]);
    const target = xml.slice(xml.indexOf("B1"), xml.indexOf("B2"));
    expect(target.indexOf("B1")).toBeLessThan(target.indexOf("Tabla 3. Lotes &amp; muestras"));
    expect(target).toMatch(/<w:tbl><w:tblPr><w:tblW w:w="3784" w:type="dxa"\/>/);
    expect(target.match(/<w:gridCol w:w="1892"\/>/g)).toHaveLength(2);
    expect(target).toContain("<w:tblHeader/>");
    expect(target).toMatch(/<w:rFonts w:ascii="Arial"[^>]*\/><w:b\/><w:sz w:val="22"\/>[\s\S]*?>Lote</);
    // Una celda con varias líneas lleva un párrafo por línea; la casilla termina en párrafo.
    expect(target).toMatch(/>línea 1<\/w:t><\/w:r><\/w:p><w:p>[\s\S]*?>línea 2</);
    expect(target).toMatch(/<\/w:tbl><w:p><w:pPr>[^<]*(?:<(?!\/w:p>)[^<]*)*<\/w:p><\/w:tc><\/w:tr>/);
    // Las demás casillas no cambian.
    expect(xml).toContain(cell("A1") + cell("A2"));
    expect(xml).toContain(cell("B2"));
  });

  it("inserta de la última casilla a la primera: los índices de las tablas de la plantilla no se desplazan", () => {
    const xml = insertWordCellTables(doc, [
      { table: 0, row: 0, cell: 1, tables: [{ number: 1, table: lots }] },
      { table: 1, row: 1, cell: 0, tables: [{ number: 2, table: { ...lots, title: "Otra" } }] },
    ]);
    expect(xml.indexOf("Tabla 1. Lotes")).toBeGreaterThan(xml.indexOf("A2"));
    expect(xml.indexOf("Tabla 1. Lotes")).toBeLessThan(xml.indexOf("B1"));
    expect(xml.indexOf("Tabla 2. Otra")).toBeGreaterThan(xml.indexOf("B2"));
    // Escribir después en una casilla sigue encontrando la casilla de la plantilla.
    expect(setWordCellText(doc, 1, 1, 0, "nuevo")).toContain(">nuevo<");
  });

  it("sin tablas no cambia nada", () => {
    expect(insertWordCellTables(doc, [])).toBe(doc);
    expect(insertWordCellTables(doc, [{ table: 0, row: 0, cell: 0, tables: [] }])).toBe(doc);
  });
});
