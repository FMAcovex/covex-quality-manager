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

// Topes holgados solo contra envíos desmesurados; los límites de uso se comprueban después, con su mensaje.
const MAX_FIELD_JSON = 300_000;
const tableShape = z.object({
  title: z.string().max(10_000),
  columns: z.array(z.string().max(10_000)).min(1).max(50),
  rows: z.array(z.array(z.string().max(10_000)).max(50)).max(500),
}).refine((table) => table.rows.every((row) => row.length === table.columns.length));

// Caracteres de control que Word no admite en el documento (se conservan tabulación y saltos de línea).
const clean = (value: string) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();

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
    if (raw.length > MAX_FIELD_JSON) {
      issues[field] = ["Las tablas de este apartado son demasiado grandes."];
      continue;
    }
    let parsed: z.infer<typeof tableShape>[];
    try {
      parsed = z.array(tableShape).max(50).parse(JSON.parse(raw));
    } catch {
      // Dato enviado por el cliente que no es JSON o no tiene forma de tabla: es un error de validación del campo.
      issues[field] = ["Las tablas no tienen un formato válido."];
      continue;
    }
    const problems: string[] = [];
    const tables: TextTable[] = [];
    parsed.forEach((table, index) => {
      const title = clean(table.title);
      const columns = table.columns.map(clean);
      const rows = table.rows.map((row) => row.map(clean)).filter(filled);
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

/**
 * Celdas copiadas de Excel (tabulaciones y saltos de línea) como filas de igual longitud. Una celda entre
 * comillas (como las copia Excel cuando llevan saltos de línea o comillas) se lee como una sola; una celda
 * con varias líneas queda en una línea, porque el editor y la casilla del anexo son de una línea por celda.
 */
export function parsePastedTable(text: string): string[][] {
  const source = text.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  // ¿Empieza aquí una celda entre comillas bien cerrada (comilla final seguida de tabulación, salto o fin)?
  const quotedEnd = (start: number) => {
    for (let index = start + 1; index < source.length; index++) {
      if (source[index] !== '"') continue;
      if (source[index + 1] === '"') { index++; continue; }
      const next = source[index + 1];
      return next === undefined || next === "\t" || next === "\n" ? index : -1;
    }
    return -1;
  };
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === '"' && cell === "") {
      const end = quotedEnd(index);
      if (end > 0) {
        cell = source.slice(index + 1, end).replace(/""/g, '"').replace(/\s*\n\s*/g, " ");
        index = end;
        continue;
      }
    }
    if (char === "\t") { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  row.push(cell);
  rows.push(row);
  const width = Math.max(...rows.map((cells) => cells.length));
  return rows.map((cells) => [...cells, ...Array(width - cells.length).fill("")]);
}

/**
 * Pega filas en una tabla a partir de la celda indicada (fila -1 es la cabecera), añadiendo las filas y
 * columnas que falten hasta los límites. `truncated` indica que algo no cabía y se ha dejado fuera.
 */
export function pasteIntoTable(table: TextTable, row: number, column: number, pasted: string[][]) {
  const pastedWidth = Math.max(0, ...pasted.map((cells) => cells.length));
  const neededWidth = Math.max(table.columns.length, column + pastedWidth);
  const neededHeight = Math.max(table.rows.length + 1, row + 1 + pasted.length);
  const width = Math.min(MAX_TABLE_COLUMNS, neededWidth);
  const height = Math.min(MAX_TABLE_ROWS + 1, neededHeight);
  const grid = [table.columns, ...table.rows].map((cells) => [...cells, ...Array(Math.max(0, width - cells.length)).fill("")].slice(0, width));
  while (grid.length < height) grid.push(Array(width).fill(""));
  pasted.forEach((cells, offset) => cells.forEach((value, at) => {
    const target = grid[row + 1 + offset];
    if (target && column + at < width) target[column + at] = value;
  }));
  return { table: { title: table.title, columns: grid[0], rows: grid.slice(1) }, truncated: neededWidth > width || neededHeight > height };
}

/** Tablas iniciales de un campo del formulario: tras un error de guardado, las enviadas; si no, las guardadas. */
export function initialFieldTables(field: string, submitted: Record<string, string | string[]> | undefined, stored: TextTables | null | undefined): TextTable[] {
  const sent = submitted?.[textTablesInputName(field)];
  if (typeof sent !== "string") return stored?.[field] ?? [];
  if (!sent) return [];
  try {
    return storedTextTables({ [field]: JSON.parse(sent) })[field] ?? [];
  } catch {
    // Lo enviado no es JSON (no lo genera el editor): se empieza sin tablas en ese campo.
    return [];
  }
}

/** Errores de tablas para el resumen del formulario, con el nombre del apartado («Causa raíz · 1.ª tabla: …»). */
export function tableSummaryErrors(issues: Record<string, string[]>, labels: Partial<Record<string, string>>) {
  return Object.entries(issues).flatMap(([field, messages]) => messages.map((message) => `${labels[field] ?? field} · ${message}`));
}

export type AnnexCell = { table: number; row: number; cell: number };

/**
 * Dónde va cada tabla en un anexo: numeradas en el orden de los apartados, en la casilla de su campo
 * (null: el campo no va al anexo). `copiedRows`: filas de la plantilla que el anexo copia una vez por
 * elemento (acciones, seguimientos…); las casillas que quedan debajo bajan tantas filas como copias extra.
 */
export function annexTablePlacements(
  tables: TextTables,
  fieldOrder: readonly string[],
  cells: Partial<Record<string, AnnexCell | null>>,
  copiedRows: Array<{ table: number; row: number; count: number }> = [],
) {
  const numbered = numberTextTables(tables, fieldOrder);
  return fieldOrder.flatMap((field) => {
    const cell = cells[field];
    const items = numbered[field];
    if (!cell || !items?.length) return [];
    const shift = copiedRows
      .filter((copied) => copied.table === cell.table && cell.row > copied.row)
      .reduce((total, copied) => total + Math.max(0, copied.count - 1), 0);
    return [{ ...cell, row: cell.row + shift, tables: items }];
  });
}

