import { z } from "zod";

// D-127: tablas editables en los textos largos. Cada campo puede llevar tablas propias, que se guardan
// como datos (título, cabecera y filas de texto) y salen en el anexo dentro de la casilla del apartado.

export const MAX_TABLE_COLUMNS = 8;
export const MAX_TABLE_ROWS = 50;
export const MAX_TABLES_PER_FIELD = 10;
export const MAX_TABLE_CELL = 500;
export const MAX_TABLE_TITLE = 200;

export type TextTable = { title: string; columns: string[]; rows: string[][] };
/** Tablas de un expediente, por campo de texto. */
export type TextTables = Partial<Record<string, TextTable[]>>;
export type NumberedTable = { number: number; table: TextTable };

const tableShape = z.object({
  title: z.string(),
  columns: z.array(z.string()).min(1),
  rows: z.array(z.array(z.string())),
}).refine((table) => table.rows.every((row) => row.length === table.columns.length));

/** Nombre del campo oculto del formulario con las tablas de un campo de texto. */
export function textTablesInputName(field: string) {
  return `textTables:${field}`;
}

const ordinal = (index: number) => `${index + 1}.ª tabla`;
const filled = (cells: string[]) => cells.some((cell) => cell !== "");

/**
 * Lee del formulario las tablas de los campos que las admiten. Recorta las celdas, quita filas y tablas
 * vacías y comprueba título y límites; los errores van al campo («1.ª tabla: …»). Sin tablas, null.
 */
export function parseTextTables(formData: FormData, fields: readonly string[]) {
  const value: Record<string, TextTable[]> = {};
  const issues: Record<string, string[]> = {};
  for (const field of fields) {
    const raw = formData.get(textTablesInputName(field));
    if (typeof raw !== "string" || !raw.trim()) continue;
    let parsed: z.infer<typeof tableShape>[];
    try {
      parsed = z.array(tableShape).parse(JSON.parse(raw));
    } catch {
      // Dato enviado por el cliente que no es JSON o no tiene forma de tabla: es un error de validación del campo.
      issues[field] = ["Las tablas no tienen un formato válido."];
      continue;
    }
    const problems: string[] = [];
    const tables: TextTable[] = [];
    parsed.forEach((table, index) => {
      const title = table.title.trim();
      const columns = table.columns.map((cell) => cell.trim());
      const rows = table.rows.map((row) => row.map((cell) => cell.trim())).filter(filled);
      const hasData = filled(columns) || rows.length > 0;
      if (!title && !hasData) return;
      if (!title) problems.push(`${ordinal(index)}: falta el título.`);
      else if (!hasData) problems.push(`${ordinal(index)}: no tiene datos.`);
      if (title.length > MAX_TABLE_TITLE) problems.push(`${ordinal(index)}: el título admite ${MAX_TABLE_TITLE} caracteres.`);
      if (columns.length > MAX_TABLE_COLUMNS) problems.push(`${ordinal(index)}: como máximo ${MAX_TABLE_COLUMNS} columnas.`);
      if (rows.length > MAX_TABLE_ROWS) problems.push(`${ordinal(index)}: como máximo ${MAX_TABLE_ROWS} filas.`);
      if ([columns, ...rows].some((row) => row.some((cell) => cell.length > MAX_TABLE_CELL))) problems.push(`${ordinal(index)}: cada celda admite ${MAX_TABLE_CELL} caracteres.`);
      tables.push({ title, columns, rows });
    });
    if (tables.length > MAX_TABLES_PER_FIELD) problems.push(`Como máximo ${MAX_TABLES_PER_FIELD} tablas por apartado.`);
    if (problems.length) issues[field] = problems;
    else if (tables.length) value[field] = tables;
  }
  return { value: Object.keys(issues).length || !Object.keys(value).length ? null : value, issues };
}

/** Tablas guardadas, descartando lo que no tenga forma de tabla (datos antiguos o dañados). */
export function storedTextTables(json: unknown): Record<string, TextTable[]> {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  const result: Record<string, TextTable[]> = {};
  for (const [field, tables] of Object.entries(json as Record<string, unknown>)) {
    if (!Array.isArray(tables)) continue;
    const valid = tables.flatMap((table) => {
      const parsed = tableShape.safeParse(table);
      return parsed.success ? [{ title: parsed.data.title, columns: parsed.data.columns, rows: parsed.data.rows }] : [];
    });
    if (valid.length) result[field] = valid;
  }
  return result;
}

/**
 * Las tablas con las claves en el orden de los apartados (y título, cabecera y filas en ese orden), para
 * comparar lo guardado con lo enviado sin cambios espurios por el orden de claves de JSONB. Vacío, null.
 */
export function orderedTextTables(tables: TextTables | null | undefined, fieldOrder: readonly string[]) {
  const ordered: Record<string, TextTable[]> = {};
  for (const field of fieldOrder) {
    const list = tables?.[field];
    if (list?.length) ordered[field] = list.map(({ title, columns, rows }) => ({ title, columns, rows }));
  }
  return Object.keys(ordered).length ? ordered : null;
}

/** «Tabla 1, 2…» en todo el expediente: en el orden de los apartados y, dentro de cada uno, en su orden. */
export function numberTextTables(tables: TextTables, fieldOrder: readonly string[]) {
  const numbered: Partial<Record<string, NumberedTable[]>> = {};
  let number = 0;
  for (const field of fieldOrder) {
    const list = tables[field];
    if (list?.length) numbered[field] = list.map((table) => ({ number: ++number, table }));
  }
  return numbered;
}

/** Celdas copiadas de Excel (tabulaciones, saltos de línea y comillas) como filas de igual longitud. */
export function parsePastedTable(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === "\t") { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  row.push(cell);
  rows.push(row);
  const width = Math.max(...rows.map((cells) => cells.length));
  return rows.map((cells) => [...cells, ...Array(width - cells.length).fill("")]);
}
