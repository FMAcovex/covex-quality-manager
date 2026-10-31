import { createHash } from "node:crypto";
import { missingTemplateWords } from "@/lib/ooxml/template-text";
import { wordTableGrid } from "@/lib/ooxml/xml";
import { xlsxCells } from "@/lib/ooxml/xlsx-cells";
import { readZip, type ZipEntry } from "@/lib/ooxml/zip";

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
  /** Texto de la plantilla perdido o cambiado (para leer: se acorta a unas pocas palabras). */
  altered: string[];
  /**
   * Una clave por alteración, en el mismo orden: posición y huella de todo lo que falta (no solo de lo que se
   * muestra), para dar por prevista una sustitución sin guardar el texto de la plantilla.
   */
  alteredKeys: string[];
  /** Campos del expediente que aparecen en el anexo. */
  printed: Set<string>;
  /** Texto de cada casilla del anexo (también el de las tablas insertadas en ella). */
  cells: Array<{ where: string; text: string }>;
  /** Casillas de verificación marcadas (☒), con la opción que marcan y la clave (posición + huella de la opción). */
  checked: Array<{ where: string; label: string; key: string }>;
  /**
   * Controles de casilla de Word cuyo símbolo visible (☒/☐) no coincide con su estado (`w14:checked`): Word la
   * enseña de una forma y, al pulsarla, se comporta como la otra. No se puede dar por bueno.
   */
  checkboxProblems: string[];
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
    // Número de serie de Excel, también con hora (parte decimal).
    if (/^\d{5}(?:\.\d+)?$/.test(text.trim()) && byText.has(String(Math.floor(Number(text.trim()))))) {
      const field = byText.get(String(Math.floor(Number(text.trim()))))!;
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

function xmlOutsideTables(documentXml: string) {
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
  return outside;
}
const textOutsideTables = (documentXml: string) => wordText(xmlOutsideTables(documentXml));

const hasData = (text: string, decode: Decoder) => decode(text).fields.length > 0;
const emptyResult = (): AnnexComparison => ({ filled: [], altered: [], alteredKeys: [], printed: new Set(), cells: [], checked: [], checkboxProblems: [] });
const shortHash = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 16);

/**
 * Casillas de verificación (☐/☒) de un texto, en orden, con la opción que marcan. Las plantillas usan dos estilos:
 * - la opción sigue a la casilla: el texto empieza por una casilla o lo que hay antes de la primera acaba en «:»
 *   o «?» («¿Comité? ☐ Sí ☒ No …», «Estado: ☐ Abierta ☐ Cerrada»);
 * - la opción la precede: no hay texto tras la última casilla («SI ☐ NO ☒ NA ☐», «Conforme ☐»).
 * El estilo se decide con `layout` (el texto de la plantilla) o, si no se da, con el propio texto sin los datos del
 * anexo (marcadores ⟦…⟧). Si no está claro, la opción enseña las dos posibles («NO ↔ NA»). Vacía si la casilla está
 * sola en su casilla de la tabla.
 */
export function checkboxOptions(text: string, layout = text) {
  const parts = text.split(/([☐☒])/);
  const layoutParts = layout.replace(TOKEN, " ").split(/([☐☒])/);
  const squash = (value: string | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
  const first = squash(layoutParts[0]), last = squash(layoutParts[layoutParts.length - 1]);
  const style = layoutParts.length < 2 ? "follows" : !first || /[:?]$/.test(first) ? "follows" : !last ? "precedes" : "unclear";
  const boxes: Array<{ checked: boolean; label: string }> = [];
  for (let i = 1; i < parts.length; i += 2) {
    // Antes de la casilla interesa el final del texto (la opción); después, el principio.
    const before = squash(parts[i - 1]).slice(-60), after = squash(parts[i + 1]).slice(0, 60);
    const label = style === "follows" ? after || before : style === "precedes" ? before || after : before && after ? `${before} ↔ ${after}` : before || after;
    boxes.push({ checked: parts[i] === "☒", label });
  }
  return boxes;
}

/**
 * Etiqueta de una casilla de verificación sola en su casilla de la tabla: la etiqueta de al lado (derecha o
 * izquierda; si hay en los dos lados, las dos) o, si no hay, la de encima.
 */
function checkboxNeighbourLabel(rows: string[][], r: number, c: number, decode: Decoder) {
  const usable = (text: string | undefined) => {
    const label = (text ?? "").replace(/[☐☒]/g, " ").replace(/\s+/g, " ").trim();
    return label && !hasData(label, decode) ? label.slice(0, 60) : "";
  };
  // Solo la casilla vecina inmediata: más allá puede ser la etiqueta de otra casilla.
  const right = usable(rows[r][c + 1]), left = usable(rows[r][c - 1]);
  if (right && left) return `${left} ↔ ${right}`;
  if (right || left) return right || left;
  for (let k = r - 1; k >= 0; k--) if (usable(rows[k][c])) return "↑ " + usable(rows[k][c]);
  return "(sin etiqueta)";
}

/**
 * Controles de casilla de Word (`w14:checkbox`) cuyo símbolo no coincide con su estado, en todo el fragmento (también
 * el que envuelve una casilla entera de la tabla), con el texto que los sigue para situarlos.
 */
export function inconsistentCheckboxControls(xml: string) {
  const problems: Array<{ shows: boolean; state: boolean; context: string }> = [];
  for (const match of xml.matchAll(/<w14:checkbox>([\s\S]*?)<\/w14:checkbox>/g)) {
    const state = /<w14:checked\b[^>]*w14:val="(?:1|true)"/.test(match[1]);
    const rest = xml.slice(match.index! + match[0].length);
    // El contenido del propio control: termina antes del siguiente control de casilla; uno vacío no tiene símbolo.
    const next = rest.indexOf("<w14:checkbox>");
    const scope = next < 0 ? rest : rest.slice(0, next);
    const open = scope.search(/<w:sdtContent(?:\s[^>]*)?>/);
    if (open < 0) continue;
    const close = scope.indexOf("</w:sdtContent>", open);
    const glyph = scope.slice(open, close < 0 ? undefined : close).match(/[☐☒]/)?.[0];
    if (!glyph || (glyph === "☒") === state) continue;
    const context = decodeXml(scope.slice(close < 0 ? open : close).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 50);
    problems.push({ shows: glyph === "☒", state, context });
  }
  return problems;
}

function reportInconsistentControls(result: AnnexComparison, where: string, xml: string) {
  inconsistentCheckboxControls(xml).forEach((problem, index) => {
    result.checkboxProblems.push(`${where}, control de casilla ${index + 1} (antes de «${problem.context}»): se ve ${problem.shows ? "marcado (☒)" : "sin marcar (☐)"}, pero su control de Word está ${problem.state ? "marcado" : "sin marcar"}.`);
  });
}

/**
 * Casillas de un texto de la plantilla y del anexo en la misma posición: las marcadas y si falta o sobra alguna.
 * `where` es la posición en el anexo (para leer); `keyWhere`, la de la plantilla (para las claves de lo previsto),
 * que no cambia si el anexo añade filas por encima.
 */
function compareCheckboxes(result: AnnexComparison, where: string, keyWhere: string, templateText: string | null, text: string, fallbackLabel: () => string) {
  const boxes = checkboxOptions(text, templateText ?? text);
  const templateBoxes = templateText === null ? null : checkboxOptions(templateText);
  if (templateBoxes && templateBoxes.length !== boxes.length) alter(result, keyWhere, `tiene ${boxes.length} casillas de verificación; la plantilla, ${templateBoxes.length}.`, `casillas ${boxes.length}/${templateBoxes.length}`);
  boxes.forEach((box, index) => {
    if (!box.checked) return;
    const label = box.label || fallbackLabel();
    // La huella usa la opción de la plantilla cuando la hay: los datos que el anexo escribe al lado no la cambian.
    const keyLabel = templateBoxes?.[index] ? templateBoxes[index].label || fallbackLabel() : label;
    const keyPosition = `${keyWhere}, opción ${index + 1}`;
    result.checked.push({ where: `${where}, opción ${index + 1}`, label, key: `${keyPosition}#${shortHash(`${keyPosition}\u0000${keyLabel}`)}` });
  });
}

function alter(result: AnnexComparison, where: string, detail: string, everything: string) {
  result.altered.push(`${where}: ${detail}`);
  result.alteredKeys.push(`${where}#${createHash("sha256").update(`${where}\u0000${everything}`).digest("hex").slice(0, 16)}`);
}
const missingWords = (where: string, missing: string[]) => ({ where, detail: `falta ${quote(missing)}`, everything: missing.join(" ") });

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
  const pairs: Array<{ t: number | null; o: number | null }> = [];
  let o = 0;
  for (let t = 0; t < template.length; t++) {
    let found = -1;
    for (let k = o; k < Math.min(output.length, o + LOOKAHEAD); k++) if (rowMatches(template[t], output[k])) { found = k; break; }
    if (found < 0) {
      // Sin fila equivalente: se compara con la que toca, para mostrar qué se ha perdido; si ya no quedan
      // filas, la fila de la plantilla falta.
      pairs.push({ t, o: o < output.length ? o++ : null });
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
  const result = emptyResult();
  if (template.length !== output.length) alter(result, "Documento", `el anexo tiene ${output.length} tablas; la plantilla, ${template.length}.`, `${output.length}/${template.length}`);
  output.forEach((rows, ti) => {
    const templateRows = template[ti] ?? [];
    for (const { t, o } of alignRows(templateRows, rows)) {
      if (o === null) {
        const lost = templateRows[t!].filter(Boolean).join(" · ");
        alter(result, `Tabla ${ti + 1}, fila ${t! + 1}`, `falta la fila de la plantilla («${lost.split(/\s+/).slice(0, MAX_WORDS).join(" ")}»).`, lost);
        continue;
      }
      if (t !== null && templateRows[t].length !== rows[o].length) {
        alter(result, `Tabla ${ti + 1}, fila ${t + 1}`, `tiene ${rows[o].length} casillas; la plantilla, ${templateRows[t].length}.`, templateRows[t].join("\u0001"));
      }
      rows[o].forEach((text, c) => {
        const where = `Tabla ${ti + 1}, fila ${o + 1}, casilla ${c + 1}${t === null ? " (fila añadida)" : ""}`;
        result.cells.push({ where, text });
        const decoded = decode(text);
        decoded.fields.forEach((field) => result.printed.add(field));
        const templateText = t === null ? null : templateRows[t][c] ?? null;
        if (templateText !== null) {
          const missing = missingTemplateWords(templateText, text);
          if (missing.length) { const item = missingWords(`Tabla ${ti + 1}, fila ${t! + 1}, casilla ${c + 1}`, missing); alter(result, item.where, item.detail, item.everything); }
        }
        if (decoded.fields.length && text !== templateText) result.filled.push({ where, label: labelFor(rows, o, c, decode), text: decoded.annotated });
        const keyWhere = t === null ? where : `Tabla ${ti + 1}, fila ${t + 1}, casilla ${c + 1}`;
        compareCheckboxes(result, where, keyWhere, templateText, text, () => checkboxNeighbourLabel(t === null ? rows : templateRows, t ?? o, c, decode));
      });
    }
  });
  const outsideTemplate = textOutsideTables(templateXml), outsideOutput = textOutsideTables(outputXml);
  compareCheckboxes(result, "Fuera de tablas", "Fuera de tablas", outsideTemplate, outsideOutput, () => "(sin etiqueta)");
  reportInconsistentControls(result, "Documento", outputXml);
  const missing = missingTemplateWords(outsideTemplate, outsideOutput);
  if (missing.length) { const item = missingWords("Texto fuera de tablas", missing); alter(result, item.where, item.detail, item.everything); }
  const outside = decode(outsideOutput);
  outside.fields.forEach((field) => result.printed.add(field));
  if (outside.fields.length) result.filled.push({ where: "Fuera de tablas", label: "", text: outside.annotated.slice(0, 400) });
  return result;
}

export function compareExcelAnnex(template: Buffer, output: Buffer, decode: Decoder): AnnexComparison {
  const before = xlsxCells(readZip(template), { numbers: true }), after = xlsxCells(readZip(output), { numbers: true });
  const result = emptyResult();
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
      if (o === null) {
        const lost = templateRows[t!].filter(Boolean).join(" · ");
        alter(result, `${sheet}, fila ${original.rows[t!]} de la plantilla`, `falta la fila («${lost.split(/\s+/).slice(0, MAX_WORDS).join(" ")}»).`, lost);
        continue;
      }
      outputRows[o].forEach((text, c) => {
        const ref = `${columns[c]}${generated.rows[o]}`;
        const templateText = t === null ? "" : templateRows[t][c];
        if (!text && !templateText) return;
        if (text) result.cells.push({ where: `${sheet}!${ref}`, text });
        if (templateText) {
          const missing = missingTemplateWords(templateText, text);
          if (missing.length) { const item = missingWords(`${sheet}!${ref}`, missing); alter(result, item.where, item.detail, item.everything); }
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
  [...before.keys()].slice(after.size).forEach((sheet) => alter(result, "Libro", `falta la hoja «${sheet}».`, sheet));
  [...after.keys()].slice(before.size).forEach((sheet) => alter(result, "Libro", `hoja de más «${sheet}».`, `+${sheet}`));
  return result;
}

/**
 * Cabeceras y pies de un anexo Word frente a los de su plantilla, parte a parte (`word/header1.xml`…): el
 * texto de la plantilla sigue en su sitio, con el mismo criterio que el cuerpo, y los datos que caen en ellos
 * cuentan como impresos (por ejemplo, el código de auditoría en el pie del informe externo).
 */
export function compareWordHeadersFooters(template: ZipEntry[], output: ZipEntry[], decode: Decoder, result: AnnexComparison) {
  const parts = (entries: ZipEntry[]) => new Map(entries.filter((entry) => /^word\/(header|footer)\d*\.xml$/.test(entry.name)).map((entry) => [entry.name, entry.data.toString("utf8")]));
  const before = parts(template), after = parts(output);
  const label = (name: string) => `${name.includes("header") ? "Encabezado" : "Pie"} (${name.replace("word/", "")})`;
  for (const [name, xml] of before) {
    const generated = after.get(name);
    if (generated === undefined) { alter(result, label(name), "falta en el anexo.", `-${name}`); continue; }
    const templateText = wordText(xml), text = wordText(generated);
    const missing = missingTemplateWords(templateText, text);
    if (missing.length) { const item = missingWords(label(name), missing); alter(result, item.where, item.detail, item.everything); }
    compareCheckboxes(result, label(name), label(name), templateText, text, () => "(sin etiqueta)");
    reportInconsistentControls(result, label(name), generated);
    const decoded = decode(text);
    decoded.fields.forEach((field) => result.printed.add(field));
    if (decoded.fields.length) {
      result.filled.push({ where: label(name), label: "", text: decoded.annotated.slice(0, 300) });
      result.cells.push({ where: label(name), text });
    }
  }
  for (const name of after.keys()) if (!before.has(name)) alter(result, label(name), "no está en la plantilla.", `+${name}`);
}
