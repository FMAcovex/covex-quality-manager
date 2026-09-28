import {
  getZipEntryText,
  readZip,
  updateZipEntry,
  writeZip,
  type ZipEntry,
} from "@/lib/ooxml/zip";
import { escapeXml, setXlsxCell } from "@/lib/ooxml/xml";
import { appendFillStyleVariants, xlsxCellStyle } from "@/lib/ooxml/xlsx-template";
import { loadChangeAnnexVIITemplate } from "@/modules/change-control/documents/templates";

function replaceSheetDataXml(xml:string,body:string){
 const start=xml.indexOf("<sheetData>");
 const end=xml.indexOf("</sheetData>",start);
 if(start<0||end<0)throw new Error("XLSX: sheetData no encontrado.");
 return xml.slice(0,start)+"<sheetData>"+body+"</sheetData>"+xml.slice(end+"</sheetData>".length);
}

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
  tasks: Array<{
    plannedDate: Date | null;
    origin: string;
  }>;
  followups: Array<{
    sequenceNumber: number;
    followupDate: Date;
    nextFollowupDate: Date | null;
  }>;
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

function xmlCell(column: string, row: number, style: number, value: string) {
  if (!value) return `<c r="${column}${row}" s="${style}"></c>`;
  return `<c r="${column}${row}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function rowStyles(templateRow: string) {
  const styles = new Map<string, number>();
  for (const match of templateRow.matchAll(/<c\b([^>]*\br="([A-Z]+)\d+"[^>]*)/g)) {
    styles.set(match[2], Number(match[1].match(/\bs="([^"]+)"/)?.[1] ?? 0));
  }
  return styles;
}

function shiftRow(rowXml: string, from: number, to: number) {
  return rowXml
    .replace(new RegExp(`(<row[^>]*\\br=")${from}(")`), `$1${to}$2`)
    .replace(new RegExp(`r="([A-Z]+)${from}"`, "g"), `r="$1${to}"`);
}

export async function generateChangeAnnexVII(
  year: number,
  rows: ChangeControlExportRow[],
  versionCode = "03",
) {
  const entries = readZip(await loadChangeAnnexVIITemplate(versionCode));
  let sheet = getZipEntryText(entries, "xl/worksheets/sheet1.xml");
  let stylesXml = getZipEntryText(entries, "xl/styles.xml");

  const sheetData = sheet.match(/<sheetData>([\s\S]*?)<\/sheetData>/);
  if (!sheetData) throw new Error("Anexo VII: sheetData no encontrado.");
  const sourceRows = [...sheetData[1].matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>[\s\S]*?<\/row>/g)]
    .map((match) => ({ number: Number(match[1]), xml: match[0] }));
  const byNumber = new Map(sourceRows.map((item) => [item.number, item.xml]));
  const dataTemplate = byNumber.get(5);
  if (!dataTemplate) throw new Error("Anexo VII: fila modelo no encontrada.");

  const openLegendStyle = xlsxCellStyle(sheet, "B17");
  const closedLegendStyle = xlsxCellStyle(sheet, "B18");
  if (openLegendStyle === null || closedLegendStyle === null) {
    throw new Error("Anexo VII: leyenda ABIERTA/CERRADA no encontrada.");
  }

  const base = rowStyles(dataTemplate);
  const baseStyles = ["B","C","D","E","F","G","H","I"].map((col) => base.get(col) ?? 0);
  const openVariants = appendFillStyleVariants(stylesXml, baseStyles, openLegendStyle);
  stylesXml = openVariants.stylesXml;
  const closedVariants = appendFillStyleVariants(stylesXml, baseStyles, closedLegendStyle);
  stylesXml = closedVariants.stylesXml;

  const dataRows = rows.map((record, index) => {
    const rowNumber = 5 + index;
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
    const map = record.finalStatus === "OPEN" ? openVariants.styleMap : closedVariants.styleMap;
    const cells = ["B","C","D","E","F","G","H","I"].map((col, i) => {
      const baseStyle = base.get(col) ?? 0;
      return xmlCell(col, rowNumber, map.get(baseStyle) ?? baseStyle, values[i]);
    }).join("");
    return `<row r="${rowNumber}" ht="51" customHeight="1">${cells}</row>`;
  });

  const headers = sourceRows.filter((item) => item.number <= 4).map((item) => item.xml);
  const legend = sourceRows.filter((item) => item.number >= 16 && item.number <= 18);
  const legendStart = 5 + Math.max(rows.length, 1);
  const shiftedLegend = legend.map((item, index) => shiftRow(item.xml, item.number, legendStart + index));
  const newSheetData = `<sheetData>${[...headers, ...dataRows, ...shiftedLegend].join("")}</sheetData>`;
  sheet = replaceSheetDataXml(sheet, [...headers, ...dataRows, ...shiftedLegend].join(""));
  sheet = sheet.replace(/<dimension ref="[^"]+"/, `<dimension ref="A1:N${legendStart + 2}"`);
  sheet = setXlsxCell(sheet, "B2", `LISTADO DE CONTROLES DE CAMBIO\n"${year}"`);

  updateZipEntry(entries, "xl/worksheets/sheet1.xml", sheet);
  updateZipEntry(entries, "xl/styles.xml", stylesXml);

  let workbook = getZipEntryText(entries, "xl/workbook.xml");
  workbook = workbook.replace(
    /<definedName name="_xlnm.Print_Area" localSheetId="0">[\\s\\S]*?<\\/definedName>/,
    `<definedName name="_xlnm.Print_Area" localSheetId="0">'ANEXO VII'!$B$1:$I$${legendStart + 2}</definedName>`,
  );
  updateZipEntry(entries, "xl/workbook.xml", workbook);
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
