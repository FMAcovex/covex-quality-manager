import { readZip, getZipEntryText, updateZipEntry, writeZip, type ZipEntry } from "@/lib/ooxml/zip";
import { escapeXml, setXlsxCell } from "@/lib/ooxml/xml";
import { loadAnnexVTemplate } from "@/modules/deviations/documents/templates";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { deadlineLabel, measuresLabel } from "@/modules/deviations/domain";

export const ANNEX_V_CAPACITY = 63;

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
export function annexVDate(value: Date | null) {
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


export function annexVOfficialRowValues(record: ExportRow) {
  return [
    record.qmsRecord.businessCode ?? "",
    [annexVDate(record.issueDate), record.departmentCodeSnapshot || record.departmentNameSnapshot].filter(Boolean).join(" - "),
    record.materialProcessAffected ?? "",
    record.whatHappened ?? "",
    capaCodes(record),
    annexVDate(record.closedAt),
  ];
}
export function annexVOfficialFillId(status: string) {
  return status === "CLOSED" ? 4 : 3;
}

function rowStyles(templateRow: string) {
  const styles = new Map<string, string>();
  for (const match of templateRow.matchAll(/<c\b([^>]*\br="([A-Z]+)\d+"[^>]*)/g)) {
    styles.set(match[2], match[1].match(/\bs="([^"]+)"/)?.[1] ?? "");
  }
  return styles;
}

function dataRowHeight(values: string[]) {
  const longest = Math.max(...values.map((value) => value.length), 0);
  if (longest > 240) return 78;
  if (longest > 160) return 63;
  if (longest > 80) return 48;
  return 33;
}

function xlsxCell(column: string, row: number, style: string, value: string) {
  const styleAttr = style ? ` s="${style}"` : "";
  if (!value) return `<c r="${column}${row}"${styleAttr}></c>`;
  return `<c r="${column}${row}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function addFilledStyles(stylesXml:string,baseStyles:number[],fillIds:number[]){
  const match=stylesXml.match(new RegExp("<cellXfs\\b([^>]*)>([\\s\\S]*?)</cellXfs>"));
  if(!match)throw new Error("Anexo V: cellXfs no encontrado.");
  const xfs=[...match[2].matchAll(new RegExp("<xf\\b[^>]*(?:/>|>[\\s\\S]*?</xf>)","g"))].map(x=>x[0]);
  const ids=new Map<string,number>();
  const additions:string[]=[];
  for(const fillId of fillIds){
    for(const base of baseStyles){
      const source=xfs[base];
      if(!source)throw new Error(`Anexo V: estilo base ${base} no encontrado.`);
      let clone=source;
      if(/fillId="\d+"/.test(clone))clone=clone.replace(/fillId="\d+"/,`fillId="${fillId}"`);
      else clone=clone.replace("<xf ",`<xf fillId="${fillId}" `);
      if(/applyFill="\d+"/.test(clone))clone=clone.replace(/applyFill="\d+"/,'applyFill="1"');
      else clone=clone.replace("<xf ", '<xf applyFill="1" ');
      const id=xfs.length+additions.length;
      additions.push(clone);
      ids.set(`${fillId}:${base}`,id);
    }
  }
  const attrs=match[1].replace(/count="\d+"/,`count="${xfs.length+additions.length}"`);
  const replacement=`<cellXfs${attrs}>${match[2]}${additions.join("")}</cellXfs>`;
  return {xml:stylesXml.replace(match[0],replacement),ids};
}

function setPrintLayout(sheetXml: string) {
  let result = sheetXml;
  if (!/<sheetPr\b/.test(result)) {
    result = result.replace(
      /(<dimension\b)/,
      '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>$1',
    );
  } else if (!/<pageSetUpPr\b/.test(result)) {
    result = result.replace(/<sheetPr([^>]*)>/, '<sheetPr$1><pageSetUpPr fitToPage="1"/>');
  }
  result = result.replace(
    /<pageSetup\b([^>]*)\/>/,
    (_match, attrs: string) => {
      const clean = attrs
        .replace(/\s+fitToWidth="[^"]*"/g, "")
        .replace(/\s+fitToHeight="[^"]*"/g, "");
      return `<pageSetup${clean} fitToWidth="1" fitToHeight="0"/>`;
    },
  );
  return result;
}

export async function generateAnnexV(year: number, rows: ExportRow[], versionCode = "06") {
  if (rows.length > ANNEX_V_CAPACITY) {
    throw new Error(`El Anexo V v06 admite ${ANNEX_V_CAPACITY} registros. Hay ${rows.length}; se requiere ampliar la plantilla controlada.`);
  }

  const entries = readZip(await loadAnnexVTemplate(versionCode));
  let sheet = getZipEntryText(entries, "xl/worksheets/sheet1.xml");
  let stylesXml = getZipEntryText(entries, "xl/styles.xml");
  let workbook = getZipEntryText(entries, "xl/workbook.xml");

  const sheetData = sheet.match(/<sheetData>([\s\S]*?)<\/sheetData>/);
  if (!sheetData) throw new Error("Anexo V: sheetData no encontrado.");
  const sourceRows = [...sheetData[1].matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>[\s\S]*?<\/row>/g)]
    .map((match) => ({ number: Number(match[1]), xml: match[0] }));
  const templateRow = sourceRows.find((item) => item.number === 6)?.xml;
  if (!templateRow) throw new Error("Anexo V: fila de datos modelo no encontrada.");

  const styles = rowStyles(templateRow);
  const styled = addFilledStyles(stylesXml,[7,8],[3,4]);
  stylesXml = styled.xml;
  const headerRows = sourceRows.filter((item) => item.number <= 5).map((item) => item.xml);
  const legendRows = sourceRows.filter((item) => item.number >= 69 && item.number <= 71).map((item) => item.xml);

  const dataRows = Array.from({ length: ANNEX_V_CAPACITY }, (_, index) => {
    const excelRow = 6 + index;
    const record = rows[index] ?? null;
    const values = record ? annexVOfficialRowValues(record).map(String) : Array(6).fill("");
    const fillId = record ? annexVOfficialFillId(record.status) : null;
    const cells = ["A","B","C","D","E","F"].map((column, col) => {
      const baseStyle = Number(styles.get(column) ?? (column === "F" ? "8" : "7"));
      const style = fillId ? String(styled.ids.get(`${fillId}:${baseStyle}`) ?? baseStyle) : String(baseStyle);
      return xlsxCell(column, excelRow, style, values[col] ?? "");
    }).join("");
    const height = record ? ` ht="${dataRowHeight(values)}" customHeight="1"` : "";
    return `<row r="${excelRow}" spans="1:6"${height}>${cells}</row>`;
  });

  sheet = sheet.replace(
    /<sheetData>[\s\S]*?<\/sheetData>/,
    `<sheetData>${[...headerRows,...dataRows,...legendRows].join("")}</sheetData>`,
  );
  sheet = sheet
    .replace(/<dimension ref="[^"]+"/, '<dimension ref="A1:F71"')
    .replace('<mergeCell ref="B2:F2"/>','<mergeCell ref="B2:F2"/>');
  sheet = setXlsxCell(sheet,"B2",`Listado general de Desviaciones\n"${year}"`);
  sheet = setPrintLayout(sheet);

  workbook = workbook
    .replace(/'TABLA OFICIAL'!\$A\$5:\$F\$67/g, "'TABLA OFICIAL'!$A$5:$F$68")
    .replace(/'TABLA OFICIAL'!\$A\$1:\$F\$67/g, "'TABLA OFICIAL'!$A$1:$F$71");

  updateZipEntry(entries,"xl/worksheets/sheet1.xml",sheet);
  updateZipEntry(entries,"xl/styles.xml",stylesXml);
  updateZipEntry(entries,"xl/workbook.xml",workbook);
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
    annexVDate(row.issueDate),
    annexVDate(row.closedAt),
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
