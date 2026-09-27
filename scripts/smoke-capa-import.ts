import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { writeZip,type ZipEntry } from "@/lib/ooxml/zip";
import { analyzeHistoricalCapaImport,applyHistoricalCapaImport } from "@/modules/capa/import/import-service";
const prisma=new PrismaClient();
function cell(ref:string,v:string){return `<c r="${ref}" t="inlineStr"><is><t>${v}</t></is></c>`;}
function sheet(rows:string){return `<worksheet><sheetData>${rows}</sheetData></worksheet>`;}
function wb(){
 const y25=`<row r="6">${cell("B6","Correctiva")}${cell("C6","GC-00")}${cell("D6","AC/KPI/901/2025")}${cell("E6","Garantía de Calidad")}${cell("F6","Desviación")}${cell("G6","D/TEST/001/2025")}${cell("H6","Acción histórica")}${cell("I6","07/01/2025")}${cell("M6","Abierta")}</row>`;
 const y26=`<row r="5">${cell("A5","Preventiva")}${cell("B5","GC-00")}${cell("C5","AP/KPI/901/2026")}${cell("D5","Auditoría interna")}${cell("F5","Acción histórica 2026")}${cell("G5","01/02/2026")}${cell("I5","Abierta")}${cell("K5","Pendiente")}${cell("L5","01 15/02/2026")}${cell("M5","01/03/2026")}</row>`;
 const base=`<row r="6">${cell("E6","AC/KPI/901/2025")}${cell("H6","Desviación")}${cell("P6","Pendiente")}</row>`;
 const entries:ZipEntry[]=[
  {name:"xl/workbook.xml",data:Buffer.from('<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="2025" sheetId="1" r:id="rId1"/><sheet name="2026" sheetId="2" r:id="rId2"/><sheet name="Base_KPI" sheetId="3" r:id="rId3"/></sheets></workbook>')},
  {name:"xl/_rels/workbook.xml.rels",data:Buffer.from('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Target="worksheets/sheet3.xml"/></Relationships>')},
  {name:"xl/worksheets/sheet1.xml",data:Buffer.from(sheet(y25))},{name:"xl/worksheets/sheet2.xml",data:Buffer.from(sheet(y26))},{name:"xl/worksheets/sheet3.xml",data:Buffer.from(sheet(base))},
 ]; return writeZip(entries);
}
async function main(){
 const b=wb(); const before=await analyzeHistoricalCapaImport(b,"capa-smoke.xlsx"); assert.equal(before.report.counts.total,2);
 const applied=await applyHistoricalCapaImport(b,"capa-smoke.xlsx","CI"); assert.equal(applied.counts.imported,2);
 const after=await analyzeHistoricalCapaImport(b,"capa-smoke.xlsx"); assert.equal(after.report.counts.duplicates,2);
 const count=await prisma.capa.count({where:{qmsRecord:{businessCode:{in:["AC/KPI/901/2025","AP/KPI/901/2026"]}}}});assert.equal(count,2);
 console.log("CAPA historical import smoke test passed.");
}
main().catch((e)=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
