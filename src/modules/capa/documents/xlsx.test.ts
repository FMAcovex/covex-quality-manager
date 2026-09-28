import { describe, expect, it } from "vitest";
import { expandCapaAnnexIVSheet } from "@/modules/capa/documents/xlsx";

describe("CAPA Annex IV rows", () => {
  it("expands official data rows, trims ghost columns and prepares printable width", () => {
    const rows = [
      '<row r="1" spans="1:14"><c r="A1" s="1"></c><c r="M1" s="2"></c><c r="N1" s="2"></c></row>',
      '<row r="2" spans="1:14"><c r="A2" s="1"></c><c r="M2" s="2"></c></row>',
      '<row r="3" spans="1:14"><c r="A3" s="1"></c></row>',
      '<row r="4" spans="1:14"><c r="A4" s="1"></c></row>',
    ].join("");
    const template = `<worksheet><dimension ref="A1:N15"/><sheetData>${rows}<row r="5" spans="1:14"><c r="A5" s="8"></c><c r="B5" s="8"></c><c r="C5" s="8"></c><c r="D5" s="8"></c><c r="E5" s="9"></c><c r="F5" s="9"></c></row><row r="13" spans="1:14"><c r="A13" s="10"></c></row><row r="14" spans="1:14"><c r="A14" s="14"></c></row><row r="15" spans="1:14"><c r="A15" s="15"></c></row></sheetData><mergeCells count="3"><mergeCell ref="E1:F1"/><mergeCell ref="M1:N1"/><mergeCell ref="A2:F2"/></mergeCells><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`;
    const data = Array.from({length:20},(_,index)=>({
      qmsRecord:{businessCode:`AC/GC-00/${String(index+1).padStart(3,"0")}/2026`},
      actionType:"CORRECTIVE",
      originType:"Desviación",
      originCode:"D/GC-00/001/2026",
      departmentNameSnapshot:"Garantía de Calidad",
      departmentCodeSnapshot:"GC-00",
      openedAt:new Date("2026-01-01"),
      operationalClosedAt:null,
      effectiveClosedAt:null,
      plannedActions:[{description:"Acción"}],
    }));
    const expanded=expandCapaAnnexIVSheet(template,2026,data);
    expect(expanded).toContain('r="A24"');
    expect(expanded).toContain('r="A25"');
    expect(expanded).toContain('r="A26"');
    expect(expanded).toContain("AC/GC-00/020/2026");
    expect(expanded).toContain('<dimension ref="A1:F26"');
    expect(expanded).not.toContain('ref="M1:N1"');
    expect(expanded).not.toContain('r="M1"');
    expect(expanded).toContain('fitToWidth="1"');
    expect(expanded).toContain('orientation="landscape"');
  });
});
