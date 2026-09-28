import { Buffer } from "node:buffer";
import { getZipEntryText, readZip, updateZipEntry, writeZip, type ZipEntry } from "@/lib/ooxml/zip";
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
import { loadChangeAnnexVIITemplate } from "@/modules/change-control/documents/templates";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";

export type ChangeControlExportRow = {
  qmsRecord: { businessCode: string | null };
  departmentCodeSnapshot: string | null;
  description: string | null;
  requestDate: Date | null;
  dictamenDate: Date | null;
  classification: string | null;
  plannedImplementationDate: Date | null;
  executionStatus: string;
  executionDate: Date | null;
  effectivenessStatus: string;
  effectiveClosedAt: Date | null;
  finalStatus: string;
  internalObservations: string | null;
  tasks: Array<{ plannedDate: Date | null; origin: string }>;
  followups: Array<{ sequenceNumber: number; followupDate: Date; nextFollowupDate: Date | null }>;
};

function date(value: Date | null | undefined) {
  return value ? new Intl.DateTimeFormat("es-ES").format(value) : "";
}
function latestPlanned(row: ChangeControlExportRow) {
  const dates = row.tasks
    .filter((item) => item.origin === "DICTAMEN")
    .map((item) => item.plannedDate)
    .filter((value): value is Date => Boolean(value));
  if (row.plannedImplementationDate) dates.push(row.plannedImplementationDate);
  return dates.length ? new Date(Math.max(...dates.map((item) => item.getTime()))) : null;
}
function classification(value: string | null) {
  if (value === "MAJOR") return "MAYOR";
  if (value === "MINOR") return "MENOR";
  return "";
}
function execution(value: string) {
  return value === "EXECUTED" ? "Ejecutado" : "No ejecutado";
}
function efficacy(value: string) {
  if (value === "ACCEPTABLE") return "Aceptable";
  if (value === "NOT_ACCEPTABLE") return "No aceptable";
  if (value === "NOT_APPLICABLE") return "No aplica";
  return "Pendiente";
}
function state(value: string) {
  return value === "CLOSED" ? "Cerrado" : "Abierto";
}

export async function generateChangeAnnexVII(
  year: number,
  rows: ChangeControlExportRow[],
  versionCode = "03",
) {
  const entries = readZip(await loadChangeAnnexVIITemplate(versionCode));
  let sheet = getZipEntryText(entries, "xl/worksheets/sheet1.xml");
  let stylesXml = getZipEntryText(entries, "xl/styles.xml");
  let workbook = getZipEntryText(entries, "xl/workbook.xml");

  const sourceRows = sheetRows(sheet);
  const firstTemplate = sourceRows.find((item) => item.number === 5)?.xml;
  const regularTemplate = sourceRows.find((item) => item.number === 6)?.xml ?? firstTemplate;
  if (!firstTemplate || !regularTemplate) throw new Error("Anexo VII: fila de datos modelo no encontrada.");

  const baseIds = [...new Set([
    ...rowStyles(firstTemplate).values(),
    ...rowStyles(regularTemplate).values(),
  ])];
  const openVariant = addFillVariants(stylesXml, baseIds, 20);
  stylesXml = openVariant.stylesXml;
  const closedVariant = addFillVariants(stylesXml, baseIds, 21);
  stylesXml = closedVariant.stylesXml;

  const headers = sourceRows.filter((item) => item.number <= 4).map((item) => item.xml);
  const legend = sourceRows.filter((item) => item.number >= 16 && item.number <= 18);
  const capacity = Math.max(11, rows.length);
  const dataRows: string[] = [];

  for (let index = 0; index < capacity; index += 1) {
    const rowNumber = 5 + index;
    const template = index === 0 ? firstTemplate : regularTemplate;
    const styles = rowStyles(template);
    const record = rows[index];
    if (!record) {
      dataRows.push(buildRow(template, rowNumber, "BCDEFGHI".split("").map((column) => ({
        column,
        value: "",
        style: styles.get(column) ?? 0,
      }))));
      continue;
    }
    const styleMap = record.finalStatus === "CLOSED" ? closedVariant.styleMap : openVariant.styleMap;
    const values = [
      record.qmsRecord.businessCode ?? "",
      classification(record.classification),
      record.description ?? "",
      date(record.requestDate),
      date(record.dictamenDate),
      date(latestPlanned(record)),
      date(record.executionDate),
      date(record.effectiveClosedAt),
    ];
    dataRows.push(buildRow(template, rowNumber, "BCDEFGHI".split("").map((column, col) => {
      const base = styles.get(column) ?? 0;
      return { column, value: values[col], style: applyStyleMap(base, styleMap) };
    })));
  }

  const legendStart = 5 + capacity;
  const shiftedLegend = legend.map((item, index) => renumberRow(item.xml, item.number, legendStart + index));
  sheet = replaceSheetData(sheet, [...headers, ...dataRows, ...shiftedLegend]);
  sheet = setSheetDimension(sheet, `A1:N${legendStart + 2}`);
  sheet = setXlsxCell(sheet, "B2", `LISTADO DE CONTROLES DE CAMBIO\n"${year}"`);
  sheet = sheet.replace(/sqref="H5:H13"/g, `sqref="H5:H${4 + capacity}"`);
  workbook = updatePrintArea(workbook, 0, `'ANEXO VII'!$B$1:$I$${legendStart + 2}`);

  updateZipEntry(entries, "xl/worksheets/sheet1.xml", sheet);
  updateZipEntry(entries, "xl/styles.xml", stylesXml);
  updateZipEntry(entries, "xl/workbook.xml", workbook);
  sanitizeOfficeMetadata(entries);
  return writeZip(entries);
}

export function generateChangeSimpleList(rows: ChangeControlExportRow[]) {
  const headers = [
    "DEPARTAMENTO","CÓDIFICACIÓN","DESCRIPCIÓN","FECHA SOLICITUD","FECHA APROBACIÓN",
    "CLASIFICACIÓN","FECHA PREVISTA EJECUCIÓN","ESTADO EJECUCIÓN","FECHA EJECUCIÓN",
    "EFICACIA","ÚLTIMO SEGUIMIENTO","PRÓXIMO SEGUIMIENTO","ESTADO FINAL","FECHA CIERRE","OBSERVACIONES",
  ];
  const data = rows.map((row) => {
    const latest = row.followups[0];
    return [
      row.departmentCodeSnapshot ?? "",
      row.qmsRecord.businessCode ?? "",
      row.description ?? "",
      date(row.requestDate),
      date(row.dictamenDate),
      classification(row.classification),
      date(latestPlanned(row)),
      execution(row.executionStatus),
      date(row.executionDate),
      efficacy(row.effectivenessStatus),
      latest ? `${String(latest.sequenceNumber).padStart(2, "0")} · ${date(latest.followupDate)}` : "",
      date(latest?.nextFollowupDate),
      state(row.finalStatus),
      date(row.effectiveClosedAt),
      row.internalObservations ?? "",
    ];
  });

  const cell = (ref: string, value: string, style = 0) =>
    `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
  const columnName = (index: number) => {
    let n = index + 1;
    let result = "";
    while (n > 0) {
      n -= 1;
      result = String.fromCharCode(65 + (n % 26)) + result;
      n = Math.floor(n / 26);
    }
    return result;
  };
  const rowsXml = [headers, ...data].map((values, rowIndex) => {
    const number = rowIndex + 1;
    return `<row r="${number}">${values
      .map((value, column) => cell(`${columnName(column)}${number}`, String(value), rowIndex === 0 ? 1 : 0))
      .join("")}</row>`;
  }).join("");

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols><col min="1" max="2" width="22" customWidth="1"/><col min="3" max="3" width="55" customWidth="1"/><col min="4" max="15" width="20" customWidth="1"/></cols>
<sheetData>${rowsXml}</sheetData><autoFilter ref="A1:O${Math.max(1, data.length + 1)}"/>
</worksheet>`;

  const entries: ZipEntry[] = [
    { name: "[Content_Types].xml", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`) },
    { name: "_rels/.rels", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name: "xl/workbook.xml", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Controles de Cambios" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
    { name: "xl/styles.xml", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0"><alignment vertical="center" wrapText="1"/></xf></cellXfs></styleSheet>`) },
    { name: "xl/worksheets/sheet1.xml", data: Buffer.from(sheet) },
  ];
  return writeZip(entries);
}
