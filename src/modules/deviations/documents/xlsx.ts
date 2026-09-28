import { readZip, getZipEntryText, updateZipEntry, writeZip, type ZipEntry } from "@/lib/ooxml/zip";
import { escapeXml, setXlsxCell } from "@/lib/ooxml/xml";
import {
  addFillVariants,
  applyStyleMap,
  buildRow,
  renumberRow,
  replaceSheetData,
  rowStyles,
  setSheetDimension,
  sheetRows,
  updatePrintArea,
} from "@/lib/ooxml/xlsx-template";
import { loadAnnexVTemplate } from "@/modules/deviations/documents/templates";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { deadlineLabel, measuresLabel } from "@/modules/deviations/domain";

type ExportRow = {
  qmsRecord: { businessCode: string | null; year: number | null };
  departmentCodeSnapshot: string | null;
  departmentNameSnapshot: string | null;
  materialProcessAffected: string | null;
  provenance: string | null;
  whatHappened: string | null;
  classification: string | null;
  rootCause: string | null;
  issueDate: Date | null;
  closedAt: Date | null;
  status: string;
  deadlineStatus: string;
  internalObservations: string | null;
  signedDocumentAvailable: boolean | null;
  immediateActions: unknown[];
  capaPlans: Array<{
    description: string;
    businessCapaCode: string | null;
    linkedCapaRecord: { businessCode: string | null } | null;
  }>;
};

function classification(value: string | null) {
  return value === "CRITICAL" ? "Crítica" : value === "MAJOR" ? "Mayor" : value === "MINOR" ? "Menor" : "";
}
function date(value: Date | null) {
  return value ? new Intl.DateTimeFormat("es-ES").format(value) : "";
}
function capaCodes(row: ExportRow) {
  return row.capaPlans
    .map((plan) => plan.businessCapaCode || plan.linkedCapaRecord?.businessCode || "")
    .filter(Boolean)
    .join(" · ");
}
function capaDescriptions(row: ExportRow) {
  return row.capaPlans.map((plan) => plan.description).filter(Boolean).join(" · ");
}

function removeCalcChain(entries: ZipEntry[]) {
  const filtered = entries.filter((entry) => entry.name !== "xl/calcChain.xml");
  const contentTypes = getZipEntryText(filtered, "[Content_Types].xml").replace(
    /<Override[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>/g,
    "",
  );
  const rels = getZipEntryText(filtered, "xl/_rels/workbook.xml.rels").replace(
    /<Relationship[^>]*Target="calcChain\.xml"[^>]*\/>/g,
    "",
  );
  updateZipEntry(filtered, "[Content_Types].xml", contentTypes);
  updateZipEntry(filtered, "xl/_rels/workbook.xml.rels", rels);
  return filtered;
}

export async function generateAnnexV(year: number, rows: ExportRow[], versionCode = "06") {
  let entries = readZip(await loadAnnexVTemplate(versionCode));
  let sheet = getZipEntryText(entries, "xl/worksheets/sheet1.xml");
  let stylesXml = getZipEntryText(entries, "xl/styles.xml");
  let workbook = getZipEntryText(entries, "xl/workbook.xml");

  const sourceRows = sheetRows(sheet);
  const dataTemplate = sourceRows.find((item) => item.number === 6)?.xml;
  if (!dataTemplate) throw new Error("Anexo V Desviaciones: fila de datos modelo no encontrada.");
  const templateStyles = rowStyles(dataTemplate);
  const baseStyles = ["A","B","C","D","E","F"].map((column) => templateStyles.get(column) ?? 0);

  const openVariant = addFillVariants(stylesXml, baseStyles, 13);
  stylesXml = openVariant.stylesXml;
  const closedVariant = addFillVariants(stylesXml, baseStyles, 14);
  stylesXml = closedVariant.stylesXml;

  const headers = sourceRows.filter((item) => item.number <= 5).map((item) => item.xml);
  const legend = sourceRows.filter((item) => item.number >= 69 && item.number <= 71);
  const capacity = Math.max(63, rows.length);
  const dataRows: string[] = [];

  for (let index = 0; index < capacity; index += 1) {
    const rowNumber = 6 + index;
    const record = rows[index];
    if (!record) {
      dataRows.push(buildRow(dataTemplate, rowNumber, ["A","B","C","D","E","F"].map((column) => ({
        column,
        value: "",
        style: templateStyles.get(column) ?? 0,
      }))));
      continue;
    }
    const statusMap = record.status === "CLOSED" ? closedVariant.styleMap : openVariant.styleMap;
    const values = [
      record.qmsRecord.businessCode ?? "",
      [date(record.issueDate), record.departmentCodeSnapshot ?? ""].filter(Boolean).join("\n"),
      record.materialProcessAffected ?? "",
      record.whatHappened ?? "",
      capaCodes(record),
      date(record.closedAt),
    ];
    dataRows.push(buildRow(dataTemplate, rowNumber, ["A","B","C","D","E","F"].map((column, col) => {
      const base = templateStyles.get(column) ?? 0;
      return { column, value: values[col], style: applyStyleMap(base, statusMap) };
    })));
  }

  const legendStart = 6 + capacity;
  const shiftedLegend = legend.map((item, index) => renumberRow(item.xml, item.number, legendStart + index));
  sheet = replaceSheetData(sheet, [...headers, ...dataRows, ...shiftedLegend]);
  sheet = setSheetDimension(sheet, `A1:F${legendStart + 2}`);
  sheet = setXlsxCell(sheet, "B2", `Listado general de Desviaciones\n"${year}"`);
  workbook = updatePrintArea(workbook, 0, `'TABLA OFICIAL'!$A$1:$F$${legendStart + 2}`);

  updateZipEntry(entries, "xl/worksheets/sheet1.xml", sheet);
  updateZipEntry(entries, "xl/styles.xml", stylesXml);
  updateZipEntry(entries, "xl/workbook.xml", workbook);
  entries = removeCalcChain(entries);
  sanitizeOfficeMetadata(entries);
  return writeZip(entries);
}

function inlineCell(ref: string, value: string, style = 0) {
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

export function generateSimpleList(rows: ExportRow[]) {
  const headers = [
    "CÓDIGO DEPARTAMENTO","CÓDIFICACIÓN","DEPARTAMENTO","MATERIAL/PROCESO AFECTADO","PROCEDENCIA",
    "DESCRIPCIÓN","CLASIFICACIÓN","CAUSA RAÍZ","FECHA APERTURA","FECHA CIERRE","ESTADO","EN PLAZO",
    "MEDIDAS ADOPTADAS","DESCRIPCIÓN CAPA","DOCUMENTO FIRMADO","OBSERVACIONES",
  ];
  const data = rows.map((row) => [
    row.departmentCodeSnapshot ?? "",
    row.qmsRecord.businessCode ?? "",
    row.departmentNameSnapshot ?? "",
    row.materialProcessAffected ?? "",
    row.provenance ?? "",
    row.whatHappened ?? "",
    classification(row.classification),
    row.rootCause ?? "",
    date(row.issueDate),
    date(row.closedAt),
    row.status === "OPEN" ? "Abierta" : "Cerrada",
    deadlineLabel(row.deadlineStatus),
    measuresLabel(row),
    capaDescriptions(row),
    row.signedDocumentAvailable === true ? "Disponible" : row.signedDocumentAvailable === false ? "No disponible" : "No informado",
    row.internalObservations ?? "",
  ]);

  const rowsXml = [headers, ...data].map((values, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const cells = values.map((item, colIndex) => {
      let n = colIndex + 1;
      let column = "";
      while (n > 0) {
        const rem = (n - 1) % 26;
        column = String.fromCharCode(65 + rem) + column;
        n = Math.floor((n - 1) / 26);
      }
      return inlineCell(`${column}${rowNumber}`, String(item), rowIndex === 0 ? 1 : 0);
    }).join("");
    return `<row r="${rowNumber}">${cells}</row>`;
  }).join("");

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols><col min="1" max="2" width="20" customWidth="1"/><col min="3" max="5" width="25" customWidth="1"/><col min="6" max="8" width="42" customWidth="1"/><col min="9" max="12" width="16" customWidth="1"/><col min="13" max="16" width="30" customWidth="1"/></cols>
<sheetData>${rowsXml}</sheetData><autoFilter ref="A1:P${Math.max(1, data.length + 1)}"/></worksheet>`;

  const entries: ZipEntry[] = [
    { name:"[Content_Types].xml", data:Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`) },
    { name:"_rels/.rels", data:Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name:"xl/workbook.xml", data:Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Listado" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
    { name:"xl/_rels/workbook.xml.rels", data:Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
    { name:"xl/styles.xml", data:Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0"><alignment vertical="center" wrapText="1"/></xf></cellXfs></styleSheet>`) },
    { name:"xl/worksheets/sheet1.xml", data:Buffer.from(sheet) },
  ];
  return writeZip(entries);
}
