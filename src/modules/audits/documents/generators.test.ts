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
});
