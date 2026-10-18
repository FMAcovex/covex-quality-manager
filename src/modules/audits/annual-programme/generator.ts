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
export function generateAnnualProgramme(template: Buffer, content: ProgrammeContent) {
  const entries = readZip(template, { maxExpandedBytes: 40 * 1024 * 1024, verifyIntegrity: true });
  let xml = getZipEntryText(entries, "word/document.xml");
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
