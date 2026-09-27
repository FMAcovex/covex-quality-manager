import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { writeZip, type ZipEntry } from "@/lib/ooxml/zip";
import {
  analyzeHistoricalImport,
  applyHistoricalImport,
} from "@/modules/deviations/import/import-service";

function cell(ref: string, value: string) {
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${value}</t></is></c>`;
}

function workbook() {
  const sheet2025 = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet><sheetData>
<row r="5">
${cell("B5","GC-00")}${cell("C5","D/GC-00/900/2025")}${cell("D5","Garantía de Calidad")}
${cell("E5","Proceso histórico")}${cell("F5","Auditoría interna")}${cell("G5","Descripción histórica 2025")}
${cell("H5","Mayor")}${cell("I5","Causa histórica")}${cell("J5","07/01/2025")}${cell("K5","08/01/2025")}
${cell("L5","Cerrada")}${cell("M5","Sí")}${cell("N5","CAPA")}${cell("O5","AC/GC-00/900/2025")}
${cell("P5","Sí")}${cell("S5","No")}${cell("T5","No")}
</row>
<row r="11">${cell("X11","GC-00")}${cell("Y11","Garantía de Calidad")}</row>
</sheetData></worksheet>`;

  const sheet2026 = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet><sheetData>
<row r="5">
${cell("B5","GC-00")}${cell("C5","D/GC-00/900/2026")}${cell("D5","Proceso histórico 2026")}
${cell("E5","Auditoría interna")}${cell("F5","Descripción histórica 2026")}${cell("G5","Menor")}
${cell("H5","Causa histórica 2026")}${cell("I5","03/02/2026")}${cell("J5","04/02/2026")}
${cell("K5","Cerrada")}${cell("L5","CAPA+Correctiva Inmediata")}${cell("M5","AC/GC-00/900/2026")}
${cell("Q5","No")}${cell("R5","No")}
</row>
</sheetData></worksheet>`;

  const entries: ZipEntry[] = [
    { name:"xl/workbook.xml", data:Buffer.from('<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="2025" sheetId="1" r:id="rId1"/><sheet name="2026" sheetId="2" r:id="rId2"/></sheets></workbook>') },
    { name:"xl/_rels/workbook.xml.rels", data:Buffer.from('<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>') },
    { name:"xl/worksheets/sheet1.xml", data:Buffer.from(sheet2025) },
    { name:"xl/worksheets/sheet2.xml", data:Buffer.from(sheet2026) },
  ];
  return writeZip(entries);
}

async function main() {
  const buffer = workbook();
  const filename = "historical-import-smoke.xlsx";

  const before = await analyzeHistoricalImport(buffer, filename, [2025, 2026]);
  assert.equal(before.report.counts.total, 2);
  assert.equal(before.report.counts.duplicates, 0);
  assert.equal(before.report.counts.rejected, 0);

  const applied = await applyHistoricalImport(buffer, filename, "CI import smoke", [2025, 2026]);
  assert.equal(applied.counts.imported, 2);

  const records = await prisma.qmsRecord.count({
    where: {
      recordType: "DEVIATION",
      businessCode: { in: ["D/GC-00/900/2025", "D/GC-00/900/2026"] },
    },
  });
  assert.equal(records, 2);

  const after = await analyzeHistoricalImport(buffer, filename, [2025, 2026]);
  assert.equal(after.report.counts.duplicates, 2);
  assert.equal(after.report.counts.rejected, 0);

  const batches = await prisma.historicalImportBatch.findMany({
    where: { sourceFileName: filename },
    include: { rows: true },
  });
  assert.equal(batches.length, 1);
  assert.equal(batches[0].rows.length, 2);

  console.log("Historical import smoke test passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
