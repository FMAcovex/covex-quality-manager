export function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
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

function paragraphXml(text: string) {
  const parts = text.split(/\r?\n/);
  return parts
    .map((part) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(part)}</w:t></w:r></w:p>`)
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
    .map((part) => {
      const rPr = color ? `<w:rPr><w:color w:val="${escapeXml(color)}"/></w:rPr>` : "";
      return `<w:p><w:r>${rPr}<w:t xml:space="preserve">${escapeXml(part)}</w:t></w:r></w:p>`;
    })
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
