import { bulletText, isBulletLine } from "@/lib/forms/bullets";

export function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/**
 * Tipografía de los datos que la aplicación escribe en los anexos Word: Arial 11. Se respeta el
 * resto del formato de la plantilla (color, negrita, subrayado…) y el orden de elementos de
 * `w:rPr` que exige Word.
 */
const VALUE_FONT = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>';
const VALUE_SIZE = '<w:sz w:val="22"/><w:szCs w:val="22"/>';
const AFTER_SIZE = /<w:(?:highlight|u|effect|bdr|shd|fitText|vertAlign|rtl|cs|em|lang|eastAsianLayout|specVanish|oMath|rPrChange)\b/;

export function annexValueRunProperties(rPr = "") {
  let inner = rPr.replace(/^<w:rPr(?:\s[^>]*)?>/, "").replace(/<\/w:rPr>$/, "").replace(/^<w:rPr\s*\/>$/, "");
  inner = inner.replace(/<w:rFonts\b[^>]*\/>|<w:sz\b[^>]*\/>|<w:szCs\b[^>]*\/>/g, "");
  const style = inner.match(/^<w:rStyle\b[^>]*\/>/)?.[0] ?? "";
  inner = inner.slice(style.length);
  const at = inner.search(AFTER_SIZE);
  inner = at < 0 ? inner + VALUE_SIZE : inner.slice(0, at) + VALUE_SIZE + inner.slice(at);
  return `<w:rPr>${style}${VALUE_FONT}${inner}</w:rPr>`;
}

const VALUE_START = "\uE000", VALUE_END = "\uE001";

/** Marca un dato escrito dentro del texto de una etiqueta («Cantidad ____»); ver `applyValueMarks`. */
export function markValue(text: string) {
  return VALUE_START + text + VALUE_END;
}

/** `markValue` línea a línea, para textos que se escriben como un párrafo por línea. */
export function markValueLines(text: string) {
  return text.split(/\r?\n/).map((line) => (line ? markValue(line) : line)).join("\n");
}

/** Separa cada dato marcado con `markValue` en su propio run con la tipografía de los datos. */
export function applyValueMarks(documentXml: string) {
  if (!documentXml.includes(VALUE_START)) return documentXml;
  return documentXml.replace(/<w:r(\s[^>]*)?>((?:(?!<\/w:r>)[\s\S])*?)<\/w:r>/g, (run, attrs: string | undefined, inner: string) => {
    if (!inner.includes(VALUE_START)) return run;
    const open = `<w:r${attrs ?? ""}>`;
    const rPr = inner.match(/^<w:rPr\b[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
    const valuePr = annexValueRunProperties(rPr);
    const runs: string[] = [];
    let label = "";
    const flush = () => {
      if (label) runs.push(`${open}${rPr}${label}</w:r>`);
      label = "";
    };
    for (const piece of inner.slice(rPr.length).split(/(<w:t(?:\s[^>]*)?>[^<]*<\/w:t>)/)) {
      const text = piece.match(/^<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>$/)?.[1];
      if (text === undefined || !text.includes(VALUE_START)) {
        label += piece;
        continue;
      }
      for (const part of text.split(/(\uE000[^\uE001]*\uE001)/)) {
        if (!part) continue;
        if (part.startsWith(VALUE_START)) {
          flush();
          runs.push(`${open}${valuePr}<w:t xml:space="preserve">${part.slice(1, -1)}</w:t></w:r>`);
        } else label += `<w:t xml:space="preserve">${part}</w:t>`;
      }
    }
    flush();
    return runs.join("");
  });
}

function transformNth(source: string, regex: RegExp, index: number, transform: (value: string) => string) {
  let seen = 0;
  let found = false;
  const result = source.replace(regex, (match) => {
    if (seen === index) {
      found = true;
      seen += 1;
      return transform(match);
    }
    seen += 1;
    return match;
  });
  if (!found) throw new Error(`OOXML block index not found: ${index}`);
  return result;
}

/**
 * Un párrafo de dato. D-126: una línea «• texto» se escribe como viñeta con sangría francesa, para que
 * el texto que pasa de línea quede alineado; las demás líneas no cambian.
 */
function valueParagraph(line: string, rPr: string, jc = "") {
  if (!isBulletLine(line)) {
    return `<w:p>${jc ? `<w:pPr>${jc}</w:pPr>` : ""}<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`;
  }
  return `<w:p>${withHangingIndent(jc ? `<w:pPr>${jc}</w:pPr>` : "")}${bulletRun(line, rPr)}</w:p>`;
}

const BULLET_INDENT = '<w:ind w:left="284" w:hanging="284"/>';

/** Sangría francesa de la viñeta, en su sitio dentro de w:pPr (CT_PPr: w:ind va antes de w:jc, w:rPr…). */
function withHangingIndent(pPr: string) {
  if (!pPr) return `<w:pPr>${BULLET_INDENT}</w:pPr>`;
  const rest = pPr.replace(/<w:ind\b[^>]*\/>/g, "");
  const after = rest.search(/<w:(?:contextualSpacing|mirrorIndents|suppressOverlap|jc|textDirection|textAlignment|textboxTightWrap|outlineLvl|divId|cnfStyle|rPr|sectPr|pPrChange)\b|<\/w:pPr>/);
  return rest.slice(0, after) + BULLET_INDENT + rest.slice(after);
}

/** «•», tabulación hasta la sangría y el texto de la viñeta. */
function bulletRun(line: string, rPr: string) {
  return `<w:r>${rPr}<w:t>•</w:t><w:tab/><w:t xml:space="preserve">${escapeXml(bulletText(line))}</w:t></w:r>`;
}

function paragraphXml(text: string) {
  return text
    .split(/\r?\n/)
    .map((part) => valueParagraph(part, annexValueRunProperties()))
    .join("");
}

function setCellText(cellXml: string, text: string) {
  const tcPr = cellXml.match(/<w:tcPr[\s\S]*?<\/w:tcPr>/)?.[0] ?? "";
  return cellXml.replace(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/, (cell) => {
    const open = cell.match(/^<w:tc(?:\s[^>]*)?>/)?.[0] ?? "<w:tc>";
    return `${open}${tcPr}${paragraphXml(text)}</w:tc>`;
  });
}

export function transformWordCell(
  documentXml: string,
  tableIndex: number,
  rowIndex: number,
  cellIndex: number,
  transform: (cellXml: string) => string,
) {
  return transformNth(documentXml, /<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, tableIndex, (table) =>
    transformNth(table, /<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, rowIndex, (row) =>
      transformNth(row, /<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g, cellIndex, transform),
    ),
  );
}

export function setWordCellText(documentXml: string, table: number, row: number, cell: number, text: string) {
  return transformWordCell(documentXml, table, row, cell, (xml) => setCellText(xml, text));
}

function variableParagraphXml(text: string) {
  return text
    .split(/\r?\n/)
    .map((part) => valueParagraph(part, annexValueRunProperties(), '<w:jc w:val="both"/>'))
    .join("");
}

function variableCellFill(cellXml: string) {
  return cellXml.match(/<w:shd\b[^>]*w:fill="([^"]+)"/)?.[1]?.toUpperCase() ?? null;
}

function assertVariableCell(cellXml: string) {
  const fill = variableCellFill(cellXml);
  if (fill && fill !== "FFFFFF" && fill !== "AUTO") {
    throw new Error(`Refusing to write variable content into shaded Word cell (${fill}).`);
  }
}

function setVariableCellText(cellXml: string, text: string) {
  assertVariableCell(cellXml);
  const tcPr = cellXml.match(/<w:tcPr[\s\S]*?<\/w:tcPr>/)?.[0] ?? "";
  const open = cellXml.match(/^<w:tc(?:\s[^>]*)?>/)?.[0] ?? "<w:tc>";
  return `${open}${tcPr}${variableParagraphXml(text)}</w:tc>`;
}

export function setWordVariableCellText(
  documentXml: string,
  table: number,
  row: number,
  cell: number,
  text: string,
) {
  return transformWordCell(documentXml, table, row, cell, (xml) =>
    setVariableCellText(xml, text),
  );
}

export function appendWordVariableCellText(
  documentXml: string,
  table: number,
  row: number,
  cell: number,
  text: string,
) {
  if (!text) return documentXml;
  return transformWordCell(documentXml, table, row, cell, (xml) => {
    assertVariableCell(xml);
    return xml.replace("</w:tc>", `${variableParagraphXml(text)}</w:tc>`);
  });
}


export function setWordSdtCheckbox(
  documentXml: string,
  tableIndex: number,
  rowIndex: number,
  checkboxIndex: number,
  checked: boolean,
) {
  return transformNth(documentXml, /<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, tableIndex, (table) =>
    transformNth(table, /<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, rowIndex, (row) => {
      let seen = 0;
      let found = false;
      const updated = row.replace(/<w:sdt(?:\s[^>]*)?>[\s\S]*?<\/w:sdt>/g, (sdt) => {
        if (!sdt.includes("<w14:checkbox")) return sdt;
        if (seen++ !== checkboxIndex) return sdt;
        found = true;
        const val = checked ? "1" : "0";
        const glyph = checked ? "☒" : "☐";
        return sdt
          .replace(/(<w14:checked\b[^>]*w14:val=")[^"]*("[^>]*\/>)/, `$1${val}$2`)
          .replace(/[☐☒]/, glyph);
      });
      if (!found) throw new Error(`Word checkbox not found at table ${tableIndex}, row ${rowIndex}, index ${checkboxIndex}`);
      return updated;
    }),
  );
}
export function markFirstCheckbox(documentXml: string, table: number, row: number, cell: number, checked: boolean) {
  return transformWordCell(documentXml, table, row, cell, (xml) => {
    if (!checked) return xml;
    return xml.replace("☐", "☒");
  });
}

export function setTriStateCell(documentXml: string, table: number, row: number, cell: number, value?: string | null) {
  const text =
    value === "YES" ? "☒ Si   ☐ No   ☐ N.A." :
    value === "NO" ? "☐ Si   ☒ No   ☐ N.A." :
    value === "NA" ? "☐ Si   ☐ No   ☒ N.A." :
    "☐ Si   ☐ No   ☐ N.A.";
  return setWordCellText(documentXml, table, row, cell, text);
}

function setCellTextInRow(rowXml: string, cellIndex: number, text: string) {
  return transformNth(rowXml, /<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g, cellIndex, (cell) => setCellText(cell, text));
}

export function replaceWordRowWithCopies(
  documentXml: string,
  tableIndex: number,
  rowIndex: number,
  rows: string[][],
) {
  return transformNth(documentXml, /<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, tableIndex, (table) =>
    transformNth(table, /<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, rowIndex, (templateRow) => {
      if (!rows.length) return templateRow;
      return rows
        .map((values) => values.reduce((rowXml, value, cell) => setCellTextInRow(rowXml, cell, value), templateRow))
        .join("");
    }),
  );
}

function setVariableCellTextInRow(rowXml: string, cellIndex: number, text: string) {
  return transformNth(
    rowXml,
    /<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g,
    cellIndex,
    (cell) => setVariableCellText(cell, text),
  );
}

export function replaceWordRowWithVariableCopies(
  documentXml: string,
  tableIndex: number,
  rowIndex: number,
  rows: string[][],
) {
  return transformNth(documentXml, /<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, tableIndex, (table) =>
    transformNth(table, /<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, rowIndex, (templateRow) => {
      if (!rows.length) return templateRow;
      return rows
        .map((values) =>
          values.reduce(
            (rowXml, value, cell) => setVariableCellTextInRow(rowXml, cell, value),
            templateRow,
          ),
        )
        .join("");
    }),
  );
}

export function appendWordCellText(documentXml: string, table: number, row: number, cell: number, text: string) {
  return transformWordCell(documentXml, table, row, cell, (xml) =>
    xml.replace("</w:tc>", `${paragraphXml(text)}</w:tc>`),
  );
}

export function setXlsxCell(sheetXml: string, ref: string, value: string | number | null) {
  const regex = new RegExp(`<c([^>]*\\br="${ref}"[^>]*)>([\\s\\S]*?)<\\/c>|<c([^>]*\\br="${ref}"[^>]*)\\s*\\/>`, "g");
  let found = false;
  const updated = sheetXml.replace(regex, (match, attrs1, _inner, attrs2) => {
    found = true;
    const attrs = String(attrs1 ?? attrs2 ?? "").replace(/\s+t="[^"]*"/g, "");
    if (value === null || value === "") return `<c${attrs}></c>`;
    if (typeof value === "number") return `<c${attrs}><v>${value}</v></c>`;
    return `<c${attrs} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
  });
  if (!found) throw new Error(`XLSX template cell not found: ${ref}`);
  return updated;
}


type XmlBlock = { start: number; end: number; xml: string };

function balancedBlocks(source: string, tag: "w:tbl" | "w:tr" | "w:tc"): XmlBlock[] {
  const escaped = tag.replace(":", "\\:");
  const token = new RegExp(`<${escaped}(?:\\s[^>]*)?>|<\\/${escaped}>`, "g");
  const stack: number[] = [];
  const blocks: XmlBlock[] = [];
  let match: RegExpExecArray | null;
  while ((match = token.exec(source))) {
    if (match[0].startsWith("</")) {
      const start = stack.pop();
      if (start === undefined) throw new Error(`Malformed OOXML: unexpected closing ${tag}`);
      blocks.push({ start, end: token.lastIndex, xml: source.slice(start, token.lastIndex) });
    } else {
      stack.push(match.index);
    }
  }
  if (stack.length) throw new Error(`Malformed OOXML: unclosed ${tag}`);
  return blocks.sort((a, b) => a.start - b.start);
}

function transformBalanced(
  source: string,
  tag: "w:tbl" | "w:tr" | "w:tc",
  index: number,
  transform: (xml: string) => string,
) {
  const blocks = balancedBlocks(source, tag);
  const block = blocks[index];
  if (!block) throw new Error(`OOXML balanced block not found: ${tag}[${index}]`);
  return source.slice(0, block.start) + transform(block.xml) + source.slice(block.end);
}

function directTableRows(tableXml: string): XmlBlock[] {
  const tableBlocks = balancedBlocks(tableXml, "w:tbl");
  const nestedTables = tableBlocks.filter((block) => block.start > 0);
  return balancedBlocks(tableXml, "w:tr").filter(
    (row) => !nestedTables.some((table) => row.start > table.start && row.end < table.end),
  );
}

function directRowCells(rowXml: string): XmlBlock[] {
  const nestedTables = balancedBlocks(rowXml, "w:tbl");
  return balancedBlocks(rowXml, "w:tc").filter(
    (cell) => !nestedTables.some((table) => cell.start > table.start && cell.end < table.end),
  );
}

function paragraphXmlWithColor(text: string, color?: string) {
  return text
    .split(/\r?\n/)
    .map((part) => valueParagraph(part, annexValueRunProperties(color ? `<w:color w:val="${escapeXml(color)}"/>` : "")))
    .join("");
}

function setCellTextBalanced(cellXml: string, text: string, color?: string) {
  const tcPr = cellXml.match(/<w:tcPr[\s\S]*?<\/w:tcPr>/)?.[0] ?? "";
  const open = cellXml.match(/^<w:tc(?:\s[^>]*)?>/)?.[0] ?? "<w:tc>";
  return `${open}${tcPr}${paragraphXmlWithColor(text, color)}</w:tc>`;
}

function setDirectCell(rowXml: string, cellIndex: number, text: string, color?: string) {
  const cells = directRowCells(rowXml);
  const cell = cells[cellIndex];
  if (!cell) throw new Error(`Direct Word cell not found: ${cellIndex}`);
  return rowXml.slice(0, cell.start) +
    setCellTextBalanced(cell.xml, text, color) +
    rowXml.slice(cell.end);
}

/**
 * Tablas de primer nivel de un documento (las que no están dentro de otra tabla), con el XML de cada casilla
 * directa de cada fila. Una tabla insertada en una casilla queda dentro del XML de esa casilla.
 */
export function wordTableGrid(documentXml: string): string[][][] {
  const tables = balancedBlocks(documentXml, "w:tbl");
  return tables
    .filter((table) => !tables.some((outer) => outer !== table && table.start > outer.start && table.end < outer.end))
    .map((table) => directTableRows(table.xml).map((row) => directRowCells(row.xml).map((cell) => cell.xml)));
}

export function transformWordTableBalanced(
  documentXml: string,
  tableIndex: number,
  transform: (tableXml: string) => string,
) {
  return transformBalanced(documentXml, "w:tbl", tableIndex, transform);
}

export function setWordCellTextBalanced(
  documentXml: string,
  tableIndex: number,
  rowIndex: number,
  cellIndex: number,
  text: string,
  color?: string,
) {
  return transformWordTableBalanced(documentXml, tableIndex, (tableXml) => {
    const rows = directTableRows(tableXml);
    const row = rows[rowIndex];
    if (!row) throw new Error(`Direct Word row not found: table ${tableIndex}, row ${rowIndex}`);
    const updatedRow = setDirectCell(row.xml, cellIndex, text, color);
    return tableXml.slice(0, row.start) + updatedRow + tableXml.slice(row.end);
  });
}

export function replaceWordRowsRangeBalanced(
  documentXml: string,
  tableIndex: number,
  startRow: number,
  endRow: number,
  buildRows: (templates: { first: string; second: string }) => string[],
) {
  return transformWordTableBalanced(documentXml, tableIndex, (tableXml) => {
    const rows = directTableRows(tableXml);
    const first = rows[startRow];
    const second = rows[startRow + 1];
    const last = rows[endRow];
    if (!first || !second || !last) {
      throw new Error(`Word row range not found: table ${tableIndex}, rows ${startRow}-${endRow}`);
    }
    const output = buildRows({ first: first.xml, second: second.xml }).join("");
    return tableXml.slice(0, first.start) + output + tableXml.slice(last.end);
  });
}

/** Rewrites the rows startRow..endRow (inclusive) of a table from their current XML. */
export function transformWordRowsBalanced(
  documentXml: string,
  tableIndex: number,
  startRow: number,
  endRow: number,
  build: (rows: string[]) => string[],
) {
  return transformWordTableBalanced(documentXml, tableIndex, (tableXml) => {
    const rows = directTableRows(tableXml).slice(startRow, endRow + 1);
    if (rows.length !== endRow - startRow + 1) throw new Error(`Word row range not found: table ${tableIndex}, rows ${startRow}-${endRow}`);
    return tableXml.slice(0, rows[0].start) + build(rows.map((row) => row.xml)).join("") + tableXml.slice(rows.at(-1)!.end);
  });
}

export function fillWordRowBalanced(
  rowXml: string,
  values: Array<{ text: string; color?: string }>,
) {
  return values.reduce(
    (current, value, index) => setDirectCell(current, index, value.text, value.color),
    rowXml,
  );
}


export function appendWordCellTextBalanced(
  documentXml: string,
  tableIndex: number,
  rowIndex: number,
  cellIndex: number,
  text: string,
  color?: string,
) {
  return transformWordTableBalanced(documentXml, tableIndex, (tableXml) => {
    const rows = directTableRows(tableXml);
    const row = rows[rowIndex];
    if (!row) throw new Error(`Direct Word row not found: table ${tableIndex}, row ${rowIndex}`);
    const cells = directRowCells(row.xml);
    const cell = cells[cellIndex];
    if (!cell) throw new Error(`Direct Word cell not found: ${cellIndex}`);
    const addition = paragraphXmlWithColor(text, color);
    const updatedCell = cell.xml.replace("</w:tc>", `${addition}</w:tc>`);
    const updatedRow = row.xml.slice(0, cell.start) + updatedCell + row.xml.slice(cell.end);
    return tableXml.slice(0, row.start) + updatedRow + tableXml.slice(row.end);
  });
}

export type WordCellFillOptions = {
  /** "inline": in the cell's last paragraph, after any label. "paragraphs": new paragraphs below the existing content. */
  mode?: "inline" | "paragraphs";
  /** Drops the template's guidance runs (e.g. a grey «fecha») before writing the value. */
  replaceHint?: boolean;
  /** Cell background, e.g. a status colour required by the controlled template. */
  shade?: string;
};

/** Value typography comes from the paragraph mark, without the label's emphasis or the hint colour. */
function valueRunProperties(paragraphXml: string) {
  const markRPr = paragraphXml.match(/<w:pPr\b[\s\S]*?<\/w:pPr>/)?.[0].match(/<w:rPr\b[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
  return annexValueRunProperties(markRPr.replace(/<w:(?:b|bCs|i|iCs|color)\b[^>]*\/>/g, ""));
}

function valueRun(text: string, rPr: string) {
  const lines = text.split(/\r?\n/).map((line) => `<w:t xml:space="preserve">${escapeXml(line)}</w:t>`);
  return `<w:r>${rPr}${lines.join("<w:br/>")}</w:r>`;
}

function fillCellPreservingTemplate(cellXml: string, text: string, options: WordCellFillOptions) {
  let cell = cellXml;
  if (options.shade) {
    const shd = `<w:shd w:val="clear" w:color="auto" w:fill="${escapeXml(options.shade)}"/>`;
    cell = /<w:tcPr\b[\s\S]*?<\/w:tcPr>/.test(cell)
      ? cell.replace(/<w:tcPr\b[\s\S]*?<\/w:tcPr>/, (tcPr) => /<w:shd\b[^>]*\/>/.test(tcPr) ? tcPr.replace(/<w:shd\b[^>]*\/>/, shd) : tcPr.replace("</w:tcPr>", `${shd}</w:tcPr>`))
      : cell.replace(/^<w:tc(?:\s[^>]*)?>/, (open) => `${open}<w:tcPr>${shd}</w:tcPr>`);
  }
  if (!text) return cell;
  if (options.replaceHint) cell = cell.replace(/<w:r\b[\s\S]*?<\/w:r>|<w:proofErr\b[^>]*\/>/g, "");
  cell = cell.replace(/<w:p(\s[^>]*)?\/>/g, "<w:p$1></w:p>");
  const paragraphs = [...cell.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)];
  const last = paragraphs.at(-1);
  if (!last || last.index === undefined) throw new Error("Word template cell without paragraph.");
  const hasText = (paragraph: string) => /<w:t(?:\s[^>]*)?>[^<]*\S/.test(paragraph);
  if (options.mode === "paragraphs") {
    // Below the guidance text, or at the top of an empty block, left-aligned like free text.
    const guidance = paragraphs.filter((paragraph) => hasText(paragraph[0])).at(-1);
    const anchor = guidance ?? paragraphs[0];
    const pPr = (anchor[0].match(/<w:pPr\b[\s\S]*?<\/w:pPr>/)?.[0] ?? "").replace(/<w:jc\b[^>]*\/>/, "");
    const rPr = valueRunProperties(anchor[0]);
    const at = guidance ? anchor.index! + anchor[0].length : anchor.index!;
    const added = text
      .split(/\r?\n/)
      .map((line) => (isBulletLine(line) ? `<w:p>${withHangingIndent(pPr)}${bulletRun(line, rPr)}</w:p>` : `<w:p>${pPr}${valueRun(line, rPr)}</w:p>`))
      .join("");
    return cell.slice(0, at) + added + cell.slice(at);
  }
  const rPr = valueRunProperties(last[0]);
  const end = last.index + last[0].length;
  const labelled = hasText(last[0]);
  const close = end - "</w:p>".length;
  return cell.slice(0, close) + valueRun(labelled ? ` ${text}` : text, rPr) + cell.slice(close);
}

/** Fills a controlled template cell without redesigning it: cell properties, labels and paragraph formatting stay. */
export function fillWordCellBalanced(
  documentXml: string,
  tableIndex: number,
  rowIndex: number,
  cellIndex: number,
  text: string,
  options: WordCellFillOptions = {},
) {
  return transformWordTableBalanced(documentXml, tableIndex, (tableXml) => {
    const rows = directTableRows(tableXml);
    const row = rows[rowIndex];
    if (!row) throw new Error(`Direct Word row not found: table ${tableIndex}, row ${rowIndex}`);
    const updatedRow = fillWordRowCellsBalanced(row.xml, { [cellIndex]: text }, options);
    return tableXml.slice(0, row.start) + updatedRow + tableXml.slice(row.end);
  });
}

/** Row variant of fillWordCellBalanced, for listing rows cloned from the template. */
export function fillWordRowCellsBalanced(rowXml: string, values: Record<number, string>, options: WordCellFillOptions = {}) {
  const cells = directRowCells(rowXml);
  let output = "";
  let cursor = 0;
  cells.forEach((cell, index) => {
    output += rowXml.slice(cursor, cell.start);
    output += index in values || options.shade ? fillCellPreservingTemplate(cell.xml, values[index] ?? "", options) : cell.xml;
    cursor = cell.end;
  });
  for (const index of Object.keys(values).map(Number)) {
    if (!cells[index]) throw new Error(`Direct Word cell not found: ${index}`);
  }
  return output + rowXml.slice(cursor);
}

type BodyChild = { start: number; end: number; xml: string; text: string };

function decodeBasicXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function visibleWordText(xml: string) {
  return decodeBasicXml(
    [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map((match) => match[1])
      .join(" "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function directBodyChildren(documentXml: string): BodyChild[] {
  const bodyOpen = documentXml.match(/<w:body(?:\s[^>]*)?>/);
  if (!bodyOpen || bodyOpen.index === undefined) throw new Error("Word body not found.");
  const bodyStart = bodyOpen.index + bodyOpen[0].length;
  const bodyEnd = documentXml.indexOf("</w:body>", bodyStart);
  if (bodyEnd < 0) throw new Error("Word body closing tag not found.");
  const inner = documentXml.slice(bodyStart, bodyEnd);
  const tagRe = /<\/?[A-Za-z0-9:_-]+(?:\s[^<>]*?)?\/?>/g;
  const children: BodyChild[] = [];
  let depth = 0;
  let childStart = -1;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(inner))) {
    const token = match[0];
    const closing = token.startsWith("</");
    const selfClosing = token.endsWith("/>");
    if (!closing && depth === 0) childStart = match.index;
    if (closing) {
      depth -= 1;
      if (depth === 0 && childStart >= 0) {
        const end = tagRe.lastIndex;
        const xml = inner.slice(childStart, end);
        children.push({ start: bodyStart + childStart, end: bodyStart + end, xml, text: visibleWordText(xml) });
        childStart = -1;
      }
    } else if (!selfClosing) {
      depth += 1;
    } else if (depth === 0) {
      const end = tagRe.lastIndex;
      const xml = inner.slice(match.index, end);
      children.push({ start: bodyStart + match.index, end: bodyStart + end, xml, text: visibleWordText(xml) });
    }
  }
  return children;
}

export function extractWordBodyRange(
  documentXml: string,
  startMarker: string,
  endMarker?: string,
  startOccurrence: "first" | "last" = "last",
) {
  const children = directBodyChildren(documentXml);
  const matchingStarts = children
    .map((child, index) => ({ child, index }))
    .filter(({ child }) => child.text.includes(startMarker));
  const selected =
    startOccurrence === "last" ? matchingStarts.at(-1) : matchingStarts[0];
  if (!selected) throw new Error(`Word annex start marker not found: ${startMarker}`);
  let endIndex = children.length;
  if (endMarker) {
    const found = children.findIndex(
      (child, index) => index > selected.index && child.text.includes(endMarker),
    );
    if (found >= 0) endIndex = found;
  }
  const bodyOpen = documentXml.match(/<w:body(?:\s[^>]*)?>/);
  if (!bodyOpen || bodyOpen.index === undefined) throw new Error("Word body not found.");
  const bodyEnd = documentXml.indexOf("</w:body>", bodyOpen.index);
  const sectPr = [...children]
    .reverse()
    .find((child) => /^<w:sectPr\b/.test(child.xml))?.xml ?? "";
  const selectedXml = children
    .slice(selected.index, endIndex)
    .filter((child) => !/^<w:sectPr\b/.test(child.xml))
    .map((child) => child.xml)
    .join("");
  const openEnd = bodyOpen.index + bodyOpen[0].length;
  return (
    documentXml.slice(0, openEnd) +
    selectedXml +
    sectPr +
    documentXml.slice(bodyEnd)
  );
}


/** D-127: tabla de un texto largo, para la casilla de su apartado (sin estilos de la plantilla). */
type CellTable = { number: number; table: { title: string; columns: string[]; rows: string[][] } };

function tableCellXml(text: string, width: number | null, header: boolean) {
  const rPr = annexValueRunProperties(header ? "<w:rPr><w:b/></w:rPr>" : "");
  const paragraphs = text.split(/\r?\n/).map((line) => `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r>${rPr}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`).join("");
  const tcW = width === null ? "" : `<w:tcW w:w="${width}" w:type="dxa"/>`;
  return `<w:tc>${tcW ? `<w:tcPr>${tcW}</w:tcPr>` : ""}${paragraphs}</w:tc>`;
}

/** `available`: ancho útil de la casilla en twips; null si la plantilla no lo da en dxa (la tabla ocupa el 100 %). */
function cellTableXml({ number, table }: CellTable, available: number | null) {
  const width = available === null ? null : Math.floor(available / table.columns.length);
  const border = (side: string) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="auto"/>`;
  const row = (cells: string[], header: boolean) =>
    `<w:tr><w:trPr><w:cantSplit/>${header ? "<w:tblHeader/>" : ""}</w:trPr>${cells.map((cell) => tableCellXml(cell, width, header)).join("")}</w:tr>`;
  const caption = `<w:p><w:pPr><w:keepNext/><w:spacing w:before="120" w:after="60"/></w:pPr><w:r>${annexValueRunProperties("<w:rPr><w:b/></w:rPr>")}<w:t xml:space="preserve">${escapeXml(`Tabla ${number}. ${table.title}`)}</w:t></w:r></w:p>`;
  const tblW = width === null ? '<w:tblW w:w="5000" w:type="pct"/>' : `<w:tblW w:w="${width * table.columns.length}" w:type="dxa"/>`;
  return caption +
    `<w:tbl><w:tblPr>${tblW}<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(border).join("")}</w:tblBorders>` +
    `${width === null ? "" : '<w:tblLayout w:type="fixed"/>'}<w:tblCellMar><w:left w:w="57" w:type="dxa"/><w:right w:w="57" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
    `<w:tblGrid>${table.columns.map(() => `<w:gridCol w:w="${width ?? Math.floor(9000 / table.columns.length)}"/>`).join("")}</w:tblGrid>` +
    row(table.columns, true) + table.rows.map((cells) => row(cells, false)).join("") +
    // Una casilla de Word debe terminar en párrafo: uno mínimo tras la tabla.
    `</w:tbl><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="120" w:lineRule="exact"/></w:pPr></w:p>`;
}

/** Ancho útil (twips) de una casilla de la plantilla, o null si no lo indica en dxa. */
function cellAvailableWidth(cellXml: string) {
  const tcW = cellXml.match(/<w:tcW\b[^>]*\/>/)?.[0] ?? "";
  if (!/w:type="dxa"/.test(tcW)) return null;
  const width = Number(tcW.match(/w:w="(\d+)"/)?.[1]);
  return Number.isFinite(width) && width > 0 ? Math.max(1000, width - 216) : null;
}

/**
 * D-127: añade las tablas de cada apartado al final de su casilla, después del texto. Se llama al final
 * de rellenar la plantilla: inserta de la última casilla a la primera para que una tabla añadida no
 * desplace los índices de las tablas de la plantilla que quedan por tratar.
 */
export function insertWordCellTables(
  documentXml: string,
  placements: Array<{ table: number; row: number; cell: number; tables: CellTable[] }>,
) {
  const ordered = placements
    .filter((placement) => placement.tables.length)
    .sort((a, b) => b.table - a.table || b.row - a.row || b.cell - a.cell);
  let xml = documentXml;
  for (const placement of ordered) {
    xml = transformWordTableBalanced(xml, placement.table, (tableXml) => {
      const row = directTableRows(tableXml)[placement.row];
      if (!row) throw new Error(`Direct Word row not found: table ${placement.table}, row ${placement.row}`);
      const cell = directRowCells(row.xml)[placement.cell];
      if (!cell) throw new Error(`Direct Word cell not found: ${placement.cell}`);
      const available = cellAvailableWidth(cell.xml);
      const updatedCell = cell.xml.slice(0, -"</w:tc>".length) + placement.tables.map((item) => cellTableXml(item, available)).join("") + "</w:tc>";
      const updatedRow = row.xml.slice(0, cell.start) + updatedCell + row.xml.slice(cell.end);
      return tableXml.slice(0, row.start) + updatedRow + tableXml.slice(row.end);
    });
  }
  return xml;
}
