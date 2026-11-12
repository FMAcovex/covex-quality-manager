import { readZip, writeZip, updateZipEntry, getZipEntryText } from "@/lib/ooxml/zip";
import { applyValueMarks, escapeXml, markValue, markValueLines } from "@/lib/ooxml/xml";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { externalProgrammeNotes, type ProgrammeContent } from "./domain";

const visible = (xml: string) => [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join("").replace(/\s+/g, " ").trim();
function paragraph(source: string, value: string) {
  const pp = source.match(/<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
  const rp = source.match(/<w:rPr(?:\s[^>]*)?>[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
  return value.split(/\r?\n/).map(line => `<w:p>${pp}<w:r>${rp}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`).join("");
}
function cell(source: string, value: string) {
  const open = source.match(/^<w:tc(?:\s[^>]*)?>/)?.[0];
  if (!open) throw Error("Celda de programa no compatible.");
  const pr = source.match(/<w:tcPr(?:\s[^>]*)?>[\s\S]*?<\/w:tcPr>/)?.[0] ?? "";
  return `${open}${pr}${paragraph(source, value)}</w:tc>`;
}
function row(source: string, values: string[]) {
  let index = 0;
  // Let long editable contents expand; fixed heights in the source are minima.
  const filled = source.replace(/<w:trHeight\b[^>]*\/>/g, height => height.replace(/w:hRule="exact"/, 'w:hRule="atLeast"')).replace(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g, c => cell(c, values[index++] ?? ""));
  if (index !== values.length) throw Error("Número de columnas de programa no compatible.");
  return filled;
}
function blocks(body: string) {
  const out: string[] = []; let depth = 0, start = 0;
  for (const match of body.matchAll(/<\/?(?:w:p|w:tbl|w:sectPr)(?:\s[^>]*)?>/g)) {
    if (match[0].endsWith("/>")) continue;
    if (match[0].startsWith("</")) { if (--depth === 0) out.push(body.slice(start, match.index! + match[0].length)); }
    else if (depth++ === 0) start = match.index!;
  }
  if (depth) throw Error("Bloques de plantilla no equilibrados.");
  return out;
}
/** Extract only Annex I, while retaining section resources, original header/footer and logo relationships. */
export function extractExternalProgramme(xml: string) {
  const start = xml.indexOf("<w:body>"), end = xml.lastIndexOf("</w:body>");
  if (start < 0 || end < 0) throw Error("Plantilla Word no compatible.");
  const body = blocks(xml.slice(start + 8, end));
  const marker = body.findIndex(b => visible(b) === "ANEXO I");
  if (marker < 0 || !body.slice(marker).some(b => visible(b).includes("COMPAÑÍA"))) throw Error("Anexo I del PMAE V05 no encontrado.");
  let section = body.slice(marker).find(b => b.startsWith("<w:sectPr"));
  if (!section) throw Error("Sección del Anexo I no encontrada.");
  // Headers/footers can be inherited from preceding sections in the full master.
  for (const kind of ["headerReference", "footerReference"]) {
    if (!section.includes(`<w:${kind}`)) {
      const refs = [...xml.slice(0, start + 8 + xml.slice(start + 8, end).indexOf(body[marker])).matchAll(new RegExp(`<w:${kind}\\b[^>]*/>`, "g"))].map(m => m[0]);
      const latest = new Map<string, string>();
      for (const ref of refs) latest.set(ref.match(/w:type="([^"]+)"/)?.[1] ?? "default", ref);
      section = section.replace(/(<w:sectPr[^>]*>)/, `$1${[...latest.values()].join("")}`);
    }
  }
  // This is an independent annex, not page 11 of a reissued master.
  section = section.replace(/<w:pgNumType\b[^>]*\/>/g, "").replace(/<\/w:sectPr>/, '<w:pgNumType w:start="1"/></w:sectPr>');
  const selected = body.slice(marker).filter(b => !b.startsWith("<w:sectPr")).map(b => b.replace(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g, "").replace(/<w:br\b[^>]*w:type="page"[^>]*\/>/g, ""));
  return xml.slice(0, start + 8) + selected.join("") + section + xml.slice(end);
}
/** Sustituye solo las celdas indicadas de una fila, con el formato de cada celda original. */
function fillCells(source: string, values: Record<number, string>) {
  let index = 0;
  return source.replace(/<w:trHeight\b[^>]*\/>/g, height => height.replace(/w:hRule="exact"/, 'w:hRule="atLeast"'))
    .replace(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g, c => { const i = index++; return i in values ? cell(c, values[i]) : c; });
}
const tableRows = (table: string) => [...table.matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)].map(m => m[0]);
/** D-135 (R6): plantilla del Anexo V de los PNT GC-00/033/04 y GC-00/034/05 («Área / Entidad y alcance»). */
export function isAnnexVProgramme(xml: string) {
  return /(?:Área|Entidad) y alcance/.test(visible(xml));
}
/**
 * D-135 (R6): Anexo V. Año y versión arriba; una fila por auditoría con «Área / Entidad y alcance», fecha prevista,
 * equipo auditor, código, fecha de auditoría, fecha de cierre parcial y comentarios; en externas, una banda AMBITO
 * por ámbito. Firmas: nombre de quien elabora y de quien aprueba; firma y fecha quedan para Word.
 */
function fillAnnexV(xml: string, content: ProgrammeContent, sequence: number) {
  const internal = content.auditType === "INTERNAL";
  if (!visible(xml).includes(internal ? "PROGRAMA ANUAL DE AUDITORÍAS INTERNAS" : "PROGRAMA ANUAL DE AUDITORÍAS EXTERNAS")) throw Error("La plantilla del Anexo V no corresponde a este tipo de programa.");
  let head = 0, main = 0, signatures = 0;
  xml = xml.replace(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, table => {
    const rows = tableRows(table), text = visible(table), prefix = table.slice(0, table.indexOf(rows[0]));
    if (/^Año:/.test(text) && text.includes("Versión:")) {
      head++;
      if (rows.length !== 1 || [...rows[0].matchAll(/<w:tc(?:\s[^>]*)?>/g)].length !== 4) throw Error("Cabecera de año y versión no compatible.");
      return prefix + fillCells(rows[0], { 1: markValue(String(content.year)), 3: markValue(String(sequence).padStart(2, "0")) }) + "</w:tbl>";
    }
    if (/(?:Área|Entidad) y alcance/.test(text)) {
      main++;
      const columns = (r: string) => [...r.matchAll(/<w:tc(?:\s[^>]*)?>/g)].length;
      const isBand = (r: string) => visible(r).startsWith("AMBITO");
      if (rows.length < 3 || columns(rows[1]) !== 8) throw Error("Tabla del programa no compatible.");
      const style = rows.slice(2).find(r => !isBand(r) && columns(r) === 8);
      if (!style) throw Error("Fila de programa no encontrada.");
      const line = (r: ProgrammeContent["rows"][number], n: number) => fillCells(style, Object.fromEntries([
        String(n), (internal ? [r.target, r.scope] : [r.target, r.productService, r.scope]).filter(Boolean).join("\n"), r.planned, r.auditors, r.code, r.performed, r.partial, r.comments,
      ].map((v, i) => [i, markValueLines(v)])));
      let data = "", n = 0;
      if (internal) content.rows.forEach(r => { data += line(r, ++n); });
      else {
        const bands = rows.slice(2).filter(isBand);
        if (!bands.length) throw Error("Banda de ámbito del programa externo no encontrada.");
        // La primera banda de la plantilla repite como cabecera; las bandas generadas no.
        const band = (bands.find(b => !b.includes("<w:tblHeader")) ?? bands[0]).replace(/<w:tblHeader\/>/g, "");
        const groups = new Map<string, ProgrammeContent["rows"]>();
        for (const r of content.rows) { const g = r.area || "Sin especificar"; groups.set(g, [...(groups.get(g) ?? []), r]); }
        for (const [area, items] of groups) { data += fillCells(band, { 0: `AMBITO ${markValue(area)}` }); items.forEach(r => { data += line(r, ++n); }); }
      }
      return prefix + rows[0] + rows[1] + data + "</w:tbl>";
    }
    if (text.startsWith("Función") && text.includes("Elaborado por") && text.includes("Aprobado por")) {
      signatures++;
      return prefix + rows.map(r => visible(r).startsWith("Elaborado por") ? fillCells(r, { 1: markValueLines(content.preparedByName) }) : visible(r).startsWith("Aprobado por") ? fillCells(r, { 1: markValueLines(content.qualityApproverName) }) : r).join("") + "</w:tbl>";
    }
    return table;
  });
  if (head !== 1 || main !== 1 || signatures !== 1) throw Error("Tablas oficiales del Anexo V no encontradas una sola vez.");
  // La instrucción de la plantilla para quien la cumplimenta no forma parte del programa emitido.
  // Se vacía el párrafo (conserva su pPr y un posible salto de sección) en vez de borrarlo: dos tablas seguidas
  // se fundirían en Word y la cabecera de la principal dejaría de repetirse.
  return xml.replace(/<w:p(?:\s[^>]*)?>(?:(?!<w:p[\s>])[\s\S])*?<\/w:p>/g, p => visible(p).startsWith("Añadir o eliminar tantas filas") ? p.replace(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g, "") : p);
}
export function generateAnnualProgramme(template: Buffer, content: ProgrammeContent, sequence = 0) {
  const entries = readZip(template, { maxExpandedBytes: 40 * 1024 * 1024, verifyIntegrity: true });
  let xml = getZipEntryText(entries, "word/document.xml");
  // El formato (bloqueos, firmantes y referencia) se decide por la versión de la plantilla; la plantilla debe coincidir.
  if (isAnnexVProgramme(xml) !== (content.format === "ANNEX_V")) throw Error("El formato de la plantilla del programa no coincide con su versión de catálogo.");
  if (content.format === "ANNEX_V") {
    updateZipEntry(entries, "word/document.xml", applyValueMarks(fillAnnexV(xml, content, sequence)));
    sanitizeOfficeMetadata(entries);
    return writeZip(entries);
  }
  // Plantillas anteriores (Plan Maestro): las entradas canceladas no se incorporan, como hasta ahora.
  content = { ...content, rows: content.rows.filter(r => !r.cancelled) };
  const internal = content.auditType === "INTERNAL";
  if (!internal) xml = extractExternalProgramme(xml);
  let mainCount = 0, approvalCount = 0;
  xml = xml.replace(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, table => {
    const rows = [...table.matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)].map(m => m[0]);
    const text = visible(table);
    if (text.includes(internal ? "DEPARTAMENTO AUDITADO" : "COMPAÑÍA") && text.replace(/\s/g, "").includes("FECHAPREVISTA")) {
      mainCount++;
      const header = rows[0].replace(/(<w:trPr[^>]*>)/, '$1<w:tblHeader/>');
      const repeating = header.includes("<w:tblHeader") ? header : header.replace(/(<w:tr[^>]*>)/, '$1<w:trPr><w:tblHeader/></w:trPr>');
      let data = "";
      if (internal) {
        content.rows.forEach((r, i) => { data += row(rows[1], [String(i + 1), r.target, r.planned, r.auditors, r.performed, r.partial, r.notes].map(markValueLines)); });
      } else {
        const band = rows.find(r => visible(r).includes("ÁMBITO"));
        const styles = rows.filter(r => !visible(r).includes("ÁMBITO")).slice(1);
        if (!band || styles.length < 2) throw Error("Filas/ámbitos del programa externo no compatibles.");
        const groups = new Map<string, ProgrammeContent['rows']>();
        for (const r of content.rows) { const group = r.area || "Sin especificar"; groups.set(group, [...(groups.get(group) ?? []), r]); }
        for (const [area, items] of groups) {
          data += row(band, [`ÁMBITO ${markValue(area)}`]);
          items.forEach((r, i) => { data += row(styles[i % 2], [[r.target, r.productService, r.scope].filter(Boolean).join("\n"), r.planned, r.auditors, r.performed, externalProgrammeNotes(r)].map(markValueLines)); });
        }
      }
      return table.slice(0, table.indexOf(rows[0])) + repeating + data + "</w:tbl>";
    }
    if (text.includes("APROBADO POR:") && text.includes("FIRMA/FECHA")) {
      approvalCount++;
      const names = internal ? [content.technicalApproverName, content.qualityApproverName] : [content.qualityApproverName];
      if (rows.length !== names.length + 1) throw Error("Bloque de aprobación no compatible con la plantilla general.");
      return table.slice(0, table.indexOf(rows[0])) + rows[0] + names.map((name, i) => {
        const cells = [...rows[i + 1].matchAll(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g)].map(m => m[0]);
        return row(rows[i + 1], [[name ? markValue(name) : "", visible(cells[0])].filter(Boolean).join("\n"), ""]);
      }).join("") + "</w:tbl>";
    }
    return table;
  });
  if (mainCount !== 1 || approvalCount !== 1) throw Error("Tablas oficiales del programa no encontradas una sola vez.");
  let yearCount = 0;
  xml = xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, p => {
    if (/^AÑO:/.test(visible(p)) || (!internal && visible(p).includes("PROGRAMA ANUAL DE AUDITORIAS EXTERNAS AÑO:"))) {
      yearCount++; return paragraph(p, visible(p).replace(/AÑO:.*$/, `AÑO: ${markValue(String(content.year))}`));
    }
    return p;
  });
  if (yearCount !== 1) throw Error("Año editable no encontrado una sola vez.");
  if (!xml.includes(internal ? "PMAI/V04/01-2023" : "PMAE/V05/06-2026") && !entries.some(e => /word\/header/.test(e.name) && e.data.toString().includes("PMAI/V04/01-2023"))) throw Error("Referencia documental no compatible.");
  updateZipEntry(entries, "word/document.xml", applyValueMarks(xml));
  // No signature images or approval dates are fabricated; fields stay editable.
  sanitizeOfficeMetadata(entries);
  return writeZip(entries);
}
