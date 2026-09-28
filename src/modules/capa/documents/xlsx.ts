import {
  getZipEntryText,
  readZip,
  updateZipEntry,
  writeZip,
  type ZipEntry,
} from "@/lib/ooxml/zip";
import { escapeXml, setXlsxCell } from "@/lib/ooxml/xml";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { loadCapaAnnexIVTemplate } from "@/modules/capa/documents/templates";

type CapaExportRow = {
  qmsRecord: { businessCode: string | null };
  actionType: string;
  originType: string | null;
  originCode: string | null;
  departmentNameSnapshot: string | null;
  departmentCodeSnapshot: string | null;
  openedAt: Date | null;
  operationalClosedAt: Date | null;
  effectiveClosedAt: Date | null;
  status: string;
  effectivenessStatus: string;
  internalObservations: string | null;
  plannedActions: Array<{ description: string; plannedExecutionDate?: Date | null }>;
  followups?: Array<{
    sequenceNumber: number;
    followupDate: Date;
    nextFollowupDate: Date | null;
  }>;
};

function date(value: Date | null) {
  return value ? new Intl.DateTimeFormat("es-ES").format(value) : "";
}

function xmlCell(column: string, row: number, style: string, value: string) {
  const styleAttr = style ? ` s="${style}"` : "";
  if (!value) return `<c r="${column}${row}"${styleAttr}></c>`;
  return `<c r="${column}${row}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function rowStyles(templateRow: string) {
  const styles = new Map<string, string>();
  for (const match of templateRow.matchAll(/<c\b([^>]*\br="([A-Z]+)\d+"[^>]*)/g)) {
    styles.set(match[2], match[1].match(/\bs="([^"]+)"/)?.[1] ?? "");
  }
  return styles;
}

function shiftRow(rowXml: string, from: number, to: number) {
  return rowXml
    .replace(new RegExp(`(<row[^>]*\\br=")${from}(")`), `$1${to}$2`)
    .replace(new RegExp(`r="([A-Z]+)${from}"`, "g"), `r="$1${to}"`);
}

function trimRowToOfficialColumns(rowXml: string) {
  return rowXml
    .replace(/<c\b[^>]*\br="[G-N]\d+"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g, "")
    .replace(/spans="1:14"/g, 'spans="1:6"');
}

function capaRowHeight(values: string[]) {
  const longest = Math.max(...values.map((value) => value.length), 0);
  if (longest > 240) return 78;
  if (longest > 160) return 63;
  if (longest > 80) return 48;
  return 33;
}

function setCapaPrintLayout(sheetXml: string) {
  let result = sheetXml;
  if (!/<sheetPr\b/.test(result)) {
    result = result.replace(
      /(<dimension\b)/,
      '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>$1',
    );
  }
  const pageSetup = '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>';
  if (/<pageSetup\b[^>]*\/>/.test(result)) {
    result = result.replace(/<pageSetup\b[^>]*\/>/, pageSetup);
  } else {
    result = result.replace(/<pageMargins\b[^>]*\/>/, (m) => `${m}${pageSetup}`);
  }
  return result;
}

function setCellStyle(sheetXml:string,ref:string,style:number){
  const re=new RegExp(`(<c\\b[^>]*\\br="${ref}"[^>]*)(>)`);
  return sheetXml.replace(re,(_m,attrs:string,end:string)=>{
    const next=/\bs="[^"]*"/.test(attrs)?attrs.replace(/\bs="[^"]*"/,`s="${style}"`):`${attrs} s="${style}"`;
    return `${next}${end}`;
  });
}
function addCapaFilledStyles(stylesXml:string){
  const match=stylesXml.match(new RegExp("<cellXfs\\b([^>]*)>([\\s\\S]*?)</cellXfs>"));
  if(!match)throw new Error("Anexo IV CAPA: cellXfs no encontrado.");
  const xfs=[...match[2].matchAll(new RegExp("<xf\\b[^>]*(?:/>|>[\\s\\S]*?</xf>)","g"))].map(x=>x[0]);
  const ids=new Map<string,number>(); const additions:string[]=[];
  for(const fillId of [4,5]) for(const base of [8,9]){
    let clone=xfs[base]; if(!clone)throw new Error(`Anexo IV CAPA: estilo base ${base} no encontrado.`);
    clone=/fillId="\d+"/.test(clone)?clone.replace(/fillId="\d+"/,`fillId="${fillId}"`):clone.replace("<xf ",`<xf fillId="${fillId}" `);
    clone=/applyFill="\d+"/.test(clone)?clone.replace(/applyFill="\d+"/,'applyFill="1"'):clone.replace("<xf ",'<xf applyFill="1" ');
    const id=xfs.length+additions.length; additions.push(clone); ids.set(`${fillId}:${base}`,id);
  }
  const attrs=match[1].replace(/count="\d+"/,`count="${xfs.length+additions.length}"`);
  return {xml:stylesXml.replace(match[0],`<cellXfs${attrs}>${match[2]}${additions.join("")}</cellXfs>`),ids};
}

export function expandCapaAnnexIVSheet(
  sheetXml: string,
  year: number,
  rows: CapaExportRow[],
) {
  const sheetData = sheetXml.match(/<sheetData>([\s\S]*?)<\/sheetData>/);
  if (!sheetData) throw new Error("Anexo IV CAPA: sheetData no encontrado.");

  const sourceRows = [...sheetData[1].matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>[\s\S]*?<\/row>/g)]
    .map((match) => ({ number: Number(match[1]), xml: match[0] }));
  const byNumber = new Map(sourceRows.map((item) => [item.number, item.xml]));
  const dataTemplate = byNumber.get(5);
  if (!dataTemplate) throw new Error("Anexo IV CAPA: fila de datos modelo no encontrada.");

  const styles = rowStyles(dataTemplate);
  const headers = sourceRows
    .filter((item) => item.number <= 4)
    .map((item) => trimRowToOfficialColumns(item.xml));
  const legend = sourceRows.filter((item) => item.number >= 13 && item.number <= 15);

  const dataRows = rows.map((record, index) => {
    const row = 5 + index;
    const type = record.actionType === "PREVENTIVE" ? "Preventiva" : "Correctiva";
    const codeOrigin = [record.qmsRecord.businessCode, record.originType, record.originCode]
      .filter(Boolean)
      .join(" / ");
    const description = record.plannedActions.map((item) => item.description).filter(Boolean).join("\n");
    const responsible = [
      record.departmentNameSnapshot || record.departmentCodeSnapshot,
      date(record.openedAt),
    ].filter(Boolean).join(" - ");
    const values = [
      type,
      codeOrigin,
      description,
      responsible,
      date(record.operationalClosedAt),
      date(record.effectiveClosedAt),
    ];
    const cells = ["A","B","C","D","E","F"]
      .map((column, col) => xmlCell(column, row, styles.get(column) ?? "", values[col]))
      .join("");
    return `<row r="${row}" spans="1:6" ht="${capaRowHeight(values)}" customHeight="1">${cells}</row>`;
  });

  const legendStart = 5 + Math.max(rows.length, 1);
  const shiftedLegend = legend.map((item, index) =>
    shiftRow(trimRowToOfficialColumns(item.xml), item.number, legendStart + index),
  );

  const newSheetData = `<sheetData>${[...headers, ...dataRows, ...shiftedLegend].join("")}</sheetData>`;
  let result = sheetXml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, newSheetData);
  result = result
    .replace(/<dimension ref="[^"]+"/, `<dimension ref="A1:F${legendStart + 2}"`)
    .replace('<mergeCell ref="M1:N1"/>', "")
    .replace(/<mergeCells count="3">/, '<mergeCells count="2">');
  result = setXlsxCell(result, "A2", `LISTADO DE SEGUIMIENTOS DE CAPAS\n"${year}"`);
  return setCapaPrintLayout(result);
}

export async function generateCapaAnnexIV(
  year: number,
  rows: CapaExportRow[],
  versionCode = "05",
) {
  const entries = readZip(await loadCapaAnnexIVTemplate(versionCode));
  const sheetEntry = entries.find((entry) => entry.name === "xl/worksheets/sheet1.xml");
  if (!sheetEntry) throw new Error("Anexo IV CAPA: hoja principal no encontrada.");
  let sheet = expandCapaAnnexIVSheet(sheetEntry.data.toString("utf8"), year, rows);
  const styleEntry=entries.find((entry)=>entry.name==="xl/styles.xml");
  if(!styleEntry)throw new Error("Anexo IV CAPA: estilos no encontrados.");
  const styled=addCapaFilledStyles(styleEntry.data.toString("utf8"));
  rows.forEach((record,index)=>{
    const row=5+index; const fillId=record.status==="CLOSED"?5:4;
    ["A","B","C","D"].forEach(column=>{sheet=setCellStyle(sheet,`${column}${row}`,styled.ids.get(`${fillId}:8`)!);});
    ["E","F"].forEach(column=>{sheet=setCellStyle(sheet,`${column}${row}`,styled.ids.get(`${fillId}:9`)!);});
  });
  updateZipEntry(entries, "xl/worksheets/sheet1.xml", sheet);
  updateZipEntry(entries, "xl/styles.xml", styled.xml);

  const workbook = getZipEntryText(entries, "xl/workbook.xml")
    .replace(/name="ANEXO 2026 IMPRIMIR \(2\)"/, `name="ANEXO ${year} IMPRIMIR"`);
  updateZipEntry(entries, "xl/workbook.xml", workbook);
  sanitizeOfficeMetadata(entries);
  return writeZip(entries);
}

export function generateCapaSimpleList(rows: CapaExportRow[]) {
  const headers = [
    "TIPO CAPA","CÓDIGO DEPARTAMENTO","CÓDIFICACIÓN","ORIGEN","CODIFICACIÓN DE ORIGEN",
    "DESCRIPCIÓN CAPA","FECHA APERTURA","FECHA PREVISTA EJECUCIÓN","ESTADO",
    "FECHA CIERRE OPERATIVO","VERIFICACIÓN EFICACIA","ÚLTIMO SEGUIMIENTO",
    "PRÓXIMO SEGUIMIENTO","FECHA CIERRE EFECTIVO","OBSERVACIONES",
  ];
  const data = rows.map((row) => {
    const latest=row.followups?.[0];
    const plannedDates=row.plannedActions
      .map((item)=>item.plannedExecutionDate)
      .filter((value): value is Date=>Boolean(value));
    const latestPlanned=plannedDates.length?new Date(Math.max(...plannedDates.map((d)=>d.getTime()))):null;
    const state=row.status==="CLOSED"?"Cerrada":row.status==="CANCELLED"?"Cancelada":"Abierta";
    const efficacy=row.effectivenessStatus==="CONFORMING"?"Conforme":row.effectivenessStatus==="NONCONFORMING"?"No conforme":row.effectivenessStatus==="NA"?"N/A":"Pendiente";
    return [
      row.actionType === "PREVENTIVE" ? "Preventiva" : "Correctiva",
      row.departmentCodeSnapshot ?? "",
      row.qmsRecord.businessCode ?? "",
      row.originType ?? "",
      row.originCode ?? "",
      row.plannedActions.map((item) => item.description).join(" · "),
      date(row.openedAt),
      date(latestPlanned),
      state,
      date(row.operationalClosedAt),
      efficacy,
      latest ? `${String(latest.sequenceNumber).padStart(2,"0")} · ${date(latest.followupDate)}` : "00 · inicial",
      date(latest?.nextFollowupDate ?? null),
      date(row.effectiveClosedAt),
      row.internalObservations ?? "",
    ];
  });
  const inlineCell = (ref: string, value: string, style = 0) =>
    `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
  const rowsXml = [headers, ...data].map((values,rowIndex) => {
    const rowNumber=rowIndex+1;
    const cells=values.map((value,colIndex) => {
      const column=String.fromCharCode(65+colIndex);
      return inlineCell(`${column}${rowNumber}`, String(value), rowIndex===0?1:0);
    }).join("");
    return `<row r="${rowNumber}">${cells}</row>`;
  }).join("");

  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="5" width="22" customWidth="1"/><col min="6" max="6" width="55" customWidth="1"/><col min="7" max="15" width="20" customWidth="1"/></cols><sheetData>${rowsXml}</sheetData><autoFilter ref="A1:O${Math.max(1,data.length+1)}"/></worksheet>`;

  const entries: ZipEntry[]=[
    {name:"[Content_Types].xml",data:Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`)},
    {name:"_rels/.rels",data:Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`)},
    {name:"xl/workbook.xml",data:Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Listado CAPA" sheetId="1" r:id="rId1"/></sheets></workbook>`)},
    {name:"xl/_rels/workbook.xml.rels",data:Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`)},
    {name:"xl/styles.xml",data:Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0"><alignment vertical="center" wrapText="1"/></xf></cellXfs></styleSheet>`)},
    {name:"xl/worksheets/sheet1.xml",data:Buffer.from(sheet)},
  ];
  return writeZip(entries);
}
