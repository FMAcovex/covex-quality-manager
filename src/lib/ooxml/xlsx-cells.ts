import type { ZipEntry } from "@/lib/ooxml/zip";

/**
 * Texto de cada celda con valor de texto de cada hoja de un libro Excel, por nombre de hoja y referencia (A1…).
 * Con `numbers`, también el valor de las celdas numéricas (las fechas, como número de serie de Excel).
 */
export function xlsxCells(entries: ZipEntry[], options: { numbers?: boolean } = {}) {
  const text = (name: string) => {
    const entry = entries.find((item) => item.name === name);
    return entry ? entry.data.toString("utf8") : "";
  };
  const decode = (value: string) => value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  const shared = [...text("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((item) => decode([...item[1].matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map((t) => t[1]).join("")));
  const rels = new Map([...text("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)].map((rel) => [rel[0].match(/\bId="([^"]+)"/)?.[1] ?? "", rel[0].match(/\bTarget="([^"]+)"/)?.[1] ?? ""]));
  const sheets = new Map<string, Map<string, string>>();
  for (const sheet of text("xl/workbook.xml").matchAll(/<sheet\b[^>]*>/g)) {
    const name = decode(sheet[0].match(/\bname="([^"]*)"/)?.[1] ?? "");
    const target = rels.get(sheet[0].match(/\br:id="([^"]+)"/)?.[1] ?? "") ?? "";
    const cells = new Map<string, string>();
    for (const cell of text(`xl/${target.replace(/^\/?xl\//, "")}`).matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = cell[1].match(/\br="([A-Z]+\d+)"/)?.[1];
      if (!ref || !cell[2]) continue;
      const type = cell[1].match(/\bt="([^"]+)"/)?.[1];
      const value = type === "s" ? shared[Number(cell[2].match(/<v>([^<]*)<\/v>/)?.[1])] : type === "inlineStr" ? decode([...cell[2].matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map((t) => t[1]).join("")) : options.numbers ? decode(cell[2].match(/<v>([^<]*)<\/v>/)?.[1] ?? "") : "";
      if (value?.trim()) cells.set(ref, value);
    }
    sheets.set(name, cells);
  }
  return sheets;
}
