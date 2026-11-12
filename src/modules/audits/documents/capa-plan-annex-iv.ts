import { readZip, getZipEntryText, updateZipEntry, writeZip } from "@/lib/ooxml/zip";
import { setXlsxCell } from "@/lib/ooxml/xml";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { auditDate } from "../domain";
import { capaPlanAuditTypeLabels, capaPlanBlocks, type CapaPlanBlock } from "../capa-plan-annex";
import { readSignatories, signatoryRoleLabels, type SignatoryRole } from "../signatories";
import type { AuditReportSnapshot } from "../report-service";

/**
 * D-136 (R6): plan CAPA con la plantilla del Anexo IV (PNT GC-00/033/04). Se reconoce por las columnas
 * «Causa Raíz» y «Código CAPA» y el bloque «Acciones / Justificación /Observaciones».
 */
export function isAnnexIVCapaPlan(sheet: string, sharedStrings = "") {
  const text = sheet + sharedStrings;
  return text.includes("Causa Raíz") && text.includes("Código CAPA") && /Acciones \/ Justificaci[oó]n/.test(text);
}

// Primero las filas vacías autocerradas, para que una no se trague la siguiente.
const rowsOf = (sheet: string) => [...sheet.matchAll(/<row\b[^>]*\/>|<row\b[^>]*>[\s\S]*?<\/row>/g)].map(m => ({ n: Number(m[0].match(/^<row\b[^>]*\br="(\d+)"/)?.[1]), xml: m[0] }));
/** Copia una fila de la plantilla a otra posición, con sus estilos. */
function renumber(row: string, from: number, to: number) {
  return row.replace(new RegExp(`(<row\\b[^>]*\\br=")${from}(")`), `$1${to}$2`).replace(new RegExp(`(<c\\b[^>]*\\br="[A-Z]+)${from}(")`, "g"), `$1${to}$2`);
}
/** Excel no admite filas de más de 409 pt. */
const withHeight = (row: string, height: number) => row.replace(/\s(?:ht|customHeight)="[^"]*"/g, "").replace(/^<row\b/, `<row ht="${Math.min(409, height)}" customHeight="1"`);
/** Sin caracteres de control (XML inválido) y sin pasar del máximo de una casilla de Excel. */
const clean = (v: string) => v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, 32767);
const put = (xml: string, ref: string, value: string | number) => setXlsxCell(xml, ref, typeof value === "string" ? clean(value) : value);
/** Líneas que ocupa un texto en una columna de `chars` caracteres de ancho (aproximado, para la altura de fila). */
function lines(text: string, chars: number) {
  return text ? text.split("\n").reduce((n, line) => n + Math.max(1, Math.ceil(line.length / chars)), 0) : 1;
}
const LINE = 16;
/** Las casillas de fecha de la plantilla tienen formato de fecha: dd/mm/aaaa se escribe como fecha de Excel. */
function excelDate(value: string): string | number {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? Math.round((Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) - Date.UTC(1899, 11, 30)) / 86400000) : value;
}

/**
 * Cabecera, un bloque por hallazgo y firmas. En cada bloque las columnas del hallazgo (Nº, tipo, descripción,
 * desviación y causa raíz) quedan combinadas en vertical sobre sus filas de CAPA; debajo, la fila de rótulos y la de
 * «Acciones / Justificación / Observaciones» y «Evidencias». La plantilla trae tres bloques de ejemplo de tres filas
 * (8–16): se sustituyen por los generados y lo que sigue (FIRMAS) se desplaza.
 */
export function generateAnnexIVCapaPlan(template: Buffer, s: AuditReportSnapshot, sequence: number | null) {
  const entries = readZip(template), a = s.audit;
  let sheet = getZipEntryText(entries, "xl/worksheets/sheet1.xml").replace(/<c\b([^>]*?)\/>/g, "<c$1></c>");
  const rows = rowsOf(sheet), row = (n: number) => rows.find(r => r.n === n)?.xml;
  const [data, labels, values, gap, signTitle, signs] = [8, 9, 10, 17, 18, 19].map(row);
  if (!data || !labels || !values || !gap || !signTitle || !signs) throw new Error("Plan CAPA (Anexo IV): estructura de la plantilla no compatible.");
  const area = a.scenario === "SUPPLIER" || a.scenario === "CLIENT" || a.scenario === "AUTHORITY"
    ? a.auditedEntityName || a.title || ""
    : a.departments.filter(d => d.isActive).map(d => d.departmentNameSnapshot).join(", ") || a.title || "";
  const auditing = a.auditingEntityName || (a.scenario === "INTERNAL_COVEX" || a.scenario === "SUPPLIER" ? "COVEX" : "");
  const header: Record<string, string> = {
    C4: area, E4: a.qmsRecord.businessCode ?? a.externalReference ?? "", H4: a.performedDate ? auditDate(a.performedDate) : "",
    J4: sequence === null ? "" : String(sequence).padStart(2, "0"),
    C5: a.scenario ? capaPlanAuditTypeLabels[a.scenario] : "", E5: auditing, H5: a.reportDate ? auditDate(a.reportDate) : "",
  };
  const top = rows.filter(r => r.n < 8).map(r => r.xml).join("");
  let headerXml = top;
  for (const [ref, value] of Object.entries(header)) {
    if (!new RegExp(`<c\\b[^>]*\\br="${ref}"`).test(headerXml)) throw new Error(`Plan CAPA (Anexo IV): falta la casilla ${ref}.`);
    headerXml = put(headerXml, ref, value);
  }

  const blocks: CapaPlanBlock[] = capaPlanBlocks(s.audit.findings as never, s.capaPlan);
  // Sin hallazgos se conserva un bloque vacío, como en la plantilla.
  const list = blocks.length ? blocks : [{ reference: "", criticality: "", description: "", deviations: "", rootCause: "", rows: [{ code: "", responsible: "", plannedDate: "", status: "", closedAt: "" }], actions: "", evidence: "" }];
  const generated: string[] = [], merges: string[] = [], bRefs: string[] = [], iRefs: string[] = [];
  let at = 8;
  for (const block of list) {
    const first = at, k = block.rows.length;
    // Altura: lo que ocupan las columnas combinadas se reparte entre las filas de CAPA.
    const shared = Math.max(lines(block.description, 60), lines(block.rootCause, 25), lines(block.deviations, 25));
    block.rows.forEach((r, i) => {
      let xml = renumber(data, 8, at);
      const own = Math.max(lines(r.responsible, 22), lines(r.code, 25));
      xml = withHeight(xml, Math.max(48, Math.ceil((shared * LINE) / k), own * LINE));
      // En las filas siguientes, A–E quedan bajo la combinación: se vacían.
      const cells: Record<string, string> = i === 0
        ? { A: block.reference, B: block.criticality, C: block.description, D: block.deviations, E: block.rootCause }
        : { A: "", B: "", C: "", D: "", E: "" };
      Object.assign(cells, { F: r.code, G: r.responsible, H: r.plannedDate, I: r.status, J: r.closedAt });
      for (const [col, value] of Object.entries(cells)) xml = put(xml, `${col}${at}`, col === "H" || col === "J" ? excelDate(value) : value);
      generated.push(xml); iRefs.push(`I${at}`); at++;
    });
    bRefs.push(`B${first}`);
    if (k > 1) for (const col of ["B", "C", "D", "E"]) merges.push(`${col}${first}:${col}${first + k - 1}`);
    generated.push(renumber(labels, 9, at));
    merges.push(`B${at}:G${at}`, `H${at}:J${at}`); at++;
    let valueRow = renumber(values, 10, at);
    valueRow = withHeight(valueRow, Math.max(53.25, (Math.max(lines(block.actions, 170), lines(block.evidence, 65)) + 1) * LINE));
    valueRow = put(put(valueRow, `B${at}`, block.actions), `H${at}`, block.evidence);
    generated.push(valueRow);
    merges.push(`B${at}:G${at}`, `H${at}:J${at}`, `A${first}:A${at}`); at++;
  }
  const signatories = readSignatories(a.signatories).filter(x => x.document === "CAPA_PLAN");
  const signText = (["PREPARED", "REVIEWED", "APPROVED"] as SignatoryRole[]).map(role => {
    const people = signatories.filter(x => x.role === role).map(x => x.position ? `${x.name} (${x.position})` : x.name);
    return `${signatoryRoleLabels[role]}: ${people.join("; ")}`;
  }).join("     ·     ");
  const footer = [renumber(gap, 17, at), renumber(signTitle, 18, at + 1), put(renumber(signs, 19, at + 2), `A${at + 2}`, signText)];
  const last = at + 2;
  merges.push(`A${at + 1}:J${at + 1}`, `A${at + 2}:J${at + 2}`);
  // Se corta y pega en vez de usar replace con texto: un «$» del usuario se interpretaría como patrón.
  const dataStart = sheet.indexOf("<sheetData>"), dataEnd = sheet.lastIndexOf("</sheetData>");
  if (dataStart < 0 || dataEnd < 0) throw new Error("Plan CAPA (Anexo IV): falta la tabla de la hoja.");
  sheet = sheet.slice(0, dataStart) + `<sheetData>${headerXml}${generated.join("")}${footer.join("")}` + sheet.slice(dataEnd);
  // Combinaciones de la cabecera (filas 1–7) más las generadas.
  const kept = [...sheet.matchAll(/<mergeCell\b[^>]*\bref="([A-Z]+)(\d+):([A-Z]+)(\d+)"[^>]*\/>/g)].filter(m => Number(m[4]) < 8).map(m => m[1] + m[2] + ":" + m[3] + m[4]);
  const all = [...kept, ...merges];
  sheet = sheet.replace(/<mergeCells\b[^>]*>[\s\S]*?<\/mergeCells>/, () => `<mergeCells count="${all.length}">${all.map(r => `<mergeCell ref="${r}"/>`).join("")}</mergeCells>`);
  // Listas desplegables de «Tipo / criticidad» y «Estado» en las filas generadas.
  sheet = sheet.replace(/(<dataValidation\b[^>]*\bsqref=")([^"]*)("[^>]*>\s*<formula1>"Crítica,Mayor,Menor,Recomendación"<\/formula1>)/, `$1${bRefs.join(" ")}$3`)
    .replace(/(<dataValidation\b[^>]*\bsqref=")([^"]*)("[^>]*>\s*<formula1>"Abierta,Pendiente,Cerrada"<\/formula1>)/, `$1${iRefs.join(" ")}$3`);
  sheet = sheet.replace(/<dimension ref="A1:([A-Z]+)\d+"\/>/, `<dimension ref="A1:$1${last}"/>`);
  updateZipEntry(entries, "xl/worksheets/sheet1.xml", sheet);
  const workbook = getZipEntryText(entries, "xl/workbook.xml").replace(/(_xlnm\.Print_Area"[^>]*>[^<]*\$A\$1:\$J\$)\d+/, `$1${last}`);
  updateZipEntry(entries, "xl/workbook.xml", workbook);
  sanitizeOfficeMetadata(entries);
  return writeZip(entries);
}
