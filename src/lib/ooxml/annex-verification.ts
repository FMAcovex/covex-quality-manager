import { missingTemplateWords } from "@/lib/ooxml/template-text";
import { wordTableGrid } from "@/lib/ooxml/xml";
import { xlsxCells } from "@/lib/ooxml/xlsx-cells";
import { readZip } from "@/lib/ooxml/zip";

/**
 * Verificación de un anexo generado frente a su plantilla (D-128): qué dato cae en cada casilla, que el
 * texto de la plantilla sigue en su sitio (como D-098: una casilla ☒ equivale a la ☐ y los huecos «____»
 * se pueden rellenar) y qué campos del expediente se imprimen. Los datos del expediente de prueba llevan
 * marcadores únicos (`⟦Modelo.campo⟧`) y fechas distintas, que el decodificador traduce a su campo.
 */

export type FilledCell = { where: string; label: string; text: string };
export type AnnexComparison = {
  /** Casillas con datos del expediente (las que difieren de la plantilla). */
  filled: FilledCell[];
  /** Texto de la plantilla perdido o cambiado. */
  altered: string[];
  /** Campos del expediente que aparecen en el anexo. */
  printed: Set<string>;
  /** Texto de cada casilla del anexo (también el de las tablas insertadas en ella). */
  cells: Array<{ where: string; text: string }>;
};
export type Decoder = (text: string) => { fields: string[]; annotated: string };

const TOKEN = /⟦([^⟧]+)⟧/g;
const DATE = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
const MAX_WORDS = 8;
const quote = (words: string[]) => `«${words.slice(0, MAX_WORDS).join(" ")}${words.length > MAX_WORDS ? " …" : ""}»`;

/** Traduce marcadores y fechas únicas (AAAA-MM-DD → campo) a los campos del expediente. */
export function tokenDecoder(dates: Record<string, string>): Decoder {
  const byText = new Map<string, string>();
  for (const [iso, field] of Object.entries(dates)) {
    const [year, month, day] = iso.split("-");
    byText.set(`${day}/${month}/${year}`, field);
    byText.set(`${Number(day)}/${Number(month)}/${year}`, field);
    // Excel guarda las fechas como número de serie (días desde 30/12/1899).
    byText.set(String(Math.round((Date.UTC(+year, +month - 1, +day) - Date.UTC(1899, 11, 30)) / 86_400_000)), field);
  }
  return (text) => {
    const fields = [...text.matchAll(TOKEN)].map((match) => match[1]);
    const annotated = text.replace(DATE, (date) => (byText.has(date) ? `${date} [${byText.get(date)}]` : date));
    for (const match of text.matchAll(DATE)) if (byText.has(match[0])) fields.push(byText.get(match[0])!);
    if (/^\d{5}(?:\.0+)?$/.test(text.trim()) && byText.has(String(Number(text.trim())))) {
      const field = byText.get(String(Number(text.trim())))!;
      return { fields: [...fields, field], annotated: `${text.trim()} [${field}]` };
    }
    return { fields, annotated };
  };
}

const decodeXml = (value: string) => value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** Texto visible de un fragmento Word: los runs de un párrafo se unen, los párrafos se separan con un espacio. */
export function wordText(xml: string) {
  return [...xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>|<w:p(?:\s[^>]*)?\/>/g)]
    .map((paragraph) => decodeXml([...(paragraph[1] ?? "").matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>/g)].map((t) => t[1] ?? " ").join("")))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function textOutsideTables(documentXml: string) {
  const body = documentXml.slice(documentXml.indexOf("<w:body"), documentXml.lastIndexOf("</w:body>"));
  let outside = body;
  for (;;) {
    // Quita las tablas de primer nivel (con las que lleven dentro) y vuelve a mirar.
    const start = outside.search(/<w:tbl(?:\s[^>]*)?>/);
    if (start < 0) break;
    let depth = 0, end = -1;
    for (const match of outside.slice(start).matchAll(/<w:tbl(?:\s[^>]*)?>|<\/w:tbl>/g)) {
      depth += match[0].startsWith("</") ? -1 : 1;
      if (depth === 0) { end = start + match.index! + match[0].length; break; }
    }
    if (end < 0) break;
    outside = outside.slice(0, start) + outside.slice(end);
  }
  return wordText(outside);
}

const hasData = (text: string, decode: Decoder) => decode(text).fields.length > 0;

/** Etiqueta de una casilla: el texto de la plantilla más cercano a su izquierda o, si no, encima. */
function labelFor(rows: string[][], r: number, c: number, decode: Decoder) {
  for (let k = c - 1; k >= 0; k--) if (rows[r][k] && !hasData(rows[r][k], decode)) return rows[r][k].slice(0, 70);
  for (let k = r - 1; k >= 0; k--) if (rows[k][c] && !hasData(rows[k][c], decode)) return "↑ " + rows[k][c].slice(0, 70);
  return "(sin etiqueta)";
}

const rowMatches = (template: string[], output: string[]) =>
  template.length === output.length && template.every((text, c) => missingTemplateWords(text, output[c]).length === 0);

/**
 * Empareja las filas de la plantilla con las del anexo. Las filas que el anexo copia (una por acción,
 * producto, seguimiento…) aparecen como filas de más: se saltan sin descuadrar las de debajo.
 */
function alignRows(template: string[][], output: string[][]) {
  const LOOKAHEAD = 200;
  const pairs: Array<{ t: number | null; o: number }> = [];
  let o = 0;
  for (let t = 0; t < template.length; t++) {
    let found = -1;
    for (let k = o; k < Math.min(output.length, o + LOOKAHEAD); k++) if (rowMatches(template[t], output[k])) { found = k; break; }
    if (found < 0) {
      // Sin fila equivalente: se compara con la que toca, para mostrar qué se ha perdido.
      if (o < output.length) pairs.push({ t, o: o++ });
      continue;
    }
    while (o < found) pairs.push({ t: null, o: o++ });
    pairs.push({ t, o: o++ });
  }
  while (o < output.length) pairs.push({ t: null, o: o++ });
  return pairs;
}

export function compareWordAnnex(templateXml: string, outputXml: string, decode: Decoder): AnnexComparison {
  const toText = (grid: string[][][]) => grid.map((rows) => rows.map((cells) => cells.map(wordText)));
  const template = toText(wordTableGrid(templateXml)), output = toText(wordTableGrid(outputXml));
  const result: AnnexComparison = { filled: [], altered: [], printed: new Set(), cells: [] };
  if (template.length !== output.length) result.altered.push(`El anexo tiene ${output.length} tablas; la plantilla, ${template.length}.`);
  output.forEach((rows, ti) => {
    const templateRows = template[ti] ?? [];
    for (const { t, o } of alignRows(templateRows, rows)) {
      rows[o].forEach((text, c) => {
        const where = `Tabla ${ti + 1}, fila ${o + 1}, casilla ${c + 1}${t === null ? " (fila añadida)" : ""}`;
        result.cells.push({ where, text });
        const decoded = decode(text);
        decoded.fields.forEach((field) => result.printed.add(field));
        const templateText = t === null ? null : templateRows[t][c] ?? null;
        if (templateText !== null) {
          const missing = missingTemplateWords(templateText, text);
          if (missing.length) result.altered.push(`Tabla ${ti + 1}, fila ${t! + 1}, casilla ${c + 1}: falta ${quote(missing)}`);
        }
        if (decoded.fields.length && text !== templateText) result.filled.push({ where, label: labelFor(rows, o, c, decode), text: decoded.annotated });
      });
    }
  });
  const outsideTemplate = textOutsideTables(templateXml), outsideOutput = textOutsideTables(outputXml);
  const missing = missingTemplateWords(outsideTemplate, outsideOutput);
  if (missing.length) result.altered.push(`Texto fuera de tablas: falta ${quote(missing)}`);
  const outside = decode(outsideOutput);
  outside.fields.forEach((field) => result.printed.add(field));
  if (outside.fields.length) result.filled.push({ where: "Fuera de tablas", label: "", text: outside.annotated.slice(0, 400) });
  return result;
}

export function compareExcelAnnex(template: Buffer, output: Buffer, decode: Decoder): AnnexComparison {
  const before = xlsxCells(readZip(template), { numbers: true }), after = xlsxCells(readZip(output), { numbers: true });
  const result: AnnexComparison = { filled: [], altered: [], printed: new Set(), cells: [] };
  const columnOf = (ref: string) => ref.replace(/\d+$/, ""), rowOf = (ref: string) => Number(ref.replace(/^[A-Z]+/, ""));
  const columnIndex = (column: string) => [...column].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);
  // Filas de la hoja como listas de casillas por columna, en orden; vacías las que no tienen texto.
  const grid = (cells: Map<string, string>) => {
    const rows = [...new Set([...cells.keys()].map(rowOf))].sort((a, b) => a - b);
    const width = Math.max(0, ...[...cells.keys()].map((ref) => columnIndex(columnOf(ref))));
    const columns = Array.from({ length: width }, (_, i) => { let n = i + 1, name = ""; while (n) { name = String.fromCharCode(65 + ((n - 1) % 26)) + name; n = Math.floor((n - 1) / 26); } return name; });
    return { rows, columns, values: rows.map((row) => columns.map((column) => cells.get(`${column}${row}`) ?? "")) };
  };
  // Las hojas se emparejan por posición, como las usan los generadores (renombran la hoja con el año).
  const templateSheets = [...before.values()];
  [...after].forEach(([sheet, cells], index) => {
    const original = grid(templateSheets[index] ?? new Map<string, string>()), generated = grid(cells);
    const width = Math.max(original.columns.length, generated.columns.length);
    const pad = (values: string[][]) => values.map((row) => [...row, ...Array(width - row.length).fill("")]);
    const templateRows = pad(original.values), outputRows = pad(generated.values);
    const columns = width > generated.columns.length ? original.columns : generated.columns;
    // Las filas de datos insertadas bajan la leyenda y la firma: se emparejan como en Word.
    for (const { t, o } of alignRows(templateRows, outputRows)) {
      outputRows[o].forEach((text, c) => {
        const ref = `${columns[c]}${generated.rows[o]}`;
        const templateText = t === null ? "" : templateRows[t][c];
        if (!text && !templateText) return;
        if (text) result.cells.push({ where: `${sheet}!${ref}`, text });
        if (templateText) {
          const missing = missingTemplateWords(templateText, text);
          if (missing.length) result.altered.push(`${sheet}!${ref}: falta ${quote(missing)}`);
        }
        const decoded = decode(text);
        decoded.fields.forEach((field) => result.printed.add(field));
        if (!decoded.fields.length || text === templateText) return;
        // Cabecera: la casilla de texto más cercana encima, en la misma columna.
        let label = "";
        for (let r = o - 1; r >= 0 && !label; r--) if (outputRows[r][c] && !hasData(outputRows[r][c], decode)) label = outputRows[r][c].slice(0, 60);
        result.filled.push({ where: `${sheet}!${ref}`, label, text: decoded.annotated });
      });
    }
  });
  [...before.keys()].slice(after.size).forEach((sheet) => result.altered.push(`Falta la hoja «${sheet}».`));
  return result;
}
