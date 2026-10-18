import { getZipEntryText, readZip, writeZip } from "@/lib/ooxml/zip";
import { escapeXml } from "@/lib/ooxml/xml";

/**
 * Comprobación de que un anexo generado conserva el texto de su plantilla (D-098).
 * Una casilla marcada (☒) equivale a la de la plantilla (☐) y los huecos de relleno
 * («____», fechas en blanco) pueden sustituirse por el dato; el resto de palabras de la
 * plantilla debe seguir en la celda y en el mismo orden.
 */
const FILL_GAPS = /_+/g;

function templateWords(text: string) {
  return (text.replace(/☒/g, "☐").replace(FILL_GAPS, " ").match(/[^\s☐]+|☐/g) ?? []).filter((word) => word.replace(/[/()]/g, ""));
}

export function missingTemplateWords(templateText: string, outputText: string) {
  const output = templateWords(outputText);
  const missing: string[] = [];
  let position = 0;
  for (const word of templateWords(templateText)) {
    const found = output.indexOf(word, position);
    if (found === -1) missing.push(word);
    else position = found + 1;
  }
  return missing;
}

/** Texto de cada celda de cada tabla, contando también las celdas envueltas en controles de contenido. */
export function docxCellTexts(docx: Buffer | Uint8Array) {
  return documentCellTexts(getZipEntryText(readZip(Buffer.from(docx)), "word/document.xml"));
}

export function documentCellTexts(xml: string) {
  return [...xml.matchAll(/<w:tbl(?:\s[^>]*)?>([\s\S]*?)<\/w:tbl>/g)].map((table) =>
    [...table[1].matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)].map((row) =>
      [...row[1].matchAll(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g)].map((cell) =>
        [...cell[1].matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)]
          .map((paragraph) => [...paragraph[1].matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>/g)].map((t) => t[1] ?? "\t").join(""))
          .join("\n"),
      ),
    ),
  );
}

export type SyntheticCell = string | { text: string; sdt?: boolean };

/**
 * DOCX sintético con la rejilla de tablas indicada y, en las celdas dadas («fila.celda»),
 * el texto literal de la plantilla oficial. Sirve para probar generadores sin versionar
 * las plantillas reales.
 */
export function syntheticDocx(tables: Array<{ rows: number; cells: number; text?: Record<string, SyntheticCell> }>) {
  const paragraphs = (text: string) =>
    text.split("\n").map((line) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`).join("") || "<w:p/>";
  const cell = (value: SyntheticCell | undefined) => {
    const spec = typeof value === "string" ? { text: value } : value ?? { text: "" };
    const tc = `<w:tc><w:tcPr/>${paragraphs(spec.text)}</w:tc>`;
    return spec.sdt ? `<w:sdt><w:sdtPr/><w:sdtContent>${tc}</w:sdtContent></w:sdt>` : tc;
  };
  const body = tables
    .map(({ rows, cells, text = {} }) =>
      `<w:tbl>${Array.from({ length: rows }, (_, r) => `<w:tr>${Array.from({ length: cells }, (_, c) => cell(text[`${r}.${c}`])).join("")}</w:tr>`).join("")}</w:tbl>`,
    )
    .join("<w:p/>");
  return writeZip([
    {
      name: "word/document.xml",
      data: Buffer.from(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`),
    },
  ]);
}
