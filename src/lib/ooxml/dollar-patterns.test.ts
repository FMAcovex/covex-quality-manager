import { describe, expect, it } from "vitest";
import { appendWordCellText, appendWordCellTextBalanced, appendWordVariableCellText, replaceSheetData } from "@/lib/ooxml/xml";
import { expandCapaAnnexIVSheet } from "@/modules/capa/documents/xlsx";

// Un «$» en el texto del usuario no debe interpretarse como patrón de String.replace ($&, $', $`, $$).
// El escape XML convierte comillas y «&» en entidades que empiezan por «&»: «"50$"» acabaría en «$&».
const TRICKY = 'Coste "50$" por lote, A $$ B, $& y $\' y $` fin';
const unescape = (v: string) => v.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const text = (xml: string) => unescape([...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join(""));
const DOC = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr><w:tc><w:tcPr/><w:p/></w:tc><w:tc><w:p/></w:tc></w:tr></w:tbl></w:body></w:document>';

describe("Patrones «$» en los textos de los anexos", () => {
  it.each([
    ["appendWordCellText", (xml: string) => appendWordCellText(xml, 0, 0, 0, TRICKY)],
    ["appendWordVariableCellText", (xml: string) => appendWordVariableCellText(xml, 0, 0, 0, TRICKY)],
    ["appendWordCellTextBalanced", (xml: string) => appendWordCellTextBalanced(xml, 0, 0, 0, TRICKY)],
  ])("%s conserva el texto y la estructura", (_name, fill) => {
    const xml = fill(DOC);
    expect(xml.match(/<\/w:tc>/g)).toHaveLength(2);
    expect(xml.match(/<w:document\b/g)).toHaveLength(1);
    expect(text(xml)).toBe(TRICKY);
  });

  it("replaceSheetData sustituye la tabla de la hoja sin interpretar «$»", () => {
    const sheet = '<worksheet><sheetData><row r="1"/></sheetData><pageMargins/></worksheet>';
    const out = replaceSheetData(sheet, `<row r="1"><c r="A1" t="inlineStr"><is><t>${TRICKY.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")}</t></is></c></row>`);
    expect(out.match(/<sheetData>/g)).toHaveLength(1);
    expect(out).toContain("<pageMargins/>");
    expect(unescape(out.match(/<t>([\s\S]*?)<\/t>/)![1])).toBe(TRICKY);
  });

  it("listado de CAPA (Anexo IV): una descripción con «$» no corrompe la hoja", () => {
    const rows = [1, 2, 3, 4].map(n => `<row r="${n}" spans="1:14"><c r="A${n}" s="1"></c></row>`).join("");
    const template = `<worksheet><dimension ref="A1:N15"/><sheetData>${rows}<row r="5" spans="1:14">${"ABCDEF".split("").map(c => `<c r="${c}5" s="8"></c>`).join("")}</row><row r="15" spans="1:14"><c r="A15" s="3"></c></row></sheetData><mergeCells count="3"><mergeCell ref="M1:N1"/></mergeCells><pageSetup orientation="portrait"/></worksheet>`;
    const data = [{ qmsRecord: { businessCode: "AC/1" }, actionType: "CORRECTIVE", status: "OPEN", effectivenessStatus: "PENDING", internalObservations: null, originType: "Desviación", originCode: "D/1", departmentNameSnapshot: "Calidad", departmentCodeSnapshot: "GC-00", openedAt: new Date("2026-01-01"), operationalClosedAt: null, effectiveClosedAt: null, plannedActions: [{ description: TRICKY }], defectDescription: TRICKY }];
    const sheet = expandCapaAnnexIVSheet(template, 2026, data as never);
    expect(sheet.match(/<sheetData>/g)).toHaveLength(1);
    expect(unescape(sheet)).toContain(TRICKY);
  });
});
