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
export function syntheticAuditPlan(){return doc(p('PNT de pruebas, contenido anterior no exportable')+p('Anexo IV: Plan de Auditoría Covex, S.A.')+p('Anexo IV del PNT Nº GC-00/034/04')+p('PLAN DE AUDITORIA COVEX, S.A.')+p('Entidad Auditada:')+p('Fecha:')+p('Lugar de auditoría:')+['INTRODUCCIÓN','OBJETIVO/ALCANCE DE LA AUDITORIA','PERSONAL RESPONSABLE DEL DEPARTAMENTO AUDITADO','EQUIPO AUDITOR','DURACION DE CADA ACTIVIDAD'].map(h=>p(h)+p()).join('')+p('PROGRAMA DE AUDITORÍA')+table(8,2,'Hora')+p('ELABORACIÓN Y DISTRIBUCIÓN DEL INFORME DE AUDITORIA')+p());}
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
 await prisma.recordVersionDocument.deleteMany({where:{recordVersion:{qmsRecordId:{in:recordIds}}}});await prisma.generatedDocument.deleteMany({where:{qmsRecordId:{in:recordIds}}});
 await prisma.auditFindingRelation.deleteMany({where:{finding:{auditId:{in:ids}}}});await prisma.auditFollowup.deleteMany({where:{auditId:{in:ids}}});await prisma.auditFindingAction.deleteMany({where:{finding:{auditId:{in:ids}}}});await prisma.auditFinding.deleteMany({where:{auditId:{in:ids}}});
 await prisma.qmsRelation.deleteMany({where:{OR:[{sourceRecordId:{in:recordIds}},{targetRecordId:{in:recordIds}}]}});await prisma.changeHistory.deleteMany({where:{qmsRecordId:{in:recordIds}}});await prisma.qmsRecordVersion.deleteMany({where:{qmsRecordId:{in:recordIds}}});
 await prisma.auditParticipant.deleteMany({where:{auditId:{in:ids}}});await prisma.auditDepartment.deleteMany({where:{auditId:{in:ids}}});await prisma.audit.deleteMany({where:{id:{in:ids}}});await prisma.capa.deleteMany({where:{qmsRecordId:{in:recordIds}}});await prisma.deviation.deleteMany({where:{qmsRecordId:{in:recordIds}}});await prisma.qmsRecord.deleteMany({where:{id:{in:recordIds}}});
 await prisma.templateVersion.deleteMany({where:{id:{in:templateIds}}});
}
