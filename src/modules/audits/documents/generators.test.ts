import { describe, it, expect } from "vitest";
import { syntheticAuditReport, syntheticAuditPlan, syntheticAuditCapaPlan } from "../../../../scripts/audits-r3c-fixtures";
import { generateAuditReport, generateAuditExternalPlan, generateAuditCapaPlan } from "./generators";
import { readZip, getZipEntryText, updateZipEntry, writeZip } from "@/lib/ooxml/zip";
import type { AuditReportSnapshot } from "../report-service";
// Generator contract fixture; production snapshots are exercised in PostgreSQL.
const snapshot = (supplier=false): AuditReportSnapshot => ({schemaVersion:1,templates:[],audit:{id:'audit-uuid',scenario:supplier?'SUPPLIER':'INTERNAL_COVEX',qmsRecord:{businessCode:'AI/GC-00/01/2026',generatedDocuments:[]},departments:[],participants:[],findings:[],conclusion:'Conclusión histórica <sin HTML>',title:'Objeto',scope:'Alcance',performedDate:'2026-10-07',reportDate:'2026-10-08',plannedDate:'2026-10-07',auditedEntityName:'Entidad ficticia',planIntroduction:'Introducción',activityDuration:'09–12',programme:'09:00 | Revisión',reportDistribution:'Distribución ficticia'} as unknown as AuditReportSnapshot['audit']});
describe('Generadores de Auditorías sobre plantilla',()=>{
 it.each([false,true])('usa informe correspondiente al escenario proveedor=%s',supplier=>{const xml=getZipEntryText(readZip(generateAuditReport(syntheticAuditReport(supplier),snapshot(supplier),1)),'word/document.xml');expect(xml).toContain(supplier?'EXTERNA':'INTERNA');expect(xml).toContain('Conclusión histórica &lt;sin HTML&gt;');expect(xml).toContain('>01<');expect(xml).toContain('w:rFonts');});
 it('rechaza plantilla del escenario distinto',()=>expect(()=>generateAuditReport(syntheticAuditReport(true),snapshot(),0)).toThrow(/plantilla/));
 it('extrae solo el Anexo IV del PNT externo y conserva programa',()=>{const xml=getZipEntryText(readZip(generateAuditExternalPlan(syntheticAuditPlan(),snapshot(true))),'word/document.xml');expect(xml).toContain('PLAN DE AUDITORIA COVEX');expect(xml).toContain('Revisión');expect((xml.match(/<w:tr>/g) ?? []).length).toBe(2);expect(xml).not.toContain('contenido anterior no exportable');});
 it('exige información suficiente para el Plan y rechaza escenario interno',()=>{expect(()=>generateAuditExternalPlan(syntheticAuditPlan(),snapshot())).toThrow(/solo aplica/);const s=snapshot(true);s.audit.activityDuration=null;expect(()=>generateAuditExternalPlan(syntheticAuditPlan(),s)).toThrow(/Completa/);});
 it('CAPA Plan distingue estado actual y versión formal sin escribir fórmulas',()=>{for(const sequence of [null,0,1]){const xml=getZipEntryText(readZip(generateAuditCapaPlan(syntheticAuditCapaPlan(),snapshot(),sequence)),'xl/worksheets/sheet1.xml');expect(xml).toContain(sequence===null?'Estado actual':String(sequence).padStart(2,'0'));expect(xml).not.toContain('<f>');}});
 it('rellena celdas autocerradas sin consumir las etiquetas fijas adyacentes',()=>{const entries=readZip(syntheticAuditCapaPlan());let sheet=getZipEntryText(entries,'xl/worksheets/sheet1.xml');sheet=sheet.replace(/<c r="F5"[^>]*>[\s\S]*?<\/c>/,'<c r="F5" s="0"/>').replace(/<c r="G5"[^>]*>[\s\S]*?<\/c>/,'<c r="G5" t="inlineStr"><is><t>Fecha de auditoría</t></is></c>');updateZipEntry(entries,'xl/worksheets/sheet1.xml',sheet);const output=getZipEntryText(readZip(generateAuditCapaPlan(writeZip(entries),snapshot(),0)),'xl/worksheets/sheet1.xml');expect(output).toContain('Fecha de auditoría');expect(output).not.toContain('/ t="');expect(output).toContain('<cols>');expect(output).toContain('</cols>');expect(output).toContain('<col min=');});
 it('escribe celdas omitidas en el XLSX sin perder estilos ni etiquetas vecinas',()=>{
  const entries=readZip(syntheticAuditCapaPlan());
  let sheet=getZipEntryText(entries,'xl/worksheets/sheet1.xml');
  sheet=sheet.replace(/<c r="C5"[^>]*>[\s\S]*?<\/c>/,'').replace(/<c r="D11"[^>]*>[\s\S]*?<\/c>/,'');
  updateZipEntry(entries,'xl/worksheets/sheet1.xml',sheet);
  const s=snapshot();s.audit.findings=[{id:'fake',reference:'OBS 01',findingType:'FINDING',criticality:'MAJOR',isActive:true,description:'Hallazgo disperso',treatmentStatus:'OPEN',actions:[],relations:[]} as unknown as typeof s.audit.findings[number]];
  const output=getZipEntryText(readZip(generateAuditCapaPlan(writeZip(entries),s,0)),'xl/worksheets/sheet1.xml');
  expect(output).toContain('r="C5"');expect(output).toContain('r="D11"');expect(output).toContain('Hallazgo disperso');
  expect(output).toContain('AI/GC-00/01/2026');
 });
 it('rechaza escritura sobre celda no inicial de un rango combinado',()=>{
  const entries=readZip(syntheticAuditCapaPlan());
  let sheet=getZipEntryText(entries,'xl/worksheets/sheet1.xml');
  sheet=sheet.replace(/<c r="C5"[^>]*>[\s\S]*?<\/c>/,'').replace('</worksheet>','<mergeCells count="1"><mergeCell ref="B5:D5"/></mergeCells></worksheet>');
  updateZipEntry(entries,'xl/worksheets/sheet1.xml',sheet);
  expect(()=>generateAuditCapaPlan(writeZip(entries),snapshot(),0)).toThrow(/combinada/);
 });
 it('expande más de diez filas conservando el bloque posterior',()=>{const s=snapshot();s.audit.findings=Array.from({length:14},(_,i)=>({id:`uuid-${i}`,reference:`OBS ${i+1}`,findingType:'FINDING',criticality:'MINOR',isActive:true,description:'Ficticio',treatmentStatus:'OPEN',actions:[],relations:[]} as unknown as typeof s.audit.findings[number]));const xml=getZipEntryText(readZip(generateAuditCapaPlan(syntheticAuditCapaPlan(),s,0)),'xl/worksheets/sheet1.xml');expect(xml).toContain('OBS 14');expect(xml).toContain('r="31"');const refs=[...xml.matchAll(/<row\b[^>]*\br="(\d+)"/g)].map(m=>Number(m[1]));expect(refs).toEqual([...refs].sort((a,b)=>a-b));expect(new Set(refs).size).toEqual(refs.length);});
 it('permite altura automática en filas cumplimentadas para no solapar textos largos',()=>{
  const entries=readZip(syntheticAuditCapaPlan());let sheet=getZipEntryText(entries,'xl/worksheets/sheet1.xml');
  sheet=sheet.replace(/<row r="11"/, '<row ht="30.75" customHeight="1" r="11"');updateZipEntry(entries,'xl/worksheets/sheet1.xml',sheet);
  const s=snapshot(),description='Descripción larga con saltos\n'.repeat(20);s.audit.findings=[{id:'uuid',reference:'OBS 01',findingType:'FINDING',criticality:'MINOR',isActive:true,description,treatmentStatus:'OPEN',actions:[],relations:[]} as unknown as typeof s.audit.findings[number]];
  const result=readZip(generateAuditCapaPlan(writeZip(entries),s,0)),output=getZipEntryText(result,'xl/worksheets/sheet1.xml');
  expect(output.match(/<row\b[^>]*r="11"[^>]*>/)?.[0]).not.toMatch(/ht=|customHeight=/);
  expect(output.match(/<row\b[^>]*r="12"[^>]*>/)?.[0]).toContain('ht="30.75"');
  expect(output).toContain(description);expect(getZipEntryText(result,'xl/styles.xml')).toBe(getZipEntryText(entries,'xl/styles.xml'));
 });
 it('pagina verticalmente el CAPA Plan cumplimentado sin comprimirlo en una sola página',()=>{
  const entries=readZip(syntheticAuditCapaPlan());updateZipEntry(entries,'xl/worksheets/sheet1.xml',getZipEntryText(entries,'xl/worksheets/sheet1.xml').replace('</worksheet>','<pageSetup paperSize="9" scale="60" orientation="landscape"/></worksheet>'));
  const s=snapshot();s.audit.findings=[{id:'uuid',reference:'OBS 01',findingType:'FINDING',criticality:'MINOR',isActive:true,description:'Texto largo '.repeat(100),treatmentStatus:'OPEN',actions:[],relations:[]} as unknown as typeof s.audit.findings[number]];
  const xml=getZipEntryText(readZip(generateAuditCapaPlan(writeZip(entries),s,0)),'xl/worksheets/sheet1.xml');
  expect(xml).toContain('<pageSetup paperSize="9" scale="60" orientation="landscape" fitToWidth="1" fitToHeight="0"/>');
 });

 it('sustituye el código de auditoría externa repartido en ambos pies sin alterar la plantilla controlada',()=>{
  const source=readZip(syntheticAuditReport(true));
  const splitFooter=(page:string)=>\`<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial"/></w:rPr><w:t>A</w:t></w:r><w:r><w:t>E</w:t></w:r><w:r><w:t>/</w:t></w:r><w:r><w:t>XXXX</w:t></w:r><w:r><w:t>/YY/AAAA</w:t></w:r><w:r><w:t> Página </w:t></w:r><w:r><w:t>\${page}</w:t></w:r></w:p></w:ftr>\`;
  source.push({name:'word/footer1.xml',data:Buffer.from(splitFooter('1 de 2'))},{name:'word/footer2.xml',data:Buffer.from(splitFooter('2 de 2'))},{name:'word/header1.xml',data:Buffer.from('<w:hdr><w:p><w:r><w:t>Anexo III del PNT N.º GC-00/034/03</w:t></w:r></w:p></w:hdr>')});
  const current=snapshot(true);current.audit.qmsRecord.businessCode='AE/PROV01/02/2026';
  const generated=readZip(generateAuditReport(writeZip(source),current,0));
  const visible=(file:string)=>[...getZipEntryText(generated,file).matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m=>m[1]).join('');
  for(const [file,page] of [['word/footer1.xml','1 de 2'],['word/footer2.xml','2 de 2']]){
    expect(visible(file)).toBe('AE/PROV01/02/2026 Página '+page);
    expect(getZipEntryText(generated,file)).toContain('w:rFonts');
    expect(getZipEntryText(generated,file)).toContain('w:jc w:val="both"');
    expect(visible(file)).not.toContain('XXXX');
  }
  expect(visible('word/header1.xml')).toContain('GC-00/034/03');
  expect(visible('word/document.xml')).toContain('AE/PROV01/02/2026');
 });
 it('falla controladamente si la plantilla externa tiene pie sin marcador, o falta código',()=>{
  const entries=readZip(syntheticAuditReport(true));
  entries.push({name:'word/footer1.xml',data:Buffer.from('<w:ftr><w:p><w:r><w:t>Pie sin marcador</w:t></w:r></w:p></w:ftr>')});
  const current=snapshot(true);current.audit.qmsRecord.businessCode='AE/PROV01/02/2026';
  expect(()=>generateAuditReport(writeZip(entries),current,0)).toThrow(/código editable esperado/);
  current.audit.qmsRecord.businessCode=null;
  expect(()=>generateAuditReport(writeZip(entries),current,0)).toThrow(/requiere un código/);
 });

});
