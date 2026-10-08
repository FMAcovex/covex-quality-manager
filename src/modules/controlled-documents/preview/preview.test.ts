import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readZip, writeZip } from "../../../lib/ooxml/zip";
import { parseIndex } from "./analysis";
import { normalizeDate, normalizeRevision, departmentFromSheet, normalizeCode } from "./normalization";
import { reconcileIndex, type ExistingDocument } from "./reconciliation";
import { readWorkbook } from "./workbook";
import { previewIndex } from "./service";
import { previewFixture, syntheticWorkbook, headings } from "./synthetic-workbook";
const at = "2026-10-08";
const parse = (b = previewFixture()) => parseIndex(b, "synthetic.xlsx", at);
describe("P1B-1: fuentes autorizadas, normalización y conciliación", () => {
    it("excluye GC-00 antes de interpretar XML y jamás la concilia", async () => {
        const workbook = syntheticWorkbook([{ name: "GC-00", rows: [], xml: "<!DOCTYPE forbidden><broken>" }, { name: "GC-00(", rows: [{ number: 1, cells: headings }, { number: 2, cells: { B: "GC-00/001", C: "Título ficticio", D: 0 } }] }]);
        const seen: string[][] = [];
        const r = await previewIndex(workbook, "synthetic.xlsx", { departments: async () => [{ id: "dept", code: "GC-00", isActive: true }], documents: async (codes) => { seen.push(codes); return []; } }, at);
        expect(r.rows).toHaveLength(1);
        expect(r.rows[0].source.sheet).toBe("GC-00(");
        expect(r.rows[0].normalized.departmentCode).toBe("GC-00");
        expect(r.groups).toEqual([]);
        expect(seen).toEqual([["GC-00/001"]]);
        expect(r.excludedSheets[0].name).toBe("GC-00");
    });
    it("no cuenta códigos, conflictos, fechas, estados ni títulos de GC-00", () => {
        const r = parse();
        expect(r.rows.some(row => row.source.sheet === "GC-00")).toBe(false);
        expect(r.rows.some(row => row.normalized.baseCode === "GC-00/999")).toBe(false);
        expect(r.rows.find(row => row.normalized.baseCode === "GC-00/001")?.normalized.revisionCode).toBe("03");
        expect(r.groups.some(g => g.baseCode === "GC-00/001")).toBe(false);
        const validOnly = parse(syntheticWorkbook([{ name: "GC-00(", rows: [{ number: 1, cells: headings }, { number: 2, cells: { B: "GC-00/001", C: "Título", D: 3 } }] }]));
        const plusInvalid = parse(syntheticWorkbook([{ name: "GC-00", rows: [{ number: 1, cells: headings }, { number: 2, cells: { B: "GC-00/001", C: "Contradictorio", D: 99 } }, { number: 3, cells: { B: "GC-00/999", C: "Excluido", D: 1, E: "ANULADO" } }] }, { name: "GC-00(", rows: [{ number: 1, cells: headings }, { number: 2, cells: { B: "GC-00/001", C: "Título", D: 3 } }] }]));
        expect(plusInvalid.summary).toEqual(validOnly.summary);
        expect(plusInvalid.groups).toEqual(validOnly.groups);
    });
    it("lee SG-20 A–E, multihojas MC-20 y columnas reordenadas sin posición fija", () => {
        const r = parse();
        const sg = r.rows.find(row => row.normalized.baseCode === "SG-20/001")!;
        expect(sg.normalized.revisionCode).toBe("00");
        expect(sg.normalized.title).toBe("Procedimiento de seguridad ficticio");
        expect(r.rows.filter(row => row.normalized.departmentCode === "MC-20")).toHaveLength(3);
        expect(r.summary.revisionDiscrepancyGroups).toBe(1);
        const shuffled = parse(syntheticWorkbook([{ name: "GC-00(", rows: [{ number: 40, cells: { E: "CÓDIGO", A: "TÍTULO", B: "REVISIÓN", C: "VIGENCIA", D: "FECHA REVISIÓN" } }, { number: 44, cells: { E: "GC-00/001", A: "Fecha de revisión de equipos", B: 0, C: "13/04/2026", D: "13/04/2031" } }] }]));
        expect(shuffled.rows[0].normalized).toMatchObject({ revisionCode: "00", effectiveFrom: "2026-04-13", reviewDueAt: "2031-04-13" });
        expect(shuffled.rows[0].issues).not.toContain("LAYOUT_INFERRED");
    });
    it("separa revisión original, estados declarados y verificación real", () => {
        const r = parse();
        expect(r.rows.find(x => x.normalized.baseCode === "GC-00/002")?.normalized.revisionCode).toBe("00");
        const annulled = r.rows.find(x => x.normalized.baseCode === "GC-00/003")!;
        expect(annulled.normalized.declaredState).toBe("ANNULLED");
        expect(annulled.normalized.revisionCode).toBe(null);
        expect(annulled.normalized.effectiveFrom).toBe(null);
        expect(r.rows.find(x => x.normalized.baseCode === "GC-00/004")?.normalized.declaredState).toBe("IN_PREPARATION");
        expect(r.rows.every(x => x.verificationStatus === "UNVERIFIED")).toBe(true);
        expect(r.rows.find(x => x.family === "PAM")?.decision).toBe("EXCLUDED");
    });
    it("no inventa fechas, revisiones ni vigencia; soporta epochs Excel y texto", () => {
        expect(normalizeRevision("0")).toBe("00");
        expect(normalizeRevision("3")).toBe("03");
        expect(normalizeRevision("ANULADO")).toBe(null);
        for (const value of ["", "NA", "ANULADO", "EN ELABORACIÓN"])
            expect(normalizeDate(value, "str", false).value).toBe(null);
        expect(normalizeDate("46023", "n", false).value).toBe("2026-01-01");
        expect(normalizeDate("0", "n", true).value).toBe("1904-01-01");
        expect(normalizeDate("60", "n", false).invalid).toBe(true);
        expect(normalizeDate("31/02/2026", "str", false).invalid).toBe(true);
        expect(normalizeDate("13.04.2026", "str", false).value).toBe("2026-04-13");
        expect(normalizeDate("13/04/26", "str", false).invalid).toBe(true);
        expect(normalizeCode(" gc-00 . 001 / 3 ")).toEqual({ baseCode: "GC-00/001", embeddedRevision: "03" });
        expect(departmentFromSheet("GC-00(")).toBe("GC-00");
    });
    it("conserva fila, valores originales, hash y claves estables de procedencia", () => {
        const b = previewFixture(), r = parse(b), again = parse(b);
        const gc = r.rows.find(x => x.normalized.baseCode === "GC-00/001")!;
        expect(r.sha256).toBe(createHash("sha256").update(b).digest("hex"));
        expect(gc.source.row).toBe(9);
        expect(gc.source.originalCode).toBe("GC-00/001");
        expect(gc.source.values.some(x => x.value === "13/04/2026")).toBe(true);
        expect(gc.sourceKey).toBe(again.rows.find(x => x.identityKey === gc.identityKey)!.sourceKey);
        expect(gc.revisionKey).toBe("GC-00/001/03");
    });
    it("distingue duplicados exactos, revisiones diferentes y contradicción dentro de hoja", () => {
        const same = { B: "GC-00/001", C: "Título", D: 0, E: "01/01/2026", F: "01/01/2031" };
        const r = parse(syntheticWorkbook([{ name: "GC-00(", rows: [{ number: 1, cells: headings }, { number: 2, cells: same }, { number: 3, cells: same }, { number: 4, cells: { ...same, C: "Contradictorio" } }, { number: 5, cells: { ...same, D: 1 } }] }]));
        expect(r.groups[0].kinds).toEqual(expect.arrayContaining(["DUPLICATE_IN_SHEET", "REVISION_DISCREPANCY", "DATA_CONFLICT", "TITLE_DISCREPANCY"]));
        expect(r.summary.additionalAppearances).toBe(3);
        expect(r.rows.filter(x => x.normalized.revisionCode === "00")).toHaveLength(3);
        const exact = parse(syntheticWorkbook([{ name: "GC-00(", rows: [{ number: 1, cells: headings }, { number: 2, cells: same }, { number: 3, cells: same }] }]));
        expect(exact.summary.discrepancyGroups).toBe(0);
    });
    it("no inventa PNT para PAM/PAF/PV/IV/PL/PF/VO/DC/PE/PAN o planes maestros", () => {
        const families = ["PAM", "PAF", "PV", "IV", "PL", "PF", "VO", "DC", "PE", "PAN"];
        const r = parse(syntheticWorkbook([{ name: "GC-00(", rows: [{ number: 1, cells: headings }, ...families.map((f, i) => ({ number: i + 2, cells: { B: `${f}-001`, C: "Documento ficticio", D: 0 } })), { number: 20, cells: { B: "PM-01", C: "Plan maestro ficticio", D: 1 } }] }]));
        expect(r.summary.pntCandidates).toBe(0);
        expect(r.summary.otherDocuments).toBe(11);
    });
    it("concilia existentes, inactivos y discrepancias sin modificar entradas", () => {
        const doc: ExistingDocument = { id: "doc", baseCode: "GC-00/001", title: "Procedimiento ficticio", departmentId: "dept", departmentCodeSnapshot: "GC-00", administrativeStatus: "ACTIVE", documentType: "PNT", revisions: [{ id: "rev", revisionCode: "03", titleSnapshot: "Procedimiento ficticio", departmentCodeSnapshot: "GC-00", effectiveFrom: new Date("2026-04-13"), reviewDueAt: new Date("2031-04-13"), status: "IN_FORCE", verificationStatus: "VERIFIED", consolidatedAt: new Date("2026-04-13") }] };
        const before = JSON.stringify(doc);
        let r = reconcileIndex(parse(), [{ id: "dept", code: "GC-00", isActive: false }], [doc]);
        const gc = r.rows.find(x => x.identityKey === doc.baseCode)!;
        expect(gc.reconciliation.kind).toBe("EXISTING_REVISION");
        expect(gc.issues).toContain("DEPARTMENT_INACTIVE");
        expect(gc.verificationStatus).toBe("UNVERIFIED");
        expect(JSON.stringify(doc)).toBe(before);
        r = reconcileIndex(parse(), [{ id: "dept", code: "GC-00", isActive: false }], [{ ...doc, title: "Título posterior del maestro" }]);
        expect(r.rows.find(x => x.identityKey === doc.baseCode)?.reconciliation.kind).toBe("EXISTING_REVISION");
        r = reconcileIndex(parse(), [{ id: "dept", code: "GC-00", isActive: false }], [{ ...doc, revisions: [{ ...doc.revisions[0], titleSnapshot: "Otra revisión" }] }]);
        expect(r.rows.find(x => x.identityKey === doc.baseCode)?.reconciliation.kind).toBe("PERSISTED_CONFLICT");
        expect(r.rows.find(x => x.identityKey === "SG-20/001")?.issues).toContain("DEPARTMENT_UNKNOWN");
    });
    it("no resuelve automáticamente revisión incrustada contra columna contradictoria", () => {
        const r = parse(syntheticWorkbook([{ name: "GC-00(", rows: [{ number: 1, cells: headings }, { number: 2, cells: { B: "GC-00/001/03", C: "Título", D: 4 } }] }]));
        expect(r.rows[0].normalized.revisionCode).toBe(null);
        expect(r.rows[0].revisionKey).toBe(null);
        expect(r.rows[0].issues).toContain("REVISION_DISCREPANCY");
    });
    it("lee texto compartido, rich text y fórmulas cacheadas sin ejecutarlas", () => {
        const original = syntheticWorkbook([{ name: "GC-00(", rows: [{ number: 1, cells: headings }] }]);
        const entries = readZip(original);
        entries.push({ name: "xl/sharedStrings.xml", data: Buffer.from('<sst><si><t>GC-00/001</t></si><si><r><t>Texto &amp; </t></r><r><t>sintético</t></r></si></sst>') });
        const sheet = entries.find(e => e.name === 'xl/worksheets/s0.xml')!;
        sheet.data = Buffer.from(sheet.data.toString().replace('</sheetData>', '<row r="2"><c r="B2" t="s"><v>0</v></c><c r="C2" t="s"><v>1</v></c><c r="D2"><f>1+2</f><v>3</v></c></row></sheetData>'));
        const r = parse(writeZip(entries));
        expect(r.rows[0].normalized.title).toBe("Texto & sintético");
        expect(r.rows[0].normalized.revisionCode).toBe("03");
        expect(r.rows[0].issues).toContain("FORMULA_CACHE");
        expect(r.rows[0].source.values.find(c => c.reference === "D2")?.formula).toBe("1+2");
    });
    it("rechaza archivos no XLSX, entidades XML e índices de texto inválidos", () => {
        expect(() => readWorkbook(Buffer.from("invalid"))).toThrow();
        expect(() => readWorkbook(syntheticWorkbook([{ name: "GC-00(", rows: [], xml: "<!DOCTYPE forbidden><worksheet/>" }]))).toThrow();
    });
});
