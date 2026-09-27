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
  return transformNth(documentXml, /<w:tbl(?:\\s[^>]*)?>[\\s\\S]*?<\\/w:tbl>/g, tableIndex, (table) =>
    transformNth(table, /<w:tr(?:\\s[^>]*)?>[\\s\\S]*?<\\/w:tr>/g, rowIndex, (row) => {
      let seen = 0;
      let found = false;
      const updated = row.replace(/<w:sdt(?:\\s[^>]*)?>[\\s\\S]*?<\\/w:sdt>/g, (sdt) => {
        if (!sdt.includes("<w14:checkbox")) return sdt;
        if (seen++ !== checkboxIndex) return sdt;
        found = true;
        const val = checked ? "1" : "0";
        const glyph = checked ? "☒" : "☐";
        return sdt
          .replace(/(<w14:checked\\b[^>]*w14:val=")[^"]*("[^>]*\\/>)/, `$1${val}$2`)
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
