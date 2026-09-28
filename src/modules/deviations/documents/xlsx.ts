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

function cloneXfWithFill(xf:string,fillId:number){
 let out=xf.replace(/fillId="[^"]+"/,`fillId="${fillId}"`);
 if(!/fillId=/.test(out))out=out.replace("<xf ",`<xf fillId="${fillId}" `);
 if(/applyFill=/.test(out))out=out.replace(/applyFill="[^"]+"/,'applyFill="1"');
 else out=out.replace("<xf ", '<xf applyFill="1" ');
 return out;
}

function addDeviationStatusStyles(entries:ZipEntry[]){
 let styles=getZipEntryText(entries,"xl/styles.xml");
 const match=styles.match(/<cellXfs count="(\\d+)">([\\s\\S]*?)<\\/cellXfs>/);
 if(!match)throw new Error("Anexo V Desviaciones: estilos no encontrados.");
 const count=Number(match[1]);
 const xfs=[...match[2].matchAll(/<xf\\b[^>]*\\/>|<xf\\b[^>]*>[\\s\\S]*?<\\/xf>/g)].map(x=>x[0]);
 const baseNormal=xfs[7],baseDate=xfs[8];
 if(!baseNormal||!baseDate)throw new Error("Anexo V Desviaciones: estilos base no encontrados.");
 const added=[
  cloneXfWithFill(baseNormal,3),cloneXfWithFill(baseDate,3),
  cloneXfWithFill(baseNormal,4),cloneXfWithFill(baseDate,4),
 ];
 styles=styles.replace(match[0],`<cellXfs count="${count+added.length}">${match[2]}${added.join("")}</cellXfs>`);
 updateZipEntry(entries,"xl/styles.xml",styles);
 return {openNormal:count,openDate:count+1,closedNormal:count+2,closedDate:count+3};
}

function officialDeviationRow(rowNumber:number,row:ExportRow,styles:{openNormal:number;openDate:number;closedNormal:number;closedDate:number}){
 const closed=row.status==="CLOSED";
 const normal=closed?styles.closedNormal:styles.openNormal;
 const dateStyle=closed?styles.closedDate:styles.openDate;
 const values=[
  row.qmsRecord.businessCode??"",
  [date(row.issueDate),row.departmentCodeSnapshot].filter(Boolean).join("\\n"),
  row.materialProcessAffected??"",
  row.whatHappened??"",
  capaCodes(row),
  date(row.closedAt),
 ];
 const cols=["A","B","C","D","E","F"];
 return `<row r="${rowNumber}" ht="45" customHeight="1">${values.map((value,index)=>`<c r="${cols[index]}${rowNumber}" s="${index===5?dateStyle:normal}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`).join("")}</row>`;
}

function shiftOfficialRow(rowXml:string,from:number,to:number){
 return rowXml
  .replace(new RegExp(`(<row[^>]*\\\\br=")${from}(")`),`$1${to}$2`)
  .replace(new RegExp(`r="([A-Z]+)${from}"`,"g"),`r="$1${to}"`);
}

export async function generateAnnexV(year: number, rows: ExportRow[], versionCode = "06") {
 let entries=readZip(await loadAnnexVTemplate(versionCode));
 let sheet=getZipEntryText(entries,"xl/worksheets/sheet1.xml");
 let workbook=getZipEntryText(entries,"xl/workbook.xml");
 const statusStyles=addDeviationStatusStyles(entries);

 const source=[...sheet.matchAll(/<row\\b[^>]*\\br="(\\d+)"[^>]*>[\\s\\S]*?<\\/row>/g)]
  .map(match=>({number:Number(match[1]),xml:match[0]}));
 const headers=source.filter(item=>item.number<=5).map(item=>item.xml);
 const legend=source.filter(item=>item.number>=69&&item.number<=71);
 const dataRows=rows.map((row,index)=>officialDeviationRow(6+index,row,statusStyles));
 const legendStart=6+Math.max(rows.length,1);
 const shiftedLegend=legend.map((item,index)=>shiftOfficialRow(item.xml,item.number,legendStart+index));
 const last=legendStart+2;

 sheet=sheet.replace(/<sheetData>[\\s\\S]*?<\\/sheetData>/,`<sheetData>${[...headers,...dataRows,...shiftedLegend].join("")}</sheetData>`);
 sheet=setXlsxCell(sheet,"B2",`Listado general de Desviaciones\\n"${year}"`);
 sheet=sheet.replace(/<dimension ref="[^"]+"/,`<dimension ref="A1:F${last}"`);
 workbook=workbook
  .replace(/<sheet name="TABLA OFICIAL"/,`<sheet name="${year}"`)
  .replace(/<definedName name="_xlnm\\.Print_Area"[^>]*>[\\s\\S]*?<\\/definedName>/,`<definedName name="_xlnm.Print_Area" localSheetId="0">'${year}'!$A$1:$F$${last}</definedName>`);

 updateZipEntry(entries,"xl/worksheets/sheet1.xml",sheet);
 updateZipEntry(entries,"xl/workbook.xml",workbook);
 entries=removeCalcChain(entries);
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
