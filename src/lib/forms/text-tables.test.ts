import { describe, expect, it } from "vitest";
import {
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
  numberTextTables,
  orderedTextTables,
  parsePastedTable,
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

  it("rechaza datos que no son tablas y filas con otro número de celdas", () => {
    expect(parseTextTables(form({ investigation: "no es json" }), fields).issues.investigation).toEqual(["Las tablas no tienen un formato válido."]);
    expect(parseTextTables(form({ investigation: [{ title: "T", columns: ["a", "b"], rows: [["solo una"]] }] }), fields).issues.investigation).toEqual(["Las tablas no tienen un formato válido."]);
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
    expect(parsePastedTable("Lote\tTemp.\r\nL-1\t9,4\r\nL-2\t\"varias\r\nlíneas\"\r\n")).toEqual([["Lote", "Temp."], ["L-1", "9,4"], ["L-2", "varias\nlíneas"]]);
    expect(parsePastedTable("a\t\"con \"\"comillas\"\"\"")).toEqual([["a", "con \"comillas\""]]);
    expect(parsePastedTable("texto suelto")).toEqual([["texto suelto"]]);
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

