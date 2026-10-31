import type { DocumentType, QmsRecordType } from "@prisma/client";
import { documentCellTexts, missingTemplateWords } from "@/lib/ooxml/template-text";
import { getZipEntryText, readZip, type ZipEntry } from "@/lib/ooxml/zip";
import { xlsxCells } from "@/lib/ooxml/xlsx-cells";
import { annexGeneratorView, annexGeneratorXml } from "@/modules/configuration/annex-generator-views";
import { templateCatalog } from "@/modules/configuration/template-catalog";

/**
 * Comprobación de una versión nueva de plantilla antes de activarla (D-100).
 *
 * Los generadores rellenan casillas concretas y escriben etiquetas literales. Una versión nueva
 * solo se puede activar si la aplicación ya la conoce (está en el catálogo con esa huella) o si
 * tiene las mismas tablas, filas, casillas y textos que la versión activa, sin contar códigos,
 * números de revisión ni fechas. Si se quita, mueve o añade un campo, hay que adaptar antes la
 * aplicación.
 */
export type TemplateFile = { versionCode: string; data: Buffer | Uint8Array; fileName?: string | null };

export type TemplateActivationCheck =
  | { status: "supported" }
  | { status: "first" }
  | { status: "compatible"; referenceVersion: string }
  | { status: "incompatible"; referenceVersion: string; differences: string[] };

const MAX_WORDS = 8;
const quote = (words: string[]) => `«${words.slice(0, MAX_WORDS).join(" ")}${words.length > MAX_WORDS ? " …" : ""}»`;

function wordDifferences(where: string, before: string, after: string) {
  const differences: string[] = [];
  const missing = missingTemplateWords(before, after, { ignoreDigits: true });
  const added = missingTemplateWords(after, before, { ignoreDigits: true });
  if (missing.length) differences.push(`${where}: falta ${quote(missing)}`);
  if (added.length) differences.push(`${where}: texto nuevo ${quote(added)}`);
  return differences;
}

const isXlsx = (file: TemplateFile, entries: ZipEntry[]) =>
  file.fileName?.toLowerCase().endsWith(".xlsx") || entries.some((entry) => entry.name === "xl/workbook.xml");

/** Texto de los párrafos del cuerpo que no están dentro de tablas. */
function textOutsideTables(xml: string) {
  const body = xml.slice(xml.indexOf("<w:body"), xml.lastIndexOf("</w:body>"));
  return [...body.replace(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, "").matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)]
    .map((paragraph) => [...paragraph[1].matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((t) => t[1]).join(""))
    .join("\n");
}

function compareWord(documentType: DocumentType, reference: TemplateFile, candidate: TemplateFile, referenceEntries: ZipEntry[], candidateEntries: ZipEntry[]) {
  const before = annexGeneratorXml(documentType, reference.versionCode, getZipEntryText(referenceEntries, "word/document.xml"));
  let after: string;
  try {
    after = annexGeneratorXml(documentType, candidate.versionCode, getZipEntryText(candidateEntries, "word/document.xml"));
  } catch (error) {
    return [`No se encuentra en el documento el anexo que rellena la aplicación (${error instanceof Error ? error.message : String(error)}).`];
  }
  const differences: string[] = [];
  const oldTables = documentCellTexts(before), newTables = documentCellTexts(after);
  if (oldTables.length !== newTables.length) differences.push(`Tiene ${newTables.length} tablas; la versión ${reference.versionCode} tenía ${oldTables.length}.`);
  oldTables.slice(0, newTables.length).forEach((rows, t) => {
    const newRows = newTables[t];
    if (rows.length !== newRows.length) differences.push(`Tabla ${t + 1}: ${newRows.length} filas; antes ${rows.length}.`);
    rows.slice(0, newRows.length).forEach((cells, r) => {
      const newCells = newRows[r];
      if (cells.length !== newCells.length) differences.push(`Tabla ${t + 1}, fila ${r + 1}: ${newCells.length} casillas; antes ${cells.length}.`);
      cells.slice(0, newCells.length).forEach((text, c) => differences.push(...wordDifferences(`Tabla ${t + 1}, fila ${r + 1}, casilla ${c + 1}`, text, newCells[c])));
    });
  });
  differences.push(...wordDifferences("Texto fuera de tablas", textOutsideTables(before), textOutsideTables(after)));
  return differences;
}

function compareExcel(reference: TemplateFile, referenceEntries: ZipEntry[], candidateEntries: ZipEntry[]) {
  const before = xlsxCells(referenceEntries), after = xlsxCells(candidateEntries);
  const differences: string[] = [];
  const oldNames = [...before.keys()], newNames = [...after.keys()];
  if (oldNames.join("|") !== newNames.join("|")) differences.push(`Hojas: ${newNames.map((name) => `«${name}»`).join(", ")}; la versión ${reference.versionCode} tenía ${oldNames.map((name) => `«${name}»`).join(", ")}.`);
  // Los generadores usan las hojas por su posición en el libro.
  oldNames.forEach((name, index) => {
    const cells = before.get(name)!, newCells = index < newNames.length ? after.get(newNames[index])! : new Map<string, string>();
    for (const ref of new Set([...cells.keys(), ...newCells.keys()])) differences.push(...wordDifferences(`Hoja «${name}», celda ${ref}`, cells.get(ref) ?? "", newCells.get(ref) ?? ""));
  });
  return differences;
}

/** Diferencias que afectan al relleno entre la versión de referencia y la candidata. */
export function templateDifferences(documentType: DocumentType, reference: TemplateFile, candidate: TemplateFile) {
  const oldView = annexGeneratorView(documentType, reference.versionCode), newView = annexGeneratorView(documentType, candidate.versionCode);
  if (oldView.mapping !== newView.mapping) {
    return [`La aplicación rellena la versión ${candidate.versionCode} con otro mapeo («${newView.mapping}») que la versión ${reference.versionCode} («${oldView.mapping}»).`];
  }
  let candidateEntries: ZipEntry[];
  try {
    candidateEntries = readZip(Buffer.from(candidate.data));
  } catch { /* Entrada mal formada: se trata como vacía o no válida. */
    return ["El archivo no es un documento Word o Excel válido."];
  }
  const referenceEntries = readZip(Buffer.from(reference.data));
  const referenceIsExcel = isXlsx(reference, referenceEntries);
  if (referenceIsExcel !== isXlsx(candidate, candidateEntries)) return [`El formato no coincide con la versión ${reference.versionCode} (${referenceIsExcel ? "Excel" : "Word"}).`];
  return referenceIsExcel ? compareExcel(reference, referenceEntries, candidateEntries) : compareWord(documentType, reference, candidate, referenceEntries, candidateEntries);
}

/** La aplicación ya conoce esta versión: está en el catálogo con esta misma huella de archivo. */
export function isCatalogSupported(module: QmsRecordType, documentType: DocumentType, versionCode: string, checksum: string | null) {
  return Boolean(checksum) && templateCatalog.some((item) =>
    item.module === module && item.documentType === documentType && item.versionCode === versionCode &&
    item.sources.some((source) => source.kind === "file" && source.sha256 === checksum));
}

export function checkTemplateActivation(input: {
  module: QmsRecordType;
  documentType: DocumentType;
  candidate: TemplateFile & { checksum: string | null };
  reference: TemplateFile | null;
}): TemplateActivationCheck {
  if (isCatalogSupported(input.module, input.documentType, input.candidate.versionCode, input.candidate.checksum)) return { status: "supported" };
  if (!input.reference) return { status: "first" };
  const differences = templateDifferences(input.documentType, input.reference, input.candidate);
  return differences.length
    ? { status: "incompatible", referenceVersion: input.reference.versionCode, differences }
    : { status: "compatible", referenceVersion: input.reference.versionCode };
}
