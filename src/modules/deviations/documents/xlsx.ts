import { readZip, getZipEntryText, updateZipEntry, writeZip, type ZipEntry } from "@/lib/ooxml/zip";
import { escapeXml, setXlsxCell } from "@/lib/ooxml/xml";
import { loadAnnexVTemplate } from "@/modules/deviations/documents/templates";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { deadlineLabel, measuresLabel } from "@/modules/deviations/domain";

export const ANNEX_V_CAPACITY = 61;

const DETAIL_STYLES: Record<string, number> = {
  B: 20, C: 21, D: 22, E: 22, F: 15, G: 21,
  H: 18, I: 25, J: 25, K: 27, L: 28, M: 26,
};

export function ensureAnnexVDetailRows(sheetXml: string) {
  for (let row = 9; row <= 65; row += 1) {
    const rowRegex = new RegExp(`<row([^>]*\\br="${row}"[^>]*)>([\\s\\S]*?)<\\/row>`);
    sheetXml = sheetXml.replace(rowRegex, (_match, rawAttrs: string, inner: string) => {
      let attrs = rawAttrs;
      if (!/\\bht=/.test(attrs)) attrs += ' ht="45"';
      if (!/\\bcustomHeight=/.test(attrs)) attrs += ' customHeight="1"';
      const missing = Object.entries(DETAIL_STYLES)
        .filter(([column]) => !new RegExp(`<c[^>]*\\br="${column}${row}"(?:\\s|")`).test(inner))
        .map(([column, style]) => `<c r="${column}${row}" s="${style}"></c>`)
        .join("");
      const pCell = new RegExp(`<c[^>]*\\br="P${row}"`);
      const updatedInner = pCell.test(inner)
        ? inner.replace(pCell, `${missing}$&`)
        : `${inner}${missing}`;
      return `<row${attrs}>${updatedInner}</row>`;
    });
  }
  return sheetXml;
}


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
  if (rows.length > ANNEX_V_CAPACITY) {
    throw new Error(
      `El Anexo V v06 admite ${ANNEX_V_CAPACITY} registros. Hay ${rows.length}; se requiere una plantilla controlada con mayor capacidad.`,
    );
  }

  let entries = readZip(await loadAnnexVTemplate(versionCode));
  let detail = ensureAnnexVDetailRows(getZipEntryText(entries, "xl/worksheets/sheet1.xml"));
  let official = getZipEntryText(entries, "xl/worksheets/sheet3.xml");
  let workbook = getZipEntryText(entries, "xl/workbook.xml");

  workbook = workbook
    .replace(/name="2026"/, `name="${year}"`)
    .replaceAll("'2026'!", `'${year}'!`)
    .replace(
      /<definedName name="_xlnm.Print_Area" localSheetId="0">[\s\S]*?<\/definedName>/,
      `<definedName name="_xlnm.Print_Area" localSheetId="0">'${year}'!$B$1:$M$65</definedName>`,
    );
  detail = setXlsxCell(detail, "B2", `LISTADO GENERAL DE DESVIACIONES\n"${year}"`);
  official = setXlsxCell(official, "B2", `Listado general de Desviaciones\n${year}`);

  for (let index = 0; index < ANNEX_V_CAPACITY; index += 1) {
    const sourceRow = 5 + index;
    const officialRow = 6 + index;
    const row = rows[index] ?? null;
    const values = row
      ? [
          row.departmentCodeSnapshot ?? "",
          row.qmsRecord.businessCode ?? "",
          row.materialProcessAffected ?? "",
          row.provenance ?? "",
          row.whatHappened ?? "",
          classification(row.classification),
          row.rootCause ?? "",
          date(row.issueDate),
          date(row.closedAt),
          row.immediateActions.length && row.capaPlans.length
            ? "CAPA+Correctiva Inmediata"
            : measuresLabel(row),
          capaCodes(row),
          row.internalObservations ?? "",
        ]
      : Array(12).fill("");

    const columns = ["B","C","D","E","F","G","H","I","J","K","L","M"];
    columns.forEach((column, col) => {
      detail = setXlsxCell(detail, `${column}${sourceRow}`, values[col] as string);
    });

    const officialValues = row
      ? [
          row.qmsRecord.businessCode ?? "",
          [date(row.issueDate), row.departmentCodeSnapshot].filter(Boolean).join(" - "),
          row.materialProcessAffected ?? "",
          row.whatHappened ?? "",
          capaCodes(row),
          date(row.closedAt),
        ]
      : Array(6).fill("");
    ["A","B","C","D","E","F"].forEach((column, col) => {
      official = setXlsxCell(official, `${column}${officialRow}`, officialValues[col] as string);
    });
  }

  updateZipEntry(entries, "xl/worksheets/sheet1.xml", detail);
  updateZipEntry(entries, "xl/worksheets/sheet3.xml", official);
  updateZipEntry(entries, "xl/workbook.xml", workbook);

  const tableEntry = entries.find((entry) => entry.name === "xl/tables/table1.xml");
  if (tableEntry) {
    const tableXml = tableEntry.data
      .toString("utf8")
      .replaceAll('ref="B4:M8"', 'ref="B4:M65"');
    updateZipEntry(entries, "xl/tables/table1.xml", tableXml);
  }

  const appEntry = entries.find((entry) => entry.name === "docProps/app.xml");
  if (appEntry) {
    updateZipEntry(
      entries,
      "docProps/app.xml",
      appEntry.data.toString("utf8").replaceAll("2026", String(year)),
    );
  }

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
