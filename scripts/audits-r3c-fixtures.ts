import { purgeLegacyFixtureDocuments, purgeFixtureCapaPlanVersions } from "./audit-fixtures/legacy-cleanup";
// Synthetic fixtures only: these are not official COVEX templates or deployment assets.
import { createHash, randomUUID } from "node:crypto";
import { DocumentType } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { writeZip } from "../src/lib/ooxml/zip";
import { escapeXml } from "../src/lib/ooxml/xml";
import { generateSimpleXlsx } from "../src/lib/ooxml/simple-xlsx";
const p=(v='')=>`<w:p><w:pPr><w:spacing w:after="100"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial"/><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(v)}</w:t></w:r></w:p>`;
const table=(rows:number,cols:number,title='')=>`<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/></w:tblPr>${Array.from({length:rows},(_,i)=>`<w:tr>${Array.from({length:cols},(_,j)=>`<w:tc><w:tcPr><w:tcW w:w="1500" w:type="dxa"/></w:tcPr>${p(i===0&&j===0?title:'')}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`;
function doc(body:string){return writeZip([{name:'[Content_Types].xml',data:Buffer.from('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')},{name:'_rels/.rels',data:Buffer.from('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')},{name:'word/document.xml',data:Buffer.from(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`)}]);}
export function syntheticAuditReport(supplier=false){return doc(table(1,2,supplier?'INFORME DE AUDITORÍA EXTERNA':'INFORME DE AUDITORÍA INTERNA')+p('INFORMACIÓN GENERAL DE LA AUDITORÍA')+table(supplier?13:10,6)+p('CUADRO DE FIRMAS')+table(2,3)+p('OBSERVACIONES DE LA AUDITORÍA')+table(5,2,'Clasificación')+p('LISTADO DE OBSERVACIONES')+table(7,2)+['RECOMENDACIONES:','ANTECEDENTE DE AUDITORÍAS ANTERIORES','HALLAZGOS DE LA AUDITORÍA','CONCLUSIÓN','ANEXO I: PROGRAMA DE AUDITORÍA'].map(h=>p(h)+p()).join(''));}
// D-134 (R6): informes 04 (interno) y 05 (externo). Cuadro de firmas por filas «Función | Nombre | Puesto | Fecha | Firma»,
// listado con REFERENCIA en el interno y hallazgos «OBS XX – Requisito / Evidencia / Deficiencia».
const rowsTable=(rows:string[][])=>`<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/></w:tblPr>${rows.map(r=>`<w:tr>${r.map(c=>`<w:tc><w:tcPr><w:tcW w:w="1500" w:type="dxa"/></w:tcPr>${p(c)}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`;
export function syntheticAuditReportR6(supplier=false){
 const signatures=rowsTable([['Función','Nombre y Apellidos','Puesto','Fecha','Firma'],['Elaborado por','','','',''],['Revisado y aprobado por','','','',''],[supplier?'Recibido por Responsable/s de entidad auditada':'Recibido por Responsable/s del área auditada','','','','']]);
 return doc(table(1,2,supplier?'INFORME DE AUDITORÍA EXTERNA':'INFORME DE AUDITORÍA INTERNA')+p('INFORMACIÓN GENERAL DE LA AUDITORÍA')+table(supplier?13:12,6)+p('CUADRO DE FIRMAS')+signatures+p('OBSERVACIONES DE LA AUDITORÍA')+table(5,2,'Clasificación')+p('LISTADO DE OBSERVACIONES')+table(7,supplier?2:3)
  +p('RECOMENDACIONES:')+p()+p('RkXX:')+p('HALLAZGOS DE LA AUDITORÍA')+p()+p('Ejemplo (dividir hallazgos por puntos separados según los procesos /aspectos auditados)')+p('OBS XX – Requisito de referencia:')+p('Evidencia objetiva:')+p('Deficiencia detectada:')+p()
  +['ANTECEDENTES DE AUDITORÍAS ANTERIORES','CONCLUSIÓN','ANEXO I: PROGRAMA DE AUDITORÍA'].map(h=>p(h)+p()).join(''));
}
/** Plan de auditoría 05: el anexo se entrega suelto, sin el resto del PNT. */
export function syntheticAuditPlanR6(){return doc(p('Anexo IV del PNT Nº GC-00/034/05')+p('PLAN DE AUDITORIA COVEX, S.A.')+p('Entidad Auditada:')+p('Fecha:')+p('Lugar de auditoría:')+['INTRODUCCIÓN','OBJETIVO/ALCANCE DE LA AUDITORIA','PERSONAL RESPONSABLE DEL DEPARTAMENTO AUDITADO','EQUIPO AUDITOR','DURACION DE CADA ACTIVIDAD'].map(h=>p(h)+p()).join('')+p('Durante el horario laboral de XX:XX hasta las XX:XX')+p('PROGRAMA DE AUDITORÍA')+table(8,2,'Hora')+p('ELABORACIÓN Y DISTRIBUCIÓN DEL INFORME DE AUDITORIA')+p());}
export function syntheticAuditPlan(){return doc(p('PNT de pruebas, contenido anterior no exportable')+p('Anexo IV: Plan de Auditoría Covex, S.A.')+p('Anexo IV del PNT Nº GC-00/034/04')+p('PLAN DE AUDITORIA COVEX, S.A.')+p('Entidad Auditada:')+p('Fecha:')+p('Lugar de auditoría:')+['INTRODUCCIÓN','OBJETIVO/ALCANCE DE LA AUDITORIA','PERSONAL RESPONSABLE DEL DEPARTAMENTO AUDITADO','EQUIPO AUDITOR','DURACION DE CADA ACTIVIDAD'].map(h=>p(h)+p()).join('')+p('PROGRAMA DE AUDITORÍA')+table(8,2,'Hora')+p('ELABORACIÓN Y DISTRIBUCIÓN DEL INFORME DE AUDITORIA')+p());}
/**
 * D-136 (R6): plan CAPA ficticio con la estructura del Anexo IV del GC-00/033/04: cabecera (filas 4–5), rótulos (7),
 * tres bloques de ejemplo de tres filas (8–16), separación (17) y firmas (18–19). Sin contenido de la plantilla real.
 */
export function syntheticCapaPlanAnnexIV(){
  const cols='ABCDEFGHIJ'.split('');
  const c=(ref:string,text='',s=1)=>text?`<c r="${ref}" s="${s}" t="inlineStr"><is><t>${escapeXml(text)}</t></is></c>`:`<c r="${ref}" s="${s}"/>`;
  const row=(n:number,cells:Record<string,string>={},extra='')=>`<row r="${n}" spans="1:11"${extra}>${cols.map(col=>c(`${col}${n}`,cells[col]??'')).join('')}</row>`;
  const labels=['Nº','Tipo / criticidad','Descripción del hallazgo / recomendación','Código desviación','Causa Raíz','Código CAPA','Responsable','Fecha prevista','Estado','Fecha cierre'];
  const blocks=[8,11,14].flatMap(n=>[row(n,{},' ht="48" customHeight="1"'),row(n+1,{B:'Acciones / Justificación /Observaciones',H:'Evidencias'}),row(n+2,{},' ht="53.25" customHeight="1"')]);
  const merges=['A1:J1','C2:J2','A4:B4','A5:B5','E4:F4','E5:F5','I4:I5','J4:J5',...[8,11,14].flatMap(n=>[`A${n}:A${n+2}`,`B${n+1}:G${n+1}`,`H${n+1}:J${n+1}`,`B${n+2}:G${n+2}`,`H${n+2}:J${n+2}`]),'A18:J18','A19:J19'];
  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:K19"/><sheetData>${row(1,{A:'Anexo IV del PNT Nº GC-00/033/04 (ficticio)'})}${row(2,{C:'PLAN DE ACCIONES CORRECTIVAS Y PREVENTIVAS'})}<row r="3" spans="1:11"/>${row(4,{A:'Área, proceso o actividad auditada:',D:'Código auditoría:',G:'Fecha auditoría:',H:'__/__/____',I:'Versión:'})}${row(5,{A:'Tipo:',D:'Entidad Auditora:',G:'Fecha informe:',H:'__/__/____'})}<row r="6" spans="1:11"/>${row(7,Object.fromEntries(cols.map((col,i)=>[col,labels[i]])))}${blocks.join('')}${row(17)}${row(18,{A:'FIRMAS'})}${row(19,{},' ht="63.75" customHeight="1"')}</sheetData><mergeCells count="${merges.length}">${merges.map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells><dataValidations count="3"><dataValidation type="list" allowBlank="1" sqref="B14 B11 B8"><formula1>"Crítica,Mayor,Menor,Recomendación"</formula1></dataValidation><dataValidation type="list" allowBlank="1" sqref="C5"><formula1>"Auditoría Interna,Auditoría Externa,Auditoría de Cliente,Auditoría Subcontratada,Inspección"</formula1></dataValidation><dataValidation type="list" allowBlank="1" sqref="I14 I11 I8"><formula1>"Abierta,Pendiente,Cerrada"</formula1></dataValidation></dataValidations></worksheet>`;
  const workbook=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="AIV 00" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'AIV 00'!$A$1:$J$19</definedName></definedNames></workbook>`;
  return writeZip([{name:'[Content_Types].xml',data:Buffer.from('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')},{name:'xl/workbook.xml',data:Buffer.from(workbook)},{name:'xl/worksheets/sheet1.xml',data:Buffer.from(sheet)}]);
}
export function syntheticAuditCapaPlan(){return generateSimpleXlsx('CAPA Plan',Array(11).fill('Fixture'),Array.from({length:26},()=>Array(11).fill('')));}
export async function installSyntheticAuditTemplates(){
 if(process.env.APP_ENV!=='test')throw new Error('Las plantillas ficticias solo pueden instalarse en una BD de test.');
 const prefix=`TEST-R3C-${randomUUID()}`, ids:string[]=[];
 for(const [type,bytes] of [[DocumentType.AUDIT_INTERNAL_REPORT,syntheticAuditReport()],[DocumentType.AUDIT_EXTERNAL_REPORT,syntheticAuditReport(true)],[DocumentType.AUDIT_EXTERNAL_PLAN,syntheticAuditPlan()],[DocumentType.AUDIT_CAPA_PLAN,syntheticAuditCapaPlan()]] as const){
  const t=await prisma.templateVersion.create({data:{module:'AUDIT',documentType:type,versionCode:prefix,fileData:new Uint8Array(bytes),fileName:`${prefix}.${type==='AUDIT_CAPA_PLAN'?'xlsx':'docx'}`,fileSize:bytes.length,checksum:createHash('sha256').update(bytes).digest('hex'),effectiveFrom:new Date('2096-01-01')}});ids.push(t.id);
 }return ids;
}
export async function cleanupAuditR3cFixtures(recordIds:string[],templateIds:string[]=[]){
 const ids=(await prisma.audit.findMany({where:{qmsRecordId:{in:recordIds}},select:{id:true}})).map(a=>a.id);
 await prisma.reviewMessage.deleteMany({where:{reviewThread:{qmsRecordId:{in:recordIds}}}});await prisma.reviewThread.deleteMany({where:{qmsRecordId:{in:recordIds}}});
 await purgeLegacyFixtureDocuments(prisma, {recordVersion:{qmsRecordId:{in:recordIds}}});
    await prisma.recordVersionDocument.deleteMany({where:{recordVersion:{qmsRecordId:{in:recordIds}}}});await prisma.generatedDocument.deleteMany({where:{qmsRecordId:{in:recordIds}}});
 await prisma.auditFindingRelation.deleteMany({where:{finding:{auditId:{in:ids}}}});await prisma.auditFollowup.deleteMany({where:{auditId:{in:ids}}});await prisma.auditFindingAction.deleteMany({where:{finding:{auditId:{in:ids}}}});await prisma.auditFinding.deleteMany({where:{auditId:{in:ids}}});
 await prisma.qmsRelation.deleteMany({where:{OR:[{sourceRecordId:{in:recordIds}},{targetRecordId:{in:recordIds}}]}});await prisma.changeHistory.deleteMany({where:{qmsRecordId:{in:recordIds}}});await prisma.qmsRecordVersion.deleteMany({where:{qmsRecordId:{in:recordIds}}});
 await purgeFixtureCapaPlanVersions(prisma,ids);await prisma.auditParticipant.deleteMany({where:{auditId:{in:ids}}});await prisma.auditDepartment.deleteMany({where:{auditId:{in:ids}}});await prisma.audit.deleteMany({where:{id:{in:ids}}});await prisma.capa.deleteMany({where:{qmsRecordId:{in:recordIds}}});await prisma.deviation.deleteMany({where:{qmsRecordId:{in:recordIds}}});await prisma.qmsRecord.deleteMany({where:{id:{in:recordIds}}});
 await prisma.templateVersion.deleteMany({where:{id:{in:templateIds}}});
}
