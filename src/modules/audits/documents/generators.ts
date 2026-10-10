import { readZip, getZipEntryText, updateZipEntry, writeZip } from "@/lib/ooxml/zip";
import { escapeXml, transformWordCell, setXlsxCell } from "@/lib/ooxml/xml";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { auditDate, auditScenarioLabels } from "../domain";
import { findingTypeLabels, criticalityLabels, actionStatusLabels } from "../finding-domain";
import type { AuditReportSnapshot } from "../report-service";

function styledParagraph(source: string, text: string) {
  const pr = source.match(/<w:pPr[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
  const rp = source.match(/<w:rPr[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
  return text.split(/\r?\n/).map(t => `<w:p>${pr}<w:r>${rp}<w:t xml:space="preserve">${escapeXml(t)}</w:t></w:r></w:p>`).join("");
}
function cellText(cell: string, text: string) {
  const open = cell.match(/^<w:tc(?:\s[^>]*)?>/)![0], pr = cell.match(/<w:tcPr[\s\S]*?<\/w:tcPr>/)?.[0] ?? "";
  return `${open}${pr}${styledParagraph(cell, text)}</w:tc>`;
}
function fill(xml: string, table: number, row: number, col: number, text: string) { return transformWordCell(xml, table, row, col, c => cellText(c, text)); }
function cloneRows(xml: string, table: number, row: number, values: string[][], replaceRemainder = false) {
  let ti = 0;
  return xml.replace(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, t => {
    if (ti++ !== table) return t;
    let ri = 0;
    return t.replace(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, r => {
      const currentRow = ri++;
      if (replaceRemainder && currentRow > row) return "";
      if (currentRow !== row) return r;
      return (values.length ? values : [["", ""]]).map(v => { let ci = 0; return r.replace(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g, c => cellText(c, v[ci++] ?? "")); }).join("");
    });
  });
}
const plain = (p: string) => [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join("").replace(/\s+/g, " ").trim();
function section(xml: string, heading: string, text: string) {
  let found = false, filled = false;
  const result = xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, p => {
    if (!found && plain(p) === heading) { found = true; return p; }
    if (found && !filled && !plain(p) && !p.includes("<w:drawing")) { filled = true; return styledParagraph(p, text); }
    return p;
  });
  if (!filled) throw new Error(`Sección controlada no encontrada: ${heading}`);
  return result;
}
function bodyBlocks(body: string) {
  const out: string[] = []; let depth = 0, start = 0;
  for (const m of body.matchAll(/<\/?(?:w:p|w:tbl|w:sectPr)(?:\s[^>]*)?>/g)) {
    if (m[0].endsWith('/>')) continue;
    if (m[0].startsWith('</')) { if (--depth === 0) out.push(body.slice(start, m.index! + m[0].length)); }
    else { if (depth++ === 0) start = m.index!; }
  }
  if (depth !== 0) throw new Error('El DOCX controlado contiene bloques no equilibrados.');
  return out;
}

/**
 * The approved external-report Word template splits "AE/XXXX/YY/AAAA"
 * across several w:t runs in both footer parts. Edit only their text,
 * preserving the run properties, layout, page fields and controlled PNT header.
 */
function replaceExternalFooterMarker(xml: string, code: string) {
  const marker = "AE/XXXX/YY/AAAA";
  let replacements = 0;
  const output = xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, original => {
    const tokens = [...original.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)];
    const combined = tokens.map(token => token[1]).join("");
    const markerStart = combined.indexOf(marker);
    if (markerStart < 0) return original;
    if (combined.indexOf(marker, markerStart + marker.length) !== -1)
      throw new Error("Pie de página: marcador de auditoría duplicado en el mismo párrafo.");
    const markerEnd = markerStart + marker.length;
    const patches: { start: number; end: number; text: string }[] = [];
    let offset = 0;
    for (const token of tokens) {
      const start = offset, end = start + token[1].length;
      offset = end;
      if (end <= markerStart || start >= markerEnd) continue;
      const localStart = Math.max(0, markerStart - start);
      const localEnd = Math.min(end, markerEnd) - start;
      const replacement = start <= markerStart && markerStart < end ? escapeXml(code) : "";
      const value = token[1].slice(0, localStart) + replacement + token[1].slice(localEnd);
      const textStart = token.index! + token[0].indexOf(">") + 1;
      patches.push({ start: textStart, end: textStart + token[1].length, text: value });
    }
    let updated = original;
    for (const patch of patches.reverse())
      updated = updated.slice(0, patch.start) + patch.text + updated.slice(patch.end);
    replacements += 1;
    return updated;
  });
  return { xml: output, replacements };
}
function fillExternalReportFooters(entries: ReturnType<typeof readZip>, code: string) {
  const footers = entries.filter(entry => /^word\/footer\d+\.xml$/.test(entry.name));
  if (!footers.length) return; // Minimal synthetic templates have no footer parts.
  let filled = 0;
  for (const footer of footers) {
    const result = replaceExternalFooterMarker(footer.data.toString("utf8"), code);
    if (result.replacements) updateZipEntry(entries, footer.name, result.xml);
    filled += result.replacements;
  }
  if (!filled) throw new Error("La plantilla externa no contiene el código editable esperado en los pies de página.");
}

export function generateAuditReport(template: Buffer, s: AuditReportSnapshot, sequence: number) {
  const a = s.audit, supplier = a.scenario === "SUPPLIER";
  if (a.scenario === "CLIENT" || a.scenario === "AUTHORITY") throw new Error("El documento primario de cliente/autoridad es recibido, no un informe COVEX artificial.");
  const entries = readZip(template); let xml = getZipEntryText(entries, "word/document.xml");
  if (!xml.includes(supplier ? "EXTERNA" : "INTERNA")) throw new Error("La plantilla no corresponde al escenario.");
  const dates = [a.performedDate, a.reportDate].map(d => d ? auditDate(d) : "");
  xml = fill(xml, 1, 0, 1, supplier ? a.auditedEntityName ?? "" : a.departments.filter(d => d.isActive).map(d => `${d.departmentCodeSnapshot} · ${d.departmentNameSnapshot}`).join("; "));
  xml = fill(xml, 1, 0, 3, dates[0]); xml = fill(xml, 1, 1, 1, a.qmsRecord.businessCode ?? a.externalReference ?? "");
  xml = fill(xml, 1, 1, 3, dates[1]); xml = fill(xml, 1, 1, 5, String(sequence).padStart(2, "0"));
  if (supplier) { xml = fill(xml, 1, 2, 1, a.supplierType ?? ""); xml = fill(xml, 1, 3, 1, a.auditedEntityAddress ?? ""); xml = fill(xml, 1, 4, 1, a.auditedContact ?? ""); }
  xml = fill(xml, 1, supplier ? 5 : 2, 1, [a.title, a.scope].filter(Boolean).join("\n"));
  const team = (auditee: boolean) => a.participants.filter(p => p.isActive && (auditee ? p.role === "AUDITEE" : p.role !== "AUDITEE")).map(p => [p.displayName, [p.position, p.organization].filter(Boolean).join(" · ")]);
  xml = cloneRows(xml, 1, supplier ? 12 : 9, team(false)); xml = cloneRows(xml, 1, supplier ? 9 : 6, team(true));
  for (const [col, name, position] of [[0,a.preparedBy,a.preparedPosition],[1,a.reviewedBy,a.reviewedPosition],[2,a.receivedBy,a.receivedPosition]] as const) xml = fill(xml, 2, 1, col, `Nombre y Apellidos: ${name ?? ""}\nPosición: ${position ?? ""}\nFecha:\nFirma:`);
  const findings = a.findings.filter(f => f.isActive);
  for (const [row, criticality] of [[6,"MINOR"],[4,"MAJOR"],[2,"CRITICAL"]] as const) xml = cloneRows(xml, 4, row, findings.filter(f => f.findingType !== "RECOMMENDATION" && f.criticality === criticality).map(f => [f.reference, f.description]));
  xml = section(xml, "RECOMENDACIONES:", findings.filter(f => f.findingType === "RECOMMENDATION").map(f => `${f.reference}: ${f.description}`).join("\n"));
  xml = xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, p => /^Rk\s*XX\s*:/.test(plain(p)) ? styledParagraph(p, "") : p);
  xml = section(xml, "ANTECEDENTE DE AUDITORÍAS ANTERIORES", a.previousAuditBackground ?? "");
  xml = section(xml, "HALLAZGOS DE LA AUDITORÍA", findings.map(f => `${f.reference} · ${findingTypeLabels[f.findingType]} · ${criticalityLabels[f.criticality]}\n${f.description}\nCriterio: ${f.criterionReference ?? ""}\nEvidencia: ${f.objectiveEvidence ?? ""}\nTratamiento: ${f.treatment ?? ""}`).join("\n\n"));
  xml = xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, p => plain(p).startsWith("Ejemplo") ? styledParagraph(p, "") : p);
  xml = section(xml, "CONCLUSIÓN", a.conclusion ?? ""); xml = section(xml, "ANEXO I: PROGRAMA DE AUDITORÍA", a.programme ?? "");
  if (supplier) {
    const auditCode = a.qmsRecord.businessCode ?? a.externalReference;
    if (!auditCode) throw new Error("El informe externo requiere un código de auditoría para completar el pie de página.");
    fillExternalReportFooters(entries, auditCode);
  }
  updateZipEntry(entries, "word/document.xml", xml); sanitizeOfficeMetadata(entries); return writeZip(entries);
}
export function generateAuditExternalPlan(template: Buffer, s: AuditReportSnapshot) {
  const a = s.audit;
  if (a.scenario !== "SUPPLIER") throw new Error("El Plan externo solo aplica a proveedor/tercero.");
  if (!a.auditedEntityName || !a.plannedDate || !a.scope || !a.programme || !a.activityDuration || !a.planIntroduction) throw new Error("Completa entidad, fecha prevista, introducción, alcance, duración y programa para generar el Plan.");
  const entries = readZip(template); let xml = getZipEntryText(entries, "word/document.xml");
  const bodyStart = xml.indexOf("<w:body>") + 8, bodyEnd = xml.lastIndexOf("</w:body>");
  const body = xml.slice(bodyStart, bodyEnd), blocks = bodyBlocks(body);
  const start = blocks.findIndex(p => /^Anexo IV:\s*Plan de Auditoría/.test(plain(p)));
  if (start < 0) throw new Error("El PNT no contiene el Anexo IV controlado esperado.");
  xml = xml.slice(0, bodyStart) + blocks.slice(start).join("") + xml.slice(bodyEnd);
  for (const [prefix, value] of [["Entidad Auditada:", a.auditedEntityName],["Fecha:",auditDate(a.plannedDate)],["Lugar de auditoría:",a.auditedEntityAddress ?? ""]]) {
    let done = false; xml = xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, p => !done && plain(p).startsWith(prefix) ? (done = true, styledParagraph(p, `${prefix} ${value}`)) : p);
  }
  for (const [heading, value] of [["INTRODUCCIÓN",a.planIntroduction],["OBJETIVO/ALCANCE DE LA AUDITORIA",a.scope],["PERSONAL RESPONSABLE DEL DEPARTAMENTO AUDITADO",a.participants.filter(p=>p.isActive&&p.role==='AUDITEE').map(p=>p.displayName).join("; ")],["EQUIPO AUDITOR",a.participants.filter(p=>p.isActive&&p.role!=='AUDITEE').map(p=>p.displayName).join("; ")],["DURACION DE CADA ACTIVIDAD",a.activityDuration],["ELABORACIÓN Y DISTRIBUCIÓN DEL INFORME DE AUDITORIA",a.reportDistribution ?? ""]]) xml = section(xml,heading,value);
  xml = cloneRows(xml,0,1,(a.programme ?? "").split(/\r?\n/).filter(Boolean).map(line=>{ const [time,...activity]=line.split("|"); return [activity.length ? time.trim() : "", activity.length ? activity.join("|").trim() : time]; }), true);
  // The PNT's example working times and personal names are not audit data.
  xml = xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g,p=>plain(p).startsWith("Durante el horario laboral de XX") ? styledParagraph(p,"") : p);
  updateZipEntry(entries,"word/document.xml",xml); sanitizeOfficeMetadata(entries); return writeZip(entries);
}
export function auditCapaPlanRows(s: AuditReportSnapshot) {
  return s.audit.findings.filter(f=>f.isActive).map(f=>{
    const actions=f.actions.filter(a=>a.isActive);
    const codes=f.relations.filter(r=>r.isActive&&r.qmsRelation.isActive).map(r=>r.qmsRelation.targetRecord.businessCode ?? r.qmsRelation.targetRecord.annulledBusinessCode).filter(Boolean);
    return [f.reference,findingTypeLabels[f.findingType],f.description,criticalityLabels[f.criticality],codes.join("; "),[f.treatment,...actions.map(a=>a.description)].filter(Boolean).join("\n"),actions.map(a=>a.responsible).filter(Boolean).join("\n"),actions.map(a=>a.targetDate ? auditDate(a.targetDate):"").join("\n"),actions.length ? actions.map(a=>actionStatusLabels[a.status]).join("\n") : actionStatusLabels[f.treatmentStatus],actions.length ? actions.map(a=>a.closedAt?auditDate(a.closedAt):"").join("\n") : f.closedAt?auditDate(f.closedAt):"",[f.evidence,f.evidenceReference,f.verificationComment,...actions.flatMap(a=>[a.evidence,a.evidenceReference,a.verificationComment])].filter(Boolean).join("\n")];
  });
}

// An official workbook can omit physically empty cells. The controlled row,
// existing cell styling and merged cells must still be respected.
function capaCellPosition(ref: string) {
  const match = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!match) throw new Error("Referencia Excel CAPA Plan no válida.");
  const column = [...match[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
  return { column, row: Number(match[2]) };
}
function isMergedFollower(sheet: string, ref: string) {
  const cell = capaCellPosition(ref);
  for (const match of sheet.matchAll(/<mergeCell\b[^>]*\bref="([A-Z]+\d+:[A-Z]+\d+)"[^>]*\/>/g)) {
    const [first,last] = match[1].split(":");
    const a = capaCellPosition(first), b = capaCellPosition(last);
    if (cell.row >= a.row && cell.row <= b.row && cell.column >= a.column && cell.column <= b.column && ref !== first) return true;
  }
  return false;
}
function writeCapaCell(sheet: string, ref: string, value: string) {
  if (new RegExp('<c\\b[^>]*\\br="' + ref + '"(?:\\s|>)').test(sheet)) return setXlsxCell(sheet, ref, value);
  if (isMergedFollower(sheet, ref)) throw new Error("CAPA Plan: la dirección " + ref + " está dentro de una celda combinada; revisa la plantilla.");
  const position = capaCellPosition(ref);
  const rowRegex = new RegExp('<row\\b(?=[^>]*\\br="' + position.row + '")[^>]*>[\\s\\S]*?<\\/row>');
  const match = sheet.match(rowRegex);
  if (!match) throw new Error("CAPA Plan: falta la fila controlada " + position.row + " (" + ref + ").");
  const original = match[0];
  const cells = [...original.matchAll(/<c\b([^>]*\br="([A-Z]+)\d+"[^>]*)(?:\/>|>[\s\S]*?<\/c>)/g)];
  const next = cells.find(c => capaCellPosition(c[2] + "1").column > position.column);
  const previous = [...cells].reverse().find(c => capaCellPosition(c[2] + "1").column < position.column);
  const donor = previous ?? next;
  const style = donor?.[1].match(/\bs="(\d+)"/)?.[1];
  const cell = '<c r="' + ref + '"' + (style ? ' s="' + style + '"' : '') + '></c>';
  const insertion = next ? next.index! : original.lastIndexOf("</row>");
  const expanded = original.slice(0, insertion) + cell + original.slice(insertion);
  return setXlsxCell(sheet.replace(original, expanded), ref, value);
}

export function generateAuditCapaPlan(template: Buffer, s: AuditReportSnapshot, sequence: number | null) {
  const entries=readZip(template), a=s.audit;
  // Normalize empty cells before using the shared setter: a self-closing cell
  // must not consume the following labelled cell as its closing block.
  let sheet=getZipEntryText(entries,"xl/worksheets/sheet1.xml").replace(/<c\b([^>]*?)\/>/g,'<c$1></c>');
  const values: Record<string,string> = { C5:a.qmsRecord.businessCode ?? a.externalReference ?? "", F5:a.scenario?auditScenarioLabels[a.scenario]:"", I5:a.performedDate?auditDate(a.performedDate):"", C6:a.auditedEntityName ?? a.departments.filter(d=>d.isActive).map(d=>d.departmentNameSnapshot).join("; "), F6:a.title ?? "", I6:a.reportDate?auditDate(a.reportDate):"", C7:a.auditingEntityName ?? "", F7:a.referenceText ?? a.externalReference ?? "", I7:a.capaPlanDate?auditDate(a.capaPlanDate):"", K7:sequence===null?"Estado actual":String(sequence).padStart(2,"0") };
  for(const [ref,value] of Object.entries(values)) sheet=writeCapaCell(sheet,ref,value);
  const rows=auditCapaPlanRows(s), count=Math.max(10,rows.length), delta=count-10;
  const pattern=/<row\b[^>]*\br="11"[^>]*>[\s\S]*?<\/row>/, templateRow=sheet.match(pattern)?.[0];
  if(!templateRow)throw new Error("Falta la fila controlada del CAPA Plan.");
  // Move the signatures and all references below the expandable table together.
  if(delta) sheet=sheet.replace(/\b(r|ref|sqref)="([^"]+)"/g,(_m,key,value)=>`${key}="${/^\d+$/.test(value) ? Number(value)>=21?Number(value)+delta:value : String(value).replace(/([A-Z]+)(\d+)/g,(_m,c,n)=>`${c}${Number(n)>=21?Number(n)+delta:n}`)}"`);
  const xmlRows=Array.from({length:count},(_,i)=>{
    let row=templateRow.replace(/\br="([A-Z]*)(\d+)"/g,(_m,c)=>`r="${c}${11+i}"`);
    for(let c=0;c<11;c++)row=writeCapaCell(row,`${String.fromCharCode(65+c)}${11+i}`,rows[i]?.[c] ?? "");
    // Fixed source height clips/overlaps populated wrapped cells. Let Office
    // calculate the height from the existing widths, fonts and wrap styles.
    if (rows[i]) row=row.replace(/\s(?:ht|customHeight)="[^"]*"/g,"");
    return row;
  }).join("");
  // The source's implicit one-page height makes a long populated plan tiny.
  // Keep one page across its existing columns and allow vertical pagination.
  if (rows.length) sheet=sheet.replace(/<pageSetup\b([^>]*)\/>/,(_m,attributes)=>`<pageSetup${attributes.replace(/\sfitTo(?:Width|Height)="[^"]*"/g,"")} fitToWidth="1" fitToHeight="0"/>`);
  if (delta) {
    sheet=sheet.replace(/(<autoFilter\b[^>]*ref="A10:K)20"/,`$1${20+delta}"`).replace(/(<xm:sqref>[BDI]11:[BDI])20(<\/xm:sqref>)/g,`$1${20+delta}$2`);
    const workbook=getZipEntryText(entries,"xl/workbook.xml").replace(/(\$A\$10:\$K\$)20/g,`$1${20+delta}`);
    updateZipEntry(entries,"xl/workbook.xml",workbook);
  }
  sheet=sheet.replace(/<row\b[^>]*\br="(?:1[1-9]|20)"[^>]*>[\s\S]*?<\/row>/g,"").replace("</sheetData>","</sheetData>");
  const firstFooter=[...sheet.matchAll(/<row\b[^>]*\br="(\d+)"/g)].find(m=>Number(m[1])>=21+delta); const insert=firstFooter?.index ?? -1;
  if(insert<0)throw new Error("Falta el bloque de firmas del CAPA Plan.");
  sheet=sheet.slice(0,insert)+xmlRows+sheet.slice(insert);
  for (const [ref,value] of [[`A${24+delta}`,`Nombre y apellidos: ${a.preparedBy ?? ""}`],[`F${24+delta}`,`Nombre y apellidos: ${a.reviewedBy ?? ""}`],[`A${25+delta}`,`Puesto: ${a.preparedPosition ?? ""}`],[`F${25+delta}`,`Puesto: ${a.reviewedPosition ?? ""}`]]) sheet=writeCapaCell(sheet,ref,value);
  updateZipEntry(entries,"xl/worksheets/sheet1.xml",sheet);sanitizeOfficeMetadata(entries);return writeZip(entries);
}
