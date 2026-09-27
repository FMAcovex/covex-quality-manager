import { describe, expect, it } from "vitest";
import { expandCapaAnnexIVSheet } from "@/modules/capa/documents/xlsx";

describe("CAPA Annex IV rows", () => {
  it("expands official data rows without truncating records", () => {
    const rows = [1,2,3,4].map((n) =>
      `<row r="${n}"><c r="A${n}" s="1"></c></row>`
    ).join("");
    const template = `<worksheet><dimension ref="A1:N15"/><sheetData>${rows}<row r="5"><c r="A5" s="8"></c><c r="B5" s="8"></c><c r="C5" s="8"></c><c r="D5" s="8"></c><c r="E5" s="9"></c><c r="F5" s="9"></c></row><row r="13"><c r="A13" s="10"></c></row><row r="14"><c r="A14" s="14"></c></row><row r="15"><c r="A15" s="15"></c></row></sheetData><mergeCells><mergeCell ref="A2:F2"/></mergeCells></worksheet>`;
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
  });
});
