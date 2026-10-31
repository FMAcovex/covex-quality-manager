import { describe, expect, it } from "vitest";
import { compareExcelAnnex, compareWordAnnex, tokenDecoder } from "./annex-verification";
import { getZipEntryText, readZip, writeZip } from "./zip";
import { xlsxCells } from "./xlsx-cells";

const cell = (text: string) => `<w:tc><w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p></w:tc>`;
const row = (...cells: string[]) => `<w:tr>${cells.map(cell).join("")}</w:tr>`;
const doc = (body: string) => `<w:document><w:body>${body}<w:sectPr/></w:body></w:document>`;
const nested = (title: string) => `<w:p><w:r><w:t>Tabla 1. ${title}</w:t></w:r></w:p><w:tbl>${row("Lote")}${row("L-1")}</w:tbl><w:p/>`;
const decode = tokenDecoder({ "2031-01-05": "Deviation.openedAt" });

describe("comparación de un anexo Word con su plantilla", () => {
  const template = doc(`<w:p><w:r><w:t>INFORME DE DESVIACIÓN</w:t></w:r></w:p><w:tbl>${row("Fecha:", "")}${row("Descripción:", "")}${row("Acción", "Fecha")}${row("", "")}${row("Firma:", "")}</w:tbl>`);

  it("lista qué dato cae en cada casilla, con su etiqueta, y qué campos se imprimen", () => {
    const output = doc(`<w:p><w:r><w:t>INFORME DE DESVIACIÓN</w:t></w:r></w:p><w:tbl>${row("Fecha:", "5/1/2031")}${row("Descripción:", "⟦Deviation.whatHappened⟧")}${row("Acción", "Fecha")}${row("⟦Action[1].description⟧", "")}${row("Firma:", "")}</w:tbl>`);
    const result = compareWordAnnex(template, output, decode);
    expect(result.altered).toEqual([]);
    expect(result.filled.map((item) => [item.where, item.label, item.text])).toEqual([
      ["Tabla 1, fila 1, casilla 2", "Fecha:", "5/1/2031 [Deviation.openedAt]"],
      ["Tabla 1, fila 2, casilla 2", "Descripción:", "⟦Deviation.whatHappened⟧"],
      ["Tabla 1, fila 4, casilla 1", "↑ Acción", "⟦Action[1].description⟧"],
    ]);
    expect([...result.printed].sort()).toEqual(["Action[1].description", "Deviation.openedAt", "Deviation.whatHappened"]);
  });

  it("las filas copiadas (una por acción) no descuadran las de debajo", () => {
    const output = doc(`<w:p><w:r><w:t>INFORME DE DESVIACIÓN</w:t></w:r></w:p><w:tbl>${row("Fecha:", "")}${row("Descripción:", "")}${row("Acción", "Fecha")}${row("⟦A1⟧", "")}${row("⟦A2⟧", "")}${row("⟦A3⟧", "")}${row("Firma:", "⟦Deviation.signedBy⟧")}</w:tbl>`);
    const result = compareWordAnnex(template, output, decode);
    expect(result.altered).toEqual([]);
    expect(result.filled.find((item) => item.text === "⟦A3⟧")?.where).toBe("Tabla 1, fila 6, casilla 1 (fila añadida)");
    expect(result.filled.find((item) => item.text === "⟦Deviation.signedBy⟧")?.label).toBe("Firma:");
  });

  it("detecta texto de la plantilla perdido o cambiado, dentro y fuera de las tablas", () => {
    const output = doc(`<w:p><w:r><w:t>INFORME</w:t></w:r></w:p><w:tbl>${row("Fecha", "")}${row("Descripción:", "")}${row("Acción", "Fecha")}${row("", "")}${row("Firma:", "")}</w:tbl>`);
    const result = compareWordAnnex(template, output, decode);
    expect(result.altered).toEqual([
      "Tabla 1, fila 1, casilla 1: falta «Fecha:»",
      "Texto fuera de tablas: falta «DE DESVIACIÓN»",
    ]);
  });

  it("avisa de una fila de la plantilla que falta al final y de una casilla que falta en una fila", () => {
    const lostLastRow = doc(`<w:p><w:r><w:t>INFORME DE DESVIACIÓN</w:t></w:r></w:p><w:tbl>${row("Fecha:", "")}${row("Descripción:", "")}${row("Acción", "Fecha")}${row("", "")}</w:tbl>`);
    expect(compareWordAnnex(template, lostLastRow, decode).altered).toEqual(["Tabla 1, fila 5: falta la fila de la plantilla («Firma:»)."]);
    const lostCell = doc(`<w:p><w:r><w:t>INFORME DE DESVIACIÓN</w:t></w:r></w:p><w:tbl>${row("Fecha:", "")}${row("Descripción:", "")}${row("Acción", "Fecha")}${row("", "")}${row("Firma:")}</w:tbl>`);
    expect(compareWordAnnex(template, lostCell, decode).altered).toEqual(["Tabla 1, fila 5: tiene 1 casillas; la plantilla, 2."]);
  });

  it("la huella de una alteración cubre todas las palabras que faltan, no solo las que se muestran", () => {
    const long = doc(`<w:tbl>${row("uno dos tres cuatro cinco seis siete ocho nueve diez")}</w:tbl>`);
    const first = compareWordAnnex(long, doc(`<w:tbl>${row("diez")}</w:tbl>`), decode);
    const second = compareWordAnnex(long, doc(`<w:tbl>${row("")}</w:tbl>`), decode);
    expect(first.altered).toEqual(second.altered.map((line) => line));
    expect(first.alteredKeys).not.toEqual(second.alteredKeys);
  });

  it("una casilla marcada (☒) y un hueco «____» rellenado no cuentan como texto cambiado", () => {
    const withBoxes = doc(`<w:tbl>${row("☐ Sí ☐ No", "Lote: ____")}</w:tbl>`);
    const filled = doc(`<w:tbl>${row("☒ Sí ☐ No", "Lote: ⟦Deviation.lot⟧")}</w:tbl>`);
    expect(compareWordAnnex(withBoxes, filled, decode).altered).toEqual([]);
  });

  it("el texto de una tabla insertada en una casilla cuenta en esa casilla", () => {
    const output = doc(`<w:tbl>${row("Investigación:", "")}</w:tbl>`.replace(cell(""), `<w:tc><w:p><w:r><w:t>⟦Deviation.investigation⟧</w:t></w:r></w:p>${nested("⟦tabla.Deviation.investigation⟧")}</w:tc>`));
    const result = compareWordAnnex(doc(`<w:tbl>${row("Investigación:", "")}</w:tbl>`), output, decode);
    expect(result.cells.find((item) => item.text.includes("⟦Deviation.investigation⟧"))?.text).toContain("⟦tabla.Deviation.investigation⟧");
    expect(result.altered).toEqual([]);
  });
});

describe("comparación de un listado Excel con su plantilla", () => {
  const sheet = (cells: Record<string, string>) => `<worksheet><sheetData>${Object.entries(cells).map(([ref, value]) => `<row><c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c></row>`).join("")}</sheetData></worksheet>`;
  const book = (cells: Record<string, string>) => writeZip([
    { name: "xl/workbook.xml", data: Buffer.from('<workbook><sheets><sheet name="Listado" r:id="rId1"/></sheets></workbook>') },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>') },
    { name: "xl/worksheets/sheet1.xml", data: Buffer.from(sheet(cells)) },
  ]);

  it("compara las hojas por su posición (el generador renombra la hoja con el año) y avisa de las que faltan", () => {
    const named = (sheets: Array<[string, Record<string, string>]>) => writeZip([
      { name: "xl/workbook.xml", data: Buffer.from(`<workbook><sheets>${sheets.map(([name], i) => `<sheet name="${name}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`) },
      { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(`<Relationships>${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}</Relationships>`) },
      ...sheets.map(([, cells], i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: Buffer.from(sheet(cells)) })),
    ]);
    const template = named([["ANEXO", { A1: "Código anual" }], ["datos", { A1: "lista" }]]);
    const output = named([["ANEXO 2031", { A1: "Código", A2: "⟦Capa.code⟧" }]]);
    const result = compareExcelAnnex(template, output, decode);
    expect(result.altered).toEqual(["ANEXO 2031!A1: falta «anual»", "Libro: falta la hoja «datos»."]);
    expect(result.filled.map((item) => item.where)).toEqual(["ANEXO 2031!A2"]);
  });

  it("las filas de datos insertadas bajan la leyenda sin contar como texto cambiado", () => {
    const template = book({ A1: "Código", A3: "LEYENDA", B3: "FIRMA Y FECHA:" });
    const output = book({ A1: "Código", A2: "⟦Capa.a⟧", A3: "⟦Capa.b⟧", A4: "⟦Capa.c⟧", A5: "LEYENDA", B5: "FIRMA Y FECHA:" });
    const result = compareExcelAnnex(template, output, decode);
    expect(result.altered).toEqual([]);
    expect(result.filled.map((item) => item.where)).toEqual(["Listado!A2", "Listado!A3", "Listado!A4"]);
  });

  it("lista lo escrito bajo su cabecera y detecta cabeceras cambiadas", () => {
    const template = book({ A1: "Código", B1: "Descripción" });
    const output = book({ A1: "Código", B1: "Descripcion", A2: "⟦Deviation.businessCode⟧", B2: "⟦Deviation.whatHappened⟧" });
    const result = compareExcelAnnex(template, output, decode);
    expect(result.filled.map((item) => [item.where, item.label, item.text])).toEqual([
      ["Listado!A2", "Código", "⟦Deviation.businessCode⟧"],
      ["Listado!B2", "Descripcion", "⟦Deviation.whatHappened⟧"],
    ]);
    expect(result.altered).toEqual(["Listado!B1: falta «Descripción»"]);
    expect(getZipEntryText(readZip(output), "xl/workbook.xml")).toContain("Listado");
  });
});

describe("decodificación de fechas y celdas numéricas", () => {
  it("reconoce la fecha única en dd/mm/aaaa, d/m/aaaa y como número de serie de Excel (también con hora)", () => {
    const decodeDates = tokenDecoder({ "2031-01-05": "Capa.openedAt" });
    expect(decodeDates("05/01/2031").fields).toEqual(["Capa.openedAt"]);
    expect(decodeDates("5/1/2031").fields).toEqual(["Capa.openedAt"]);
    expect(decodeDates("47853").fields).toEqual(["Capa.openedAt"]);
    expect(decodeDates("47853.5").fields).toEqual(["Capa.openedAt"]);
    expect(decodeDates("47854").fields).toEqual([]);
  });

  it("xlsxCells sin «numbers» ignora las celdas numéricas (la comprobación D-100 compara solo textos)", () => {
    const entries = readZip(writeZip([
      { name: "xl/workbook.xml", data: Buffer.from('<workbook><sheets><sheet name="H" r:id="rId1"/></sheets></workbook>') },
      { name: "xl/_rels/workbook.xml.rels", data: Buffer.from('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>') },
      { name: "xl/worksheets/sheet1.xml", data: Buffer.from('<worksheet><sheetData><row><c r="A1"><v>47853</v></c><c r="B1" t="inlineStr"><is><t>Texto</t></is></c></row></sheetData></worksheet>') },
    ]));
    expect([...xlsxCells(entries).get("H")!]).toEqual([["B1", "Texto"]]);
    expect([...xlsxCells(entries, { numbers: true }).get("H")!]).toEqual([["A1", "47853"], ["B1", "Texto"]]);
  });
});
