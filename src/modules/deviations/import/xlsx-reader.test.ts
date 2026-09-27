import { describe, expect, it } from "vitest";
import { writeZip, type ZipEntry } from "@/lib/ooxml/zip";
import { readXlsxSheet } from "@/modules/deviations/import/xlsx-reader";

describe("readXlsxSheet", () => {
  it("reads shared strings, numeric values and cached formula values", () => {
    const entries: ZipEntry[] = [
      { name:"xl/workbook.xml", data:Buffer.from('<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="2025" sheetId="1" r:id="rId1"/></sheets></workbook>') },
      { name:"xl/_rels/workbook.xml.rels", data:Buffer.from('<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>') },
      { name:"xl/sharedStrings.xml", data:Buffer.from('<?xml version="1.0"?><sst><si><t>D/GC-00/001/2025</t></si><si><t>Cerrada</t></si></sst>') },
      { name:"xl/worksheets/sheet1.xml", data:Buffer.from('<?xml version="1.0"?><worksheet><sheetData><row r="5"><c r="C5" t="s"><v>0</v></c><c r="J5"><v>45664</v></c><c r="P5" s="1"/><c r="Q5" t="s"><v>1</v></c><c r="L5" t="s"><v>1</v></c><c r="D5" t="str"><f>VLOOKUP()</f><v>Garantía de Calidad</v></c></row></sheetData></worksheet>') },
    ];
    const [row] = readXlsxSheet(writeZip(entries), "2025");
    expect(row.rowNumber).toBe(5);
    expect(row.cells.C).toBe("D/GC-00/001/2025");
    expect(row.cells.J).toBe(45664);
    expect(row.cells.L).toBe("Cerrada");
    expect(row.cells.P).toBeNull();
    expect(row.cells.Q).toBe("Cerrada");
    expect(row.cells.D).toBe("Garantía de Calidad");
  });
});
