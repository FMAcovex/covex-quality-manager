import { Buffer } from "node:buffer";
import {
  getZipEntryText,
  readZip,
  writeZip,
  type ZipEntry,
} from "@/lib/ooxml/zip";
import { escapeXml } from "@/lib/ooxml/xml";
import { loadChangeAnnexVIITemplate } from "@/modules/change-control/documents/templates";

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

function inlineCell(ref: string, style: string, value: string) {
  if (!value) return `<c r="${ref}" s="${style}" />`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function fixedRow(rowNumber: number, cells: string, height = "15") {
  return `<row r="${rowNumber}" ht="${height}" hidden="0" customHeight="1">${cells}</row>`;
}

function addStateStyles(stylesXml: string) {
  const match = stylesXml.match(new RegExp("<cellXfs\\b([^>]*)>([\\s\\S]*?)</cellXfs>"));
  if (!match) throw new Error("Anexo VII: cellXfs no encontrado.");

  const xfs = [...match[2].matchAll(new RegExp("<xf\\b[^>]*(?:/>|>[\\s\\S]*?</xf>)", "g"))]
    .map((item) => item[0]);
  const ids = new Map<string, number>();
  const additions: string[] = [];

  for (const fillId of [5, 6]) {
    for (const base of [22, 23, 24]) {
      const source = xfs[base];
      if (!source) throw new Error(`Anexo VII: estilo base ${base} no encontrado.`);
      let clone = source;
      clone = /fillId="\\d+"/.test(clone)
        ? clone.replace(/fillId="\\d+"/, `fillId="${fillId}"`)
        : clone.replace("<xf ", `<xf fillId="${fillId}" `);
      clone = /applyFill="\\d+"/.test(clone)
        ? clone.replace(/applyFill="\\d+"/, 'applyFill="1"')
        : clone.replace("<xf ", '<xf applyFill="1" ');
      const id = xfs.length + additions.length;
      additions.push(clone);
      ids.set(`${fillId}:${base}`, id);
    }
  }

  const attrs = match[1].replace(/count="\\d+"/, `count="${xfs.length + additions.length}"`);
  return {
    xml: stylesXml.replace(
      match[0],
      `<cellXfs${attrs}>${match[2]}${additions.join("")}</cellXfs>`,
    ),
    ids,
  };
}

function annexVIIRowHeight(row: ChangeControlExportRow) {
  const length = row.description?.length ?? 0;
  if (length > 220) return "78";
  if (length > 140) return "66";
  if (length > 80) return "57";
  return "51";
}

function outputRow(
  rowNumber: number,
  row: ChangeControlExportRow,
  stateStyles: Map<string, number>,
) {
  const values = [
    row.qmsRecord.businessCode ?? "",
    classification(row.classification),
    row.description ?? "",
    date(row.requestDate),
    date(row.dictamenDate),
    date(latestPlanned(row)),
    date(row.executionDate),
    date(row.effectiveClosedAt),
  ];
  const baseStyles = [22, 22, 23, 24, 22, 24, 24, 24];
  const fillId = row.finalStatus === "CLOSED" ? 6 : 5;
  const cells = "BCDEFGHI"
    .split("")
    .map((column, index) => {
      const base = baseStyles[index];
      const style = stateStyles.get(`${fillId}:${base}`) ?? base;
      return inlineCell(`${column}${rowNumber}`, String(style), values[index]);
    })
    .join("");
  return `<row r="${rowNumber}" spans="2:9" ht="${annexVIIRowHeight(row)}" hidden="0" customHeight="1">${cells}</row>`;
}

export function buildChangeAnnexVIISheet(
  year: number,
  rows: ChangeControlExportRow[],
  stateStyles: Map<string, number>,
) {
  const dataRows = rows.map((row, index) => outputRow(5 + index, row, stateStyles));
  const legendStart = 5 + Math.max(rows.length, 1);
  const maxRow = legendStart + 2;

  const headerRows = [
    fixedRow(1, inlineCell("I1", "1", "Anexo VII PNT GC-00/003/03")),
    fixedRow(
      2,
      [
        inlineCell("B2", "27", `LISTADO DE CONTROLES DE CAMBIO\\n"AÑO ${year}"`),
        ...["C","D","E","F","G","H"].map((column) => inlineCell(`${column}2`, "28", "")),
        inlineCell("I2", "29", ""),
      ].join(""),
      "57.6",
    ),
    fixedRow(
      4,
      [
        "CÓDIFICACIÓN",
        "TIPO",
        "DESCRIPCIÓN",
        "FECHA SOLICITUD",
        "FECHA DE APROBACIÓN",
        "FECHA PREVISTA EJECUCION",
        "FECHA DE EJECUCIÓN",
        "FECHA CIERRE",
      ].map((value, index) => inlineCell(`${"BCDEFGHI"[index]}4`, "16", value)).join(""),
      "58.5",
    ),
  ];

  const legendRows = [
    fixedRow(
      legendStart,
      inlineCell(`B${legendStart}`, "17", "LEYENDA") +
        inlineCell(`C${legendStart}`, "18", "") +
        inlineCell(`D${legendStart}`, "19", "FIRMA Y FECHA:"),
      "42.75",
    ),
    fixedRow(legendStart + 1, inlineCell(`B${legendStart + 1}`, "20", "ABIERTA")),
    fixedRow(legendStart + 2, inlineCell(`B${legendStart + 2}`, "21", "CERRADA")),
  ];

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="B1:I${maxRow}"/>
  <sheetViews><sheetView zoomScale="90" zoomScaleNormal="90" workbookViewId="0"/></sheetViews>
  <sheetFormatPr baseColWidth="10" defaultRowHeight="15"/>
  <cols>
    <col min="1" max="1" width="3.7109375" customWidth="1"/>
    <col min="2" max="2" width="22.85546875" customWidth="1"/>
    <col min="3" max="3" width="14.7109375" customWidth="1"/>
    <col min="4" max="4" width="33.5703125" customWidth="1"/>
    <col min="5" max="5" width="19.85546875" customWidth="1"/>
    <col min="6" max="6" width="20.85546875" customWidth="1"/>
    <col min="7" max="7" width="19.5703125" customWidth="1"/>
    <col min="8" max="8" width="20.5703125" customWidth="1"/>
    <col min="9" max="9" width="19" customWidth="1"/>
  </cols>
  <sheetData>${[...headerRows, ...dataRows, ...legendRows].join("")}</sheetData>
  <mergeCells count="1"><mergeCell ref="B2:I2"/></mergeCells>
  <pageMargins left="0.23622047244094491" right="0.23622047244094491" top="0.55118110236220474" bottom="0.55118110236220474" header="0.31496062992125984" footer="0.31496062992125984"/>
  <pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>
  <drawing r:id="rIdDrawing"/>
</worksheet>`;
}

function minimalWorkbookEntries(
  source: ZipEntry[],
  sheetXml: string,
  stylesXml: string,
  year: number,
  maxRow: number,
): ZipEntry[] {
  const required = (name: string) => {
    const entry = source.find((item) => item.name === name);
    if (!entry) throw new Error(`Anexo VII: recurso no encontrado: ${name}`);
    return Buffer.from(entry.data);
  };
  const sheetRelId = "rIdDrawing";
  const drawingRelId = "rIdImage";
  const drawing = required("xl/drawings/drawing1.xml")
    .toString("utf8")
    .replace(/r:embed="[^"]+"/, `r:embed="${drawingRelId}"`);

  return [
    {
      name: "[Content_Types].xml",
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>
</Types>`),
    },
    {
      name: "_rels/.rels",
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    },
    {
      name: "xl/workbook.xml",
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView/></bookViews>
  <sheets><sheet name="ANEXO VII ${year} IMPRIMIR" sheetId="1" r:id="rId1"/></sheets>
  <definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'ANEXO VII ${year} IMPRIMIR'!$B$1:$I$${maxRow}</definedName></definedNames>
</workbook>`),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
</Relationships>`),
    },
    { name: "xl/styles.xml", data: Buffer.from(stylesXml) },
    { name: "xl/theme/theme1.xml", data: required("xl/theme/theme1.xml") },
    { name: "xl/worksheets/sheet1.xml", data: Buffer.from(sheetXml) },
    {
      name: "xl/worksheets/_rels/sheet1.xml.rels",
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="/xl/drawings/drawing1.xml" Id="${sheetRelId}"/>
</Relationships>`),
    },
    { name: "xl/drawings/drawing1.xml", data: Buffer.from(drawing) },
    {
      name: "xl/drawings/_rels/drawing1.xml.rels",
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="/xl/media/image1.png" Id="${drawingRelId}"/>
</Relationships>`),
    },
    { name: "xl/media/image1.png", data: required("xl/media/image1.png") },
  ];
}

export async function generateChangeAnnexVII(
  year: number,
  rows: ChangeControlExportRow[],
  versionCode = "03",
) {
  const source = readZip(await loadChangeAnnexVIITemplate(versionCode));
  getZipEntryText(source, "xl/worksheets/sheet1.xml");
  const stylesSource = getZipEntryText(source, "xl/styles.xml");
  const styled = addStateStyles(stylesSource);
  const sheet = buildChangeAnnexVIISheet(year, rows, styled.ids);
  const legendStart = 5 + Math.max(rows.length, 1);

  return writeZip(
    minimalWorkbookEntries(
      source,
      sheet,
      styled.xml,
      year,
      legendStart + 2,
    ),
  );
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
