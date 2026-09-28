import { escapeXml } from "@/lib/ooxml/xml";

export type SheetRow = { number: number; xml: string };

function prefixFor(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<([A-Za-z0-9_]+:)?${tag}\\b`));
  return match?.[1] ?? "";
}

export function sheetRows(sheetXml: string): SheetRow[] {
  const prefix = prefixFor(sheetXml, "row");
  const re = new RegExp(`<${prefix}row\\b[^>]*\\br="(\\d+)"[^>]*>[\\s\\S]*?<\\/${prefix}row>`, "g");
  return [...sheetXml.matchAll(re)].map((match) => ({ number: Number(match[1]), xml: match[0] }));
}

export function rowStyles(rowXml: string) {
  const styles = new Map<string, number>();
  const cellPrefix = prefixFor(rowXml, "c");
  const re = new RegExp(`<${cellPrefix}c\\b([^>]*\\br="([A-Z]+)\\d+"[^>]*)`, "g");
  for (const match of rowXml.matchAll(re)) {
    styles.set(match[2], Number(match[1].match(/\\bs="(\\d+)"/)?.[1] ?? 0));
  }
  return styles;
}

export function rowHeight(rowXml: string) {
  return rowXml.match(/\\bht="([^"]+)"/)?.[1] ?? null;
}

export function buildRow(
  templateRow: string,
  rowNumber: number,
  columns: Array<{ column: string; value: string; style?: number }>,
) {
  const rowPrefix = prefixFor(templateRow, "row");
  const cellPrefix = prefixFor(templateRow, "c");
  const templateStyles = rowStyles(templateRow);
  const height = rowHeight(templateRow);
  const attrs = [`r="${rowNumber}"`, height ? `ht="${height}" customHeight="1"` : ""]
    .filter(Boolean)
    .join(" ");
  const cells = columns
    .map(({ column, value, style }) => {
      const selected = style ?? templateStyles.get(column) ?? 0;
      const styleAttr = selected ? ` s="${selected}"` : "";
      if (!value) return `<${cellPrefix}c r="${column}${rowNumber}"${styleAttr}></${cellPrefix}c>`;
      return `<${cellPrefix}c r="${column}${rowNumber}"${styleAttr} t="inlineStr"><${cellPrefix}is><${cellPrefix}t xml:space="preserve">${escapeXml(value)}</${cellPrefix}t></${cellPrefix}is></${cellPrefix}c>`;
    })
    .join("");
  return `<${rowPrefix}row ${attrs}>${cells}</${rowPrefix}row>`;
}

export function renumberRow(rowXml: string, from: number, to: number) {
  return rowXml
    .replace(new RegExp(`(<(?:[A-Za-z0-9_]+:)?row[^>]*\\br=")${from}(")`), `$1${to}$2`)
    .replace(new RegExp(`r="([A-Z]+)${from}"`, "g"), `r="$1${to}"`);
}

export function replaceSheetData(sheetXml: string, rows: string[]) {
  const prefix = prefixFor(sheetXml, "sheetData");
  return sheetXml.replace(
    new RegExp(`<${prefix}sheetData>[\\s\\S]*?<\\/${prefix}sheetData>`),
    `<${prefix}sheetData>${rows.join("")}</${prefix}sheetData>`,
  );
}

export function setSheetDimension(sheetXml: string, ref: string) {
  return sheetXml.replace(/<((?:[A-Za-z0-9_]+:)?dimension)\b[^>]*\bref="[^"]+"[^>]*\/>/, `<$1 ref="${ref}"/>`);
}

function cellXfs(stylesXml: string) {
  const prefix = prefixFor(stylesXml, "cellXfs");
  const re = new RegExp(`<${prefix}cellXfs\\b([^>]*)>([\\s\\S]*?)<\\/${prefix}cellXfs>`);
  const match = stylesXml.match(re);
  if (!match) throw new Error("XLSX styles: cellXfs no encontrado.");
  const xfPrefix = prefixFor(match[2], "xf");
  const xfRe = new RegExp(`<${xfPrefix}xf\\b[^>]*(?:\\/>|>[\\s\\S]*?<\\/${xfPrefix}xf>)`, "g");
  return {
    prefix,
    attrs: match[1],
    inner: match[2],
    entries: [...match[2].matchAll(xfRe)].map((item) => item[0]),
    full: match[0],
  };
}

function fillId(xf: string) {
  return Number(xf.match(/\bfillId="(\d+)"/)?.[1] ?? 0);
}

function cloneWithFill(xf: string, targetFill: number) {
  let clone = xf.replace(/\bfillId="\d+"/, `fillId="${targetFill}"`);
  if (!/\bfillId="/.test(clone)) clone = clone.replace(/<((?:[A-Za-z0-9_]+:)?xf)\b/, `<$1 fillId="${targetFill}"`);
  if (/\bapplyFill="/.test(clone)) clone = clone.replace(/\bapplyFill="[^"]*"/, 'applyFill="1"');
  else clone = clone.replace(/\/>$/, ' applyFill="1"/>').replace(/>$/, ' applyFill="1">');
  return clone;
}

export function addFillVariants(
  stylesXml: string,
  baseStyleIds: number[],
  legendStyleId: number,
) {
  const parsed = cellXfs(stylesXml);
  const legend = parsed.entries[legendStyleId];
  if (!legend) throw new Error(`XLSX styles: estilo de leyenda ${legendStyleId} no encontrado.`);
  const targetFill = fillId(legend);
  const map = new Map<number, number>();
  const additions: string[] = [];
  for (const base of [...new Set(baseStyleIds)]) {
    const source = parsed.entries[base];
    if (!source) throw new Error(`XLSX styles: estilo base ${base} no encontrado.`);
    const id = parsed.entries.length + additions.length;
    additions.push(cloneWithFill(source, targetFill));
    map.set(base, id);
  }
  const newCount = parsed.entries.length + additions.length;
  const attrs = /\bcount="/.test(parsed.attrs)
    ? parsed.attrs.replace(/\bcount="\d+"/, `count="${newCount}"`)
    : `${parsed.attrs} count="${newCount}"`;
  const replacement = `<${parsed.prefix}cellXfs${attrs}>${parsed.inner}${additions.join("")}</${parsed.prefix}cellXfs>`;
  return { stylesXml: stylesXml.replace(parsed.full, replacement), styleMap: map };
}

export function applyStyleMap(base: number, styleMap?: Map<number, number>) {
  return styleMap?.get(base) ?? base;
}

export function updatePrintArea(workbookXml: string, localSheetId: number, value: string) {
  const re = new RegExp(
    `<((?:[A-Za-z0-9_]+:)?definedName)\\b([^>]*name="_xlnm.Print_Area"[^>]*localSheetId="${localSheetId}"[^>]*)>[\\s\\S]*?<\\/\\1>`,
  );
  const match = workbookXml.match(re);
  if (!match) return workbookXml;
  return workbookXml.replace(match[0], `<${match[1]}${match[2]}>${escapeXml(value)}</${match[1]}>`);
}
