import { getZipEntryText, readZip } from "@/lib/ooxml/zip";

export type XlsxCellValue = string | number | null;
export type XlsxRow = { rowNumber: number; cells: Record<string, XlsxCellValue> };

function decodeXml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function textRuns(xml: string) {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map((match) => decodeXml(match[1]))
    .join("");
}

function sharedStrings(entries: ReturnType<typeof readZip>) {
  const entry = entries.find((item) => item.name === "xl/sharedStrings.xml");
  if (!entry) return [];
  return [...entry.data.toString("utf8").matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)]
    .map((match) => textRuns(match[1]));
}

function workbookSheetPath(entries: ReturnType<typeof readZip>, sheetName: string) {
  const workbook = getZipEntryText(entries, "xl/workbook.xml");
  const sheet = [...workbook.matchAll(/<sheet\b([^>]*)\/?\s*>/g)].find((match) => {
    const name = match[1].match(/\bname="([^"]*)"/)?.[1];
    return name && decodeXml(name) === sheetName;
  });
  if (!sheet) throw new Error(`XLSX sheet not found: ${sheetName}`);
  const relationId = sheet[1].match(/\br:id="([^"]+)"/)?.[1];
  if (!relationId) throw new Error(`Relationship missing for sheet: ${sheetName}`);

  const rels = getZipEntryText(entries, "xl/_rels/workbook.xml.rels");
  const relation = [...rels.matchAll(/<Relationship\b([^>]*)\/?\s*>/g)].find(
    (match) => match[1].match(/\bId="([^"]+)"/)?.[1] === relationId,
  );
  const target = relation?.[1].match(/\bTarget="([^"]+)"/)?.[1];
  if (!target) throw new Error(`Target missing for sheet: ${sheetName}`);
  if (target.startsWith("/")) return target.slice(1);
  return target.startsWith("xl/") ? target : `xl/${target}`;
}

function cellColumn(ref: string) {
  return ref.match(/^([A-Z]+)/)?.[1] ?? ref;
}

function parseCell(xml: string, attrs: string, strings: string[]): XlsxCellValue {
  const type = attrs.match(/\bt="([^"]+)"/)?.[1] ?? "";
  if (type === "inlineStr") return textRuns(xml);
  const raw = xml.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1];
  if (raw === undefined) return null;
  const decoded = decodeXml(raw);
  if (type === "s") return strings[Number(decoded)] ?? "";
  if (type === "str") return decoded;
  if (type === "b") return decoded === "1" ? "TRUE" : "FALSE";
  const numeric = Number(decoded);
  return Number.isFinite(numeric) && decoded.trim() !== "" ? numeric : decoded;
}

export function readXlsxSheet(buffer: Buffer, sheetName: string): XlsxRow[] {
  const entries = readZip(buffer);
  const strings = sharedStrings(entries);
  const sheetXml = getZipEntryText(entries, workbookSheetPath(entries, sheetName));
  const rows: XlsxRow[] = [];

  for (const match of sheetXml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(match[1].match(/\br="(\d+)"/)?.[1]);
    if (!Number.isFinite(rowNumber)) continue;
    const cells: Record<string, XlsxCellValue> = {};
    const rowXml = match[2];

    for (const cell of rowXml.matchAll(/<c\b([^>]*\br="([A-Z]+\d+)"[^>]*)\s*\/>|<c\b([^>]*\br="([A-Z]+\d+)"[^>]*)>([\s\S]*?)<\/c>/g)) {
      const selfClosing = Boolean(cell[1]);
      const attrs = selfClosing ? cell[1] : cell[3] ?? "";
      const ref = selfClosing ? cell[2] : cell[4] ?? "";
      cells[cellColumn(ref)] = selfClosing ? null : parseCell(cell[5] ?? "", attrs, strings);
    }
    rows.push({ rowNumber, cells });
  }
  return rows;
}
