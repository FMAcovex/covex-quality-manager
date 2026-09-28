import { describe, expect, it } from "vitest";
import { finalizeReturnAnnexVISheet, finalizeReturnAnnexVIWorkbook } from "@/modules/returns/documents/xlsx";

describe("Devoluciones Anexo VI", () => {
  it("configura impresión horizontal a una página de ancho", () => {
    const sheet='<worksheet><dimension ref="A1:M12"/><sheetData></sheetData><pageMargins left="0.2"/><pageSetup orientation="landscape"/></worksheet>';
    const result=finalizeReturnAnnexVISheet(sheet);
    expect(result).toContain("<sheetPr><pageSetUpPr fitToPage=\"1\"/></sheetPr>");
    expect(result).toContain('orientation="landscape"');
    expect(result).toContain('fitToWidth="1"');
    expect(result).toContain('fitToHeight="0"');
  });

  it("define área de impresión y cabecera repetida de forma dinámica", () => {
    const workbook='<workbook><sheets><sheet name="&quot;AÑO&quot;" sheetId="1" r:id="rId1"/></sheets><calcPr/></workbook>';
    const result=finalizeReturnAnnexVIWorkbook(workbook,12);
    expect(result).toContain("'&quot;AÑO&quot;'!$A$1:$M12");
    expect(result).toContain("'&quot;AÑO&quot;'!$4:$4");
  });
});
