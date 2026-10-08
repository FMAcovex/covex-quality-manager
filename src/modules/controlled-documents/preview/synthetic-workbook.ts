// Synthetic workbooks only; no corporate workbook data or templates.
import { writeZip } from "../../../lib/ooxml/zip";
import { escapeXml } from "../../../lib/ooxml/xml";
export type SyntheticCell = string | number | {
    value: string;
    formula?: string;
    type?: string;
};
export type SyntheticSheet = {
    name: string;
    rows: {
        number: number;
        cells: Record<string, SyntheticCell>;
    }[];
    xml?: string;
};
export function syntheticWorkbook(sheets: SyntheticSheet[], date1904 = false) {
    const entries = [{ name: "xl/workbook.xml", data: Buffer.from(`<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr date1904="${date1904 ? 1 : 0}"/><sheets>${sheets.map((s, i) => `<sheet name="${escapeXml(s.name)}" r:id="r${i}"/>`).join("")}</sheets></workbook>`) }, { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(`<Relationships>${sheets.map((_, i) => `<Relationship Id="r${i}" Target="worksheets/s${i}.xml"/>`).join("")}</Relationships>`) }];
    for (const [i, sheet] of sheets.entries())
        entries.push({ name: `xl/worksheets/s${i}.xml`, data: Buffer.from(sheet.xml ?? `<worksheet><sheetData>${sheet.rows.map(row => `<row r="${row.number}">${Object.entries(row.cells).map(([col, v]) => {
                if (typeof v === "number")
                    return `<c r="${col}${row.number}"><v>${v}</v></c>`;
                if (typeof v === "string")
                    return `<c r="${col}${row.number}" t="inlineStr"><is><t>${escapeXml(v)}</t></is></c>`;
                return `<c r="${col}${row.number}" t="${v.type || "str"}">${v.formula ? `<f>${escapeXml(v.formula)}</f>` : ""}<v>${escapeXml(v.value)}</v></c>`;
            }).join("")}</row>`).join("")}</sheetData></worksheet>`) });
    return writeZip(entries);
}
export const headings = { B: "CÓDIGO", C: "TÍTULO", D: "VERSIÓN VIGENTE", E: "FECHA (VIGENCIA / ANULACIÓN)", F: "FECHA (REVISIÓN / CADUCIDAD)" };
export function previewFixture() {
    return syntheticWorkbook([
        { name: "PORTADA", rows: [], xml: "<!DOCTYPE bad><not-a-sheet/>" },
        { name: "GC-00", rows: [{ number: 1, cells: headings }, { number: 2, cells: { B: "GC-00/001", C: "Fuente inválida", D: 99, E: "01/01/2000", F: "01/01/2005" } }, { number: 3, cells: { B: "GC-00/999", C: "Solo descartada", D: 1 } }] },
        { name: "GC-00(", rows: [{ number: 4, cells: headings }, { number: 9, cells: { B: "GC-00/001", C: "Procedimiento ficticio", D: 3, E: "13/04/2026", F: "13/04/2031" } }, { number: 10, cells: { B: "GC-00/002", C: "Original ficticio", D: 0, E: 46023, F: "01/01/2031" } }, { number: 11, cells: { B: "GC-00/003", C: "Histórico ficticio", D: "ANULADO", E: "ANULADO", F: "NA" } }, { number: 12, cells: { B: "GC-00/004", C: "En preparación", D: 1, E: "EN ELABORACIÓN", F: "" } }, { number: 13, cells: { B: "PAM-01", C: "Documento de otra familia", D: 1, E: "NA", F: "NA" } }] },
        { name: "SG-20", rows: [{ number: 20, cells: { A: "CÓDIGO", B: "TÍTULO", C: "VERSIÓN", D: "VIGENCIA", E: "REVISIÓN / CADUCIDAD" } }, { number: 21, cells: { A: "SG-20/001", B: "Procedimiento de seguridad ficticio", C: 0, D: "01/01/2026", E: "01/01/2031" } }] },
        { name: "MC-20_1", rows: [{ number: 1, cells: headings }, { number: 2, cells: { B: "MC-20/001", C: "Proceso ficticio", D: 1, E: "01/01/2026", F: "01/01/2031" } }] },
        { name: "MC-20_2", rows: [{ number: 1, cells: headings }, { number: 2, cells: { B: "MC-20/001", C: "Proceso ficticio", D: 2, E: "01/01/2026", F: "01/01/2031" } }] },
        { name: "MC-20_3", rows: [{ number: 1, cells: headings }, { number: 2, cells: { B: "MC-20/002", C: "Otro proceso ficticio", D: 0, E: "01/01/2026", F: "01/01/2031" } }] },
        { name: "Caducidades 2026", rows: [], xml: "invalid worksheet" }
    ]);
}
