import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { writeZip,type ZipEntry } from "@/lib/ooxml/zip";
import { analyzeHistoricalChangeImport,applyHistoricalChangeImport } from "@/modules/change-control/import/import-service";

const prisma=new PrismaClient();
function cell(ref:string,value:string){return `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`;}
function sheet(rows:string){return `<worksheet><sheetData>${rows}</sheetData></worksheet>`;}
function workbook(){
  const y25=`<row r="5">${cell("C5","ZZ-C1")}${cell("D5","C/ZZ-C1/901/2025")}${cell("E5","Dept histórico")}${cell("F5","Documentación")}${cell("G5","Cambio histórico 2025")}${cell("H5","Menor")}${cell("I5","Aceptado")}${cell("J5","01/01/2025")}${cell("K5","02/01/2025")}${cell("L5","15/01/2025")}${cell("M5","Ejecutado")}${cell("N5","10/01/2025")}${cell("O5","20/01/2025")}${cell("P5","Cerrado")}${cell("Q5","Aceptable")}</row>`;
  const y26=`<row r="5">${cell("B5","ZZ-C2")}${cell("C5","C/ZZ-C2/901/2026")}${cell("D5","Cambio histórico 2026")}${cell("E5","01/02/2026")}${cell("F5","02/02/2026")}${cell("G5","Mayor")}${cell("H5","01/03/2026")}${cell("I5","No ejecutado")}${cell("K5","Pendiente")}${cell("L5","00 10/02/2026\n01 20/02/2026")}${cell("M5","01/03/2026")}${cell("N5","Abierto")}</row>`;
  const entries:ZipEntry[]=[
    {name:"xl/workbook.xml",data:Buffer.from('<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="2025" sheetId="1" r:id="rId1"/><sheet name="2026" sheetId="2" r:id="rId2"/></sheets></workbook>')},
    {name:"xl/_rels/workbook.xml.rels",data:Buffer.from('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>')},
    {name:"xl/worksheets/sheet1.xml",data:Buffer.from(sheet(y25))},{name:"xl/worksheets/sheet2.xml",data:Buffer.from(sheet(y26))},
  ];return writeZip(entries);
}
async function main(){
  const buffer=workbook();
  const before=await analyzeHistoricalChangeImport(buffer,"changes-smoke.xlsx");assert.equal(before.report.counts.total,2);assert.equal(before.report.counts.rejected,0);
  const applied=await applyHistoricalChangeImport(buffer,"changes-smoke.xlsx","CI");assert.equal(applied.counts.imported,2);
  const after=await analyzeHistoricalChangeImport(buffer,"changes-smoke.xlsx");assert.equal(after.report.counts.duplicates,2);
  const records=await prisma.changeControl.findMany({where:{qmsRecord:{businessCode:{in:["C/ZZ-C1/901/2025","C/ZZ-C2/901/2026"]}}},include:{followups:true,qmsRecord:true}});
  assert.equal(records.length,2);const y26=records.find((x)=>x.qmsRecord.businessCode?.includes("2026"));assert.deepEqual(y26?.followups.map((x)=>x.sequenceNumber).sort(),[0,1]);
  await prisma.historicalImportRow.deleteMany({where:{batch:{sourceFileName:"changes-smoke.xlsx"}}});
  await prisma.historicalImportBatch.deleteMany({where:{sourceFileName:"changes-smoke.xlsx"}});
  const ids=records.map((x)=>x.qmsRecordId);await prisma.qmsRecordVersion.deleteMany({where:{qmsRecordId:{in:ids}}});
  await prisma.changeControlFollowup.deleteMany({where:{changeControl:{qmsRecordId:{in:ids}}}});
  await prisma.changeControlAction.deleteMany({where:{changeControl:{qmsRecordId:{in:ids}}}});
  await prisma.changeControl.deleteMany({where:{qmsRecordId:{in:ids}}});await prisma.qmsRecord.deleteMany({where:{id:{in:ids}}});
  await prisma.department.deleteMany({where:{code:{in:["ZZ-C1","ZZ-C2"]}}});
  console.log("Change Control historical import smoke test passed.");
}
main().catch((e)=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
