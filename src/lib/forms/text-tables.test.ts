import { describe, expect, it } from "vitest";
import {
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
  annexTablePlacements,
  initialFieldTables,
  numberTextTables,
  tableSummaryErrors,
  orderedTextTables,
  parsePastedTable,
  pasteIntoTable,
  parseTextTables,
  storedTextTables,
  textTablesInputName,
} from "./text-tables";

const fields = ["investigation", "rootCause"] as const;

function form(values: Record<string, unknown>) {
  const data = new FormData();
  for (const [field, tables] of Object.entries(values)) data.set(textTablesInputName(field), typeof tables === "string" ? tables : JSON.stringify(tables));
  return data;
}

describe("parseTextTables", () => {
  it("lee las tablas de cada campo, recorta las celdas y quita las filas y tablas vacías", () => {
    const parsed = parseTextTables(form({
      investigation: [
        { title: " Lotes afectados ", columns: ["Lote", " Temp. "], rows: [[" L-1 ", "9,4"], ["", ""], ["L-2", "9,1"], ["", " "]] },
        { title: "", columns: ["", ""], rows: [["", ""]] },
      ],
    }), fields);
    expect(parsed.issues).toEqual({});
    expect(parsed.value).toEqual({
      investigation: [{ title: "Lotes afectados", columns: ["Lote", "Temp."], rows: [["L-1", "9,4"], ["L-2", "9,1"]] }],
    });
  });

  it("sin tablas con contenido, null; los campos que no admiten tablas se ignoran", () => {
    expect(parseTextTables(form({ investigation: [], other: [{ title: "X", columns: ["a"], rows: [["b"]] }] }), fields)).toEqual({ value: null, issues: {} });
    expect(parseTextTables(new FormData(), fields)).toEqual({ value: null, issues: {} });
  });

  it("exige título y respeta los límites; los errores van al campo", () => {
    const tooWide = { title: "Ancha", columns: Array(MAX_TABLE_COLUMNS + 1).fill("c"), rows: [] };
    const tooLong = { title: "Larga", columns: ["c"], rows: Array(MAX_TABLE_ROWS + 1).fill(["x"]) };
    const parsed = parseTextTables(form({
      investigation: [{ title: "", columns: ["Lote"], rows: [["L-1"]] }, tooWide],
      rootCause: [tooLong],
    }), fields);
    expect(parsed.value).toBeNull();
    expect(parsed.issues.investigation).toEqual(["1.ª tabla: falta el título.", `2.ª tabla: como máximo ${MAX_TABLE_COLUMNS} columnas.`]);
    expect(parsed.issues.rootCause).toEqual([`1.ª tabla: como máximo ${MAX_TABLE_ROWS} filas.`]);
  });

  it("una tabla con título pero sin datos se avisa", () => {
    expect(parseTextTables(form({ investigation: [{ title: "Lotes", columns: ["", ""], rows: [["", ""]] }] }), fields).issues.investigation).toEqual(["1.ª tabla: no tiene datos."]);
  });

  it("quita caracteres de control y rechaza un envío desmesurado", () => {
    expect(parseTextTables(form({ investigation: [{ title: "T\u0007", columns: ["a\u0000"], rows: [["b\u001F"]] }] }), fields).value).toEqual({ investigation: [{ title: "T", columns: ["a"], rows: [["b"]] }] });
    const huge = [{ title: "T", columns: ["a"], rows: Array(5000).fill(["x".repeat(100)]) }];
    expect(parseTextTables(form({ investigation: huge }), fields).issues.investigation).toEqual(["Las tablas de este apartado son demasiado grandes."]);
  });

  it("rechaza datos que no son tablas y filas con otro número de celdas", () => {
    expect(parseTextTables(form({ investigation: "no es json" }), fields).issues.investigation).toEqual(["Las tablas no tienen un formato válido."]);
    expect(parseTextTables(form({ investigation: [{ title: "T", columns: ["a", "b"], rows: [["solo una"]] }] }), fields).issues.investigation).toEqual(["Las tablas no tienen un formato válido."]);
  });
});

describe("pasteIntoTable", () => {
  const base = { title: "T", columns: ["a", "b"], rows: [["1", "2"]] };
  it("reparte desde la celda (fila -1 es la cabecera) y añade filas y columnas", () => {
    expect(pasteIntoTable(base, -1, 1, [["x", "y"], ["z", "w"]])).toEqual({ table: { title: "T", columns: ["a", "x", "y"], rows: [["1", "z", "w"]] }, truncated: false });
    expect(pasteIntoTable(base, 0, 0, [["p"], ["q"]])).toEqual({ table: { title: "T", columns: ["a", "b"], rows: [["p", "2"], ["q", ""]] }, truncated: false });
  });

  it("recorta a los límites y lo avisa", () => {
    const wide = pasteIntoTable(base, -1, 0, [Array(MAX_TABLE_COLUMNS + 2).fill("c")]);
    expect(wide.table.columns).toHaveLength(MAX_TABLE_COLUMNS);
    expect(wide.truncated).toBe(true);
    const tall = pasteIntoTable(base, 0, 0, Array(MAX_TABLE_ROWS + 3).fill(["r"]));
    expect(tall.table.rows).toHaveLength(MAX_TABLE_ROWS);
    expect(tall.truncated).toBe(true);
  });
});

describe("numberTextTables", () => {
  it("numera en el orden de los apartados y, dentro de cada uno, en su orden", () => {
    const table = (title: string) => ({ title, columns: ["a"], rows: [["b"]] });
    const numbered = numberTextTables({ rootCause: [table("C")], investigation: [table("A"), table("B")] }, fields);
    expect(numbered.investigation?.map((item) => [item.number, item.table.title])).toEqual([[1, "A"], [2, "B"]]);
    expect(numbered.rootCause?.map((item) => [item.number, item.table.title])).toEqual([[3, "C"]]);
  });
});

describe("storedTextTables", () => {
  it("lee lo guardado y descarta lo que no tiene forma de tabla", () => {
    const good = { title: "T", columns: ["a"], rows: [["b"]] };
    expect(storedTextTables({ investigation: [good, { title: 1 }], rootCause: "x" })).toEqual({ investigation: [good] });
    expect(storedTextTables(null)).toEqual({});
    expect(storedTextTables([good])).toEqual({});
  });
});

describe("parsePastedTable", () => {
  it("convierte celdas copiadas de Excel (tabulaciones y saltos de línea, comillas) en filas", () => {
    // Una celda con varias líneas queda en una (el editor y la casilla son de una línea).
    expect(parsePastedTable("Lote\tTemp.\r\nL-1\t9,4\r\nL-2\t\"varias\r\nlíneas\"\r\n")).toEqual([["Lote", "Temp."], ["L-1", "9,4"], ["L-2", "varias líneas"]]);
    expect(parsePastedTable("a\t\"con \"\"comillas\"\"\"")).toEqual([["a", "con \"comillas\""]]);
    expect(parsePastedTable("texto suelto")).toEqual([["texto suelto"]]);
    // Comillas que no delimitan la celda se toman tal cual.
    expect(parsePastedTable("\"Lote A\" retenido\tok")).toEqual([["\"Lote A\" retenido", "ok"]]);
    expect(parsePastedTable("\"abc\tdef\nghi")).toEqual([["\"abc", "def"], ["ghi", ""]]);
  });

  it("iguala el número de celdas de todas las filas", () => {
    expect(parsePastedTable("a\tb\tc\nd")).toEqual([["a", "b", "c"], ["d", "", ""]]);
  });
});

describe("orderedTextTables", () => {
  it("ordena las claves como los apartados para comparar sin cambios espurios", () => {
    const stored = { rootCause: [{ rows: [["b"]], title: "C", columns: ["a"] }], investigation: [{ columns: ["a"], rows: [], title: "A" }] };
    expect(JSON.stringify(orderedTextTables(stored, fields))).toBe('{"investigation":[{"title":"A","columns":["a"],"rows":[]}],"rootCause":[{"title":"C","columns":["a"],"rows":[["b"]]}]}');
    expect(orderedTextTables({}, fields)).toBeNull();
    expect(orderedTextTables(null, fields)).toBeNull();
  });
});

describe("utilidades comunes de los módulos", () => {
  const table = (title: string) => ({ title, columns: ["a"], rows: [["b"]] });
  it("initialFieldTables: tras un error, las enviadas (aunque estén incompletas); si no, las guardadas", () => {
    const sent = { "textTables:rootCause": JSON.stringify([{ title: "", columns: ["x"], rows: [] }]), "textTables:investigation": "" };
    expect(initialFieldTables("rootCause", sent, { rootCause: [table("Guardada")] })).toEqual([{ title: "", columns: ["x"], rows: [] }]);
    expect(initialFieldTables("investigation", sent, { investigation: [table("Guardada")] })).toEqual([]);
    expect(initialFieldTables("investigation", undefined, { investigation: [table("Guardada")] })).toEqual([table("Guardada")]);
    expect(initialFieldTables("rootCause", { "textTables:rootCause": "{roto" }, null)).toEqual([]);
  });

  it("tableSummaryErrors: el resumen nombra el apartado", () => {
    expect(tableSummaryErrors({ rootCause: ["1.ª tabla: falta el título."] }, { rootCause: "Causa raíz" })).toEqual(["Causa raíz · 1.ª tabla: falta el título."]);
  });

  it("annexTablePlacements: numera, ubica y baja las casillas que quedan bajo filas copiadas", () => {
    const placements = annexTablePlacements(
      { a: [table("A")], b: [table("B")], c: [table("C")] },
      ["a", "b", "c", "d"],
      { a: { table: 0, row: 5, cell: 0 }, b: { table: 1, row: 1, cell: 0 }, c: { table: 1, row: 8, cell: 1 }, d: null },
      [{ table: 1, row: 3, count: 4 }],
    );
    expect(placements.map((item) => [item.table, item.row, item.cell, item.tables[0].number])).toEqual([[0, 5, 0, 1], [1, 1, 0, 2], [1, 11, 1, 3]]);
  });
});

