import { describe, expect, it } from "vitest";
import { finalizeComplaintAnnexVSheet, finalizeComplaintAnnexVWorkbook } from "@/modules/complaints/documents/xlsx";

describe("Reclamaciones Anexo V", () => {
  it("elimina estructuras auxiliares y ajusta filtro e impresión", () => {
    const sheet='<worksheet><dimension ref="B1:R36"/><sheetData></sheetData><mergeCells count="1"><mergeCell ref="B2:K2"/></mergeCells><conditionalFormatting sqref="K10"></conditionalFormatting><pageMargins left="0.2"/><pageSetup scale="47" orientation="landscape"/><drawing r:id="rId2"/><tableParts count="1"></tableParts><extLst><ext/></extLst></worksheet>';
    const result=finalizeComplaintAnnexVSheet(sheet,12);
    expect(result).toContain('autoFilter ref="B4:K12"');
    expect(result).toContain('fitToWidth="1"');
    expect(result).toContain('fitToHeight="0"');
    expect(result).not.toContain("conditionalFormatting");
    expect(result).not.toContain("tableParts");
    expect(result).not.toContain("extLst");
  });

  it("deja solo la hoja oficial y un área de impresión dinámica", () => {
    const workbook='<workbook><sheets><sheet name="AÑO" sheetId="1" r:id="rId1"/><sheet name="datos" sheetId="2" r:id="rId2"/></sheets><definedNames><definedName name="_xlnm.Print_Area">old</definedName></definedNames><calcPr/></workbook>';
    const result=finalizeComplaintAnnexVWorkbook(workbook,12);
    expect(result).not.toContain('name="datos"');
    expect(result).toContain("AÑO!$B$1:$K12");
    expect(result).toContain("AÑO!$B$4:$K12");
    expect(result).toContain("AÑO!$4:$4");
  });
});
