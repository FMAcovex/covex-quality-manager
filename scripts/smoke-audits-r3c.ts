import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DocumentType } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { saveAudit, auditDefaults } from "../src/modules/audits/service";
import { saveAuditFinding, saveAuditFindingAction, retireAuditElement, linkAuditFinding, saveAuditFollowup } from "../src/modules/audits/finding-service";
import { saveAuditReport, issueAuditReport, closeAudit, readAuditSnapshot } from "../src/modules/audits/report-service";
import { generateAuditDocument, storeAuditSignedPdf, getAuditDocument, registerAuditAttachment, getAuditReportView } from "../src/modules/audits/documents/service";
import { auditClosureChecklist } from "../src/modules/audits/closure-policy";
import { establishCapaPlan, getCapaPlanVersionFile, recordCapaPlanFollowup } from "../src/modules/audits/capa-plan-service";
import { getAuditList } from "../src/modules/audits/queries";
import { createValidatedReviewThread, acceptValidatedReviewThread, resolveValidatedReviewThread, replyToValidatedReviewThread } from "../src/lib/qms/review/mutation-service";
import { auditFindingReviewTarget, auditActionReviewTarget, auditReviewTargets } from "../src/lib/qms/review/targets/audits";
import { getZipEntryText, readZip } from "../src/lib/ooxml/zip";
import { installSyntheticAuditTemplates, cleanupAuditR3cFixtures } from "./audits-r3c-fixtures";
if(process.env.APP_ENV!=='test')throw new Error('APP_ENV=test y BD aislada obligatorios.');
const actor='Smoke R3C ficticio', marker=`R3C-${randomUUID()}`, records:string[]=[], templates:string[]=[];
async function create(scenario:'INTERNAL_COVEX'|'SUPPLIER'|'CLIENT'|'AUTHORITY'='INTERNAL_COVEX'){
 const d=await prisma.department.findUniqueOrThrow({where:{code:'GC-00'}});
 const a=await saveAudit({actor,status:'OPEN',auditType:scenario==='INTERNAL_COVEX'?'INTERNAL':'EXTERNAL',scenario,title:marker,scope:'Alcance ficticio',plannedDate:'2096-10-07',performedDate:'2096-10-07',codingDepartmentId:scenario==='INTERNAL_COVEX'?d.id:'',departmentIds:scenario==='INTERNAL_COVEX'?[d.id]:[],entityCode:scenario==='SUPPLIER'?'TEST-R3C':'',auditedEntityName:'Entidad ficticia',externalReference:scenario==='CLIENT'||scenario==='AUTHORITY'?`${marker}-externa`:'',participants:[{role:'AUDITOR',displayName:actor,sortOrder:0}]});records.push(a.qmsRecordId);
 await saveAuditReport(a.id,{actor,reportDate:'2096-10-08',conclusion:'Conclusión inicial congelada',programme:'09:00 | Revisión documental',planIntroduction:'Introducción ficticia',activityDuration:'09:00–12:00',preparedBy:actor});return a;
}
const pdf=()=>new File(['%PDF-1.7\n% Ficticio para pruebas\n'],'firmado-ficticio.pdf',{type:'application/pdf'});
async function main(){
 if(process.env.R3C_OFFICIAL_TEMPLATES!=='1')templates.push(...await installSyntheticAuditTemplates());
 const a=await create(), other=await create();
 const obs=await saveAuditFinding(a.id,{actor,findingType:'FINDING',criticality:'MAJOR',description:'OBS histórica inicial',treatment:'Acción local aplicable'});
 const rk=await saveAuditFinding(a.id,{actor,findingType:'RECOMMENDATION',description:'Rk histórica',treatment:'Mejora no aplicable justificada',treatmentStatus:'NOT_APPLICABLE',evidence:'Justificación documentada'});
 const action=await saveAuditFindingAction(a.id,obs.id,{actor,description:'Acción inicial histórica',status:'OPEN'});
 const capa=await prisma.qmsRecord.create({data:{recordType:'CAPA',businessCode:`${marker}-CAPA`}});records.push(capa.id);
 await prisma.capa.create({data:{qmsRecordId:capa.id,actionType:'CORRECTIVE',status:'OPEN',effectivenessStatus:'PENDING'}});await linkAuditFinding(a.id,obs.id,capa.id,actor);
 // D-110 (R5C1): el CAPA plan se establece (versión 00) sin informe emitido y queda congelado.
 const planRequest=randomUUID(), established=await establishCapaPlan(a.id,{actor,requestId:planRequest,capaPlanDate:'2096-10-08'});
 assert.equal(established.sequenceNumber,0);assert.equal(established.kind,'ESTABLISHED');assert.equal(await prisma.qmsRecordVersion.count({where:{qmsRecordId:a.qmsRecordId}}),0);
 const planSheet=getZipEntryText(readZip(Buffer.from((await getCapaPlanVersionFile(a.id,0)).fileData)),'xl/worksheets/sheet1.xml');assert(planSheet.includes('OBS histórica inicial'));assert(/r="K7"[^>]*>[\s\S]*?00/.test(planSheet)||planSheet.includes('>00<'));
 const establishedAudit=await prisma.audit.findUniqueOrThrow({where:{id:a.id}});assert.equal(establishedAudit.capaPlanDate?.toISOString().slice(0,10),'2096-10-08');assert(establishedAudit.capaPlanEstablishedAt);
 assert.equal((await establishCapaPlan(a.id,{actor,requestId:planRequest,capaPlanDate:'2096-10-08'})).id,established.id,'Reintentar la misma solicitud devuelve la misma versión 00.');
 await assert.rejects(establishCapaPlan(a.id,{actor,requestId:planRequest,capaPlanDate:'2096-10-09'}),/otros datos/);
 await assert.rejects(establishCapaPlan(a.id,{actor,requestId:randomUUID(),capaPlanDate:'2096-10-08'}),/ya está establecido/);
 await assert.rejects(prisma.auditCapaPlanVersion.update({where:{id:established.id},data:{generatedBy:'Manipulado'}}),/immutable/);
 await prisma.audit.update({where:{id:other.id},data:{status:'DRAFT'}});
 await assert.rejects(establishCapaPlan(other.id,{actor,requestId:randomUUID(),capaPlanDate:'2096-10-08'}),/Abre la auditoría/);
 await prisma.audit.update({where:{id:other.id},data:{status:'OPEN',capaPlanEstablishedAt:new Date('2096-10-01T00:00:00.000Z')}});
 await establishCapaPlan(other.id,{actor,requestId:randomUUID(),capaPlanDate:'2096-10-02'});
 assert.equal((await prisma.audit.findUniqueOrThrow({where:{id:other.id}})).capaPlanEstablishedAt?.toISOString().slice(0,10),'2096-10-01','Se conserva la fecha de establecimiento anterior.');
 // R5C2: el seguimiento actualiza acciones/hallazgos y emite la versión 01 con su A4.03.
 const fu=await create(),fuObs=await saveAuditFinding(fu.id,{actor,findingType:'FINDING',criticality:'MINOR',description:'OBS de seguimiento R5C2'}),fuAction=await saveAuditFindingAction(fu.id,fuObs.id,{actor,description:'Acción de seguimiento R5C2',status:'OPEN'});
 const fuRk=await saveAuditFinding(fu.id,{actor,findingType:'RECOMMENDATION',description:'Rk sin acciones R5C2'});
 await assert.rejects(recordCapaPlanFollowup(fu.id,{actor,requestId:randomUUID(),followupDate:'2096-10-09'}),/versión 00/);
 await establishCapaPlan(fu.id,{actor,requestId:randomUUID(),capaPlanDate:'2096-10-08'});
 const followupForm=async(extra:Record<string,string>)=>{const act=await prisma.auditFindingAction.findUniqueOrThrow({where:{id:fuAction.id}}),rk=await prisma.auditFinding.findUniqueOrThrow({where:{id:fuRk.id}});return {actor,requestId:randomUUID(),followupDate:'2096-10-09',nextReviewDate:'',observations:'',changeReason:'',
  [`a.${act.id}.status`]:act.status,[`a.${act.id}.closedAt`]:act.closedAt?.toISOString().slice(0,10)??'',[`a.${act.id}.targetDate`]:act.targetDate?.toISOString().slice(0,10)??'',[`a.${act.id}.evidenceReference`]:act.evidenceReference??'',[`a.${act.id}.evidence`]:act.evidence??'',[`a.${act.id}.updatedAt`]:act.updatedAt.toISOString(),
  [`f.${rk.id}.treatmentStatus`]:rk.treatmentStatus,[`f.${rk.id}.treatment`]:rk.treatment??'',[`f.${rk.id}.closedAt`]:'',[`f.${rk.id}.evidenceReference`]:rk.evidenceReference??'',[`f.${rk.id}.evidence`]:rk.evidence??'',[`f.${rk.id}.updatedAt`]:rk.updatedAt.toISOString(),...extra};};
 await assert.rejects(recordCapaPlanFollowup(fu.id,await followupForm({})),/No hay cambios/);
 await assert.rejects(recordCapaPlanFollowup(fu.id,await followupForm({[`a.${fuAction.id}.status`]:'CLOSED',[`a.${fuAction.id}.closedAt`]:'2096-10-09',[`a.${fuAction.id}.evidenceReference`]:'REG-R5C2'})),/motivo/);
 await assert.rejects(recordCapaPlanFollowup(fu.id,await followupForm({[`a.${fuAction.id}.status`]:'CLOSED',changeReason:'Cierre'})),/fecha/);
 await assert.rejects(recordCapaPlanFollowup(fu.id,await followupForm({[`f.${fuRk.id}.treatmentStatus`]:'NOT_APPLICABLE',[`f.${fuRk.id}.evidence`]:'Justificación',changeReason:'No procede'})),/tratamiento/);
 const closeForm=await followupForm({[`a.${fuAction.id}.status`]:'CLOSED',[`a.${fuAction.id}.closedAt`]:'2096-10-09',[`a.${fuAction.id}.evidenceReference`]:'REG-R5C2',[`f.${fuRk.id}.treatmentStatus`]:'NOT_APPLICABLE',[`f.${fuRk.id}.treatment`]:'No procede en este ciclo',[`f.${fuRk.id}.evidence`]:'Justificación documentada',changeReason:'Acción ejecutada y Rk descartada',observations:'Revisión del CAPA plan'});
 const fu01=await recordCapaPlanFollowup(fu.id,closeForm);assert.equal(fu01.sequenceNumber,1);assert.equal(fu01.kind,'FOLLOWUP');assert.equal(fu01.observations,'Revisión del CAPA plan');
 assert.equal((await prisma.auditFindingAction.findUniqueOrThrow({where:{id:fuAction.id}})).status,'CLOSED');assert.equal((await prisma.auditFinding.findUniqueOrThrow({where:{id:fuRk.id}})).treatmentStatus,'NOT_APPLICABLE');
 const sheet01=getZipEntryText(readZip(Buffer.from((await getCapaPlanVersionFile(fu.id,1)).fileData)),'xl/worksheets/sheet1.xml');assert(sheet01.includes('Cerrada'));assert(sheet01.includes('REG-R5C2'));
 assert.equal((await recordCapaPlanFollowup(fu.id,closeForm)).id,fu01.id,'Reenviar el mismo seguimiento devuelve la misma versión.');
 const stale=await followupForm({observations:'Observación tardía'});stale[`a.${fuAction.id}.updatedAt`]=new Date(0).toISOString();
 await assert.rejects(recordCapaPlanFollowup(fu.id,stale),/cambió/);
 const fu02=await recordCapaPlanFollowup(fu.id,await followupForm({observations:'Solo observación, sin cambios'}));assert.equal(fu02.sequenceNumber,2);
 assert.equal(await prisma.auditCapaPlanVersion.count({where:{auditId:fu.id}}),3);
 const v00=await issueAuditReport(a.id,{actor});assert.equal(v00.sequenceNumber,0);assert(v00.frozenAt);
 const before=JSON.stringify(v00.snapshot), s00=readAuditSnapshot(v00.snapshot);assert.equal(s00.audit.findings.length,2);
 const comment=async(t:ReturnType<typeof auditFindingReviewTarget>)=>createValidatedReviewThread({qmsRecordId:a.qmsRecordId,recordVersionId:v00.id,...t,fieldLabelSnapshot:t.label,valueSnapshot:t.valueSnapshot,createdByText:actor,initialMessage:'Observación histórica de pruebas'});
 const findingThread=await comment({...auditFindingReviewTarget(obs.id,{reference:obs.reference,description:obs.description}),label:obs.reference});
 await comment(auditActionReviewTarget(action.id,{description:action.description}));
 await createValidatedReviewThread({qmsRecordId:a.qmsRecordId,...auditReviewTargets.planning,initialMessage:'Planificación',createdByText:actor});
 await assert.rejects(createValidatedReviewThread({qmsRecordId:other.qmsRecordId,...auditFindingReviewTarget(obs.id,null),initialMessage:'Ajeno',createdByText:actor}),/pertenece/);
 const report=await generateAuditDocument(a.id,DocumentType.AUDIT_INTERNAL_REPORT,0,actor);assert.equal(report.recordVersionId,v00.id);assert(report.templateVersionId);assert(report.fileData);
 let xml=getZipEntryText(readZip(Buffer.from(report.fileData!)),'word/document.xml');assert(xml.includes('OBS histórica inicial'));assert(xml.includes('Conclusión inicial congelada'));
 // D-110 (R5C2): las versiones del informe ya no generan A4.03; el CAPA plan tiene su secuencia propia.
 await assert.rejects(generateAuditDocument(a.id,DocumentType.AUDIT_CAPA_PLAN,0,actor),/versiones propias/);
 const plan=await getCapaPlanVersionFile(a.id,0);assert(getZipEntryText(readZip(Buffer.from(plan.fileData!)),'xl/worksheets/sheet1.xml').includes(capa.businessCode!));
 const signed00=await storeAuditSignedPdf(a.id,v00.id,pdf(),actor);await assert.rejects(storeAuditSignedPdf(a.id,v00.id,pdf(),actor),/sobrescribe/);
 await assert.rejects(storeAuditSignedPdf(other.id,v00.id,pdf(),actor),/pertenece/);await assert.rejects(storeAuditSignedPdf(a.id,v00.id,new File(['bad'],'no.pdf'),actor),/Cabecera/);
 const now=await prisma.audit.findUniqueOrThrow({where:{id:a.id},include:{qmsRecord:true,departments:true,participants:true}});
 await saveAudit({...auditDefaults(now),title:`${marker} editada`},a.id);
 await saveAuditFinding(a.id,{actor,findingType:'FINDING',criticality:'MAJOR',description:'OBS editada viva',treatment:'Acción local'},obs.id);
 await retireAuditElement(a.id,rk.id,{actor,reason:'Retirada posterior al informe 00'});
 await saveAuditFinding(a.id,{actor,findingType:'RECOMMENDATION',description:'Rk posterior',treatment:'No procede',treatmentStatus:'NOT_APPLICABLE',evidence:'Justificación'});
 await saveAuditFollowup(a.id,{actor,followupDate:'2096-10-09',completedByText:actor,description:'Seguimiento ordinario'});
 assert.equal(await prisma.qmsRecordVersion.count({where:{qmsRecordId:a.qmsRecordId}}),1,'El seguimiento/edición no crea versiones del informe.');
 await saveAuditReport(a.id,{actor,reportDate:'2096-10-10',conclusion:'Conclusión revisada',programme:'10:00 | Revisión'});
 await assert.rejects(issueAuditReport(a.id,{actor}),/motivo/);
 const v01=await issueAuditReport(a.id,{actor,reason:'Revisión formal justificada'});assert.equal(v01.sequenceNumber,1);
 assert.equal(JSON.stringify((await prisma.qmsRecordVersion.findUniqueOrThrow({where:{id:v00.id}})).snapshot),before);
 assert.equal((await prisma.reviewThread.findUniqueOrThrow({where:{id:findingThread.id}})).recordVersionId,v00.id);
 await assert.rejects(createValidatedReviewThread({qmsRecordId:a.qmsRecordId,recordVersionId:v00.id,...auditFindingReviewTarget(obs.id,null),initialMessage:'Vieja',createdByText:actor}),/vigente/);
 await replyToValidatedReviewThread({qmsRecordId:a.qmsRecordId,reviewThreadId:findingThread.id,message:'Respuesta histórica',createdByText:actor});await acceptValidatedReviewThread({qmsRecordId:a.qmsRecordId,reviewThreadId:findingThread.id,acceptedByText:actor});await resolveValidatedReviewThread({qmsRecordId:a.qmsRecordId,reviewThreadId:findingThread.id,resolvedByText:actor,resolutionNote:'Resuelta sin mover versión'});
 const signed01=await storeAuditSignedPdf(a.id,v01.id,pdf(),actor);assert.notEqual(signed01.id,signed00.id);assert.equal((await getAuditDocument(a.id,signed00.id,true)).checksum,signed00.checksum);
 const regenerated=await generateAuditDocument(a.id,DocumentType.AUDIT_INTERNAL_REPORT,0,actor);assert.equal(regenerated.id,report.id);assert.equal(regenerated.checksum,report.checksum);
 const report01=await generateAuditDocument(a.id,DocumentType.AUDIT_INTERNAL_REPORT,1,actor);xml=getZipEntryText(readZip(Buffer.from(report01.fileData!)),'word/document.xml');assert(xml.includes('OBS editada viva'));assert(!xml.includes('Rk histórica'));assert(xml.includes('Rk posterior'));
 await assert.rejects(closeAudit(a.id,{actor,closedAt:'2096-10-11'}),/acción pendiente/);
 await saveAuditFindingAction(a.id,obs.id,{actor,description:action.description,status:'CLOSED',closedAt:'2096-10-11',evidence:'Registro de ejecución',verificationResult:'PENDING'},action.id);
 // D-110: sin verificación ni CAPA vinculada cerrada; solo aviso porque la 00 ya no refleja el estado actual.
 const preClose=auditClosureChecklist((await getAuditReportView(a.id))!.closure);assert.deepEqual(preClose.blockers,[]);assert.match(preClose.warnings.join(' '),/seguimiento final/);
 assert.equal((await prisma.capa.findUniqueOrThrow({where:{qmsRecordId:capa.id}})).status,'OPEN','La CAPA vinculada sigue abierta y no bloquea.');
 const closed=await closeAudit(a.id,{actor,closedAt:'2096-10-11'});assert.equal(closed.status,'CLOSED');assert(closed.closedAt);
 await assert.rejects(saveAudit({...auditDefaults(now),status:'OPEN'},a.id),/reabre/);
 // R5: closed audits stay editable by explicit decision, but preserve status,
 // close date and previously frozen documents/snapshots.
 const afterClosure=await prisma.audit.findUniqueOrThrow({where:{id:a.id},include:{qmsRecord:true,departments:true,participants:true}});
 const originalCloseDate=afterClosure.closedAt?.toISOString();
 await saveAudit({...auditDefaults(afterClosure),title:'Auditoría cerrada editable R5'},a.id);
 await saveAuditReport(a.id,{actor,reportDate:'2096-10-10',conclusion:'Conclusión editada tras cierre'});
 const afterClosedEdit=await prisma.audit.findUniqueOrThrow({where:{id:a.id}});
 assert.equal(afterClosedEdit.status,'CLOSED');assert.equal(afterClosedEdit.closedAt?.toISOString(),originalCloseDate);
 const v02=await issueAuditReport(a.id,{actor,reason:'Corrección documental posterior al cierre'});
 assert.equal(v02.sequenceNumber,2);
 assert.equal(JSON.stringify((await prisma.qmsRecordVersion.findUniqueOrThrow({where:{id:v00.id}})).snapshot),before);
 assert.equal((await getAuditDocument(a.id,signed00.id,true)).checksum,signed00.checksum);
 await saveAuditFollowup(a.id,{actor,followupDate:'2096-10-12',completedByText:actor,description:'Seguimiento registrado después del cierre',nextReviewDate:'2096-11-01'});
 assert.equal((await prisma.audit.findUniqueOrThrow({where:{id:a.id}})).status,'CLOSED');
 const supplier=await create('SUPPLIER'), critical=await create('SUPPLIER');
 await saveAuditFinding(supplier.id,{actor,findingType:'FINDING',criticality:'MINOR',description:'Deficiencia pendiente del proveedor'});await saveAuditFinding(critical.id,{actor,findingType:'FINDING',criticality:'CRITICAL',description:'Crítico del proveedor'});
 for(const x of [supplier,critical]){await issueAuditReport(x.id,{actor});await saveAuditReport(x.id,{actor,reportDate:'2096-10-08',conclusion:'Proveedor evaluado',programme:'09:00 | Visita',planIntroduction:'Objetivo',activityDuration:'09:00–12:00',reportSentAt:'2096-10-09'});}
 const supplierReport=await generateAuditDocument(supplier.id,DocumentType.AUDIT_EXTERNAL_REPORT,0,actor);assert(getZipEntryText(readZip(Buffer.from(supplierReport.fileData!)),'word/document.xml').includes('EXTERNA'));
 const externalPlan=await generateAuditDocument(supplier.id,DocumentType.AUDIT_EXTERNAL_PLAN,0,actor);const planXml=getZipEntryText(readZip(Buffer.from(externalPlan.fileData!)),'word/document.xml');assert(planXml.includes('PLAN DE AUDITORIA COVEX'));
 if(process.env.R3C_QA_OUTPUT){const dir=path.resolve(process.env.R3C_QA_OUTPUT);await mkdir(dir,{recursive:true});for(const [name,document] of [["interno-00.docx",report],["interno-01.docx",report01],["externo-00.docx",supplierReport],["plan-externo-00.docx",externalPlan],["capa-plan-00.xlsx",plan]] as const)await writeFile(path.join(dir,name),document.fileData!);}assert(!planXml.includes('contenido anterior no exportable'));
 await assert.rejects(closeAudit(supplier.id,{actor,closedAt:'2096-10-12',supplierException:true}),/justificación/);
 await assert.rejects(closeAudit(critical.id,{actor,closedAt:'2096-10-12',supplierException:true,reason:'Sin respuesta',verifyAtNextAudit:true}),/críticos/);
 await assert.rejects(closeAudit(other.id,{actor,closedAt:'2096-10-12',supplierException:true,reason:'No aplica',verifyAtNextAudit:true}),/solo aplica/);
 const normalSupplier=await create('SUPPLIER');const normalObs=await saveAuditFinding(normalSupplier.id,{actor,findingType:'FINDING',criticality:'MINOR',description:'Deficiencia normal resuelta',treatment:'Corrección documentada'});
 await saveAuditFindingAction(normalSupplier.id,normalObs.id,{actor,description:'Corrección proveedor implantada',status:'CLOSED',closedAt:'2096-10-10',evidence:'Registro proveedor',verificationResult:'CONFORMING',verifiedAt:'2096-10-11',verifiedBy:actor});
 await issueAuditReport(normalSupplier.id,{actor});await saveAuditReport(normalSupplier.id,{actor,reportDate:'2096-10-08',conclusion:'Cierre normal proveedor',reportSentAt:'2096-10-09'});
 await registerAuditAttachment(normalSupplier.id,pdf(),{type:'AUDIT_RESPONSE',reference:'Respuesta proveedor',date:'2096-10-10',externalVersion:'1',observations:'Respuesta real del fixture sin marcar fecha manual en Audit',actor,documentName:'CAPA proveedor'});
 await assert.rejects(closeAudit(normalSupplier.id,{actor,closedAt:'2096-10-12',supplierException:true,reason:'No cabe excepción',verifyAtNextAudit:true}),/ausencia de respuesta/);
 await assert.rejects(closeAudit(normalSupplier.id,{actor,closedAt:'2096-10-12'}),/Establece el CAPA plan/);await establishCapaPlan(normalSupplier.id,{actor,requestId:randomUUID(),capaPlanDate:'2096-10-11'});
 assert.equal((await closeAudit(normalSupplier.id,{actor,closedAt:'2096-10-12'})).status,'CLOSED');
 const supplierClosed=await closeAudit(supplier.id,{actor,closedAt:'2096-10-12',supplierException:true,reason:'Proveedor sin respuesta; comprobar en siguiente auditoría',verifyAtNextAudit:true});assert(supplierClosed.verifyAtNextAudit);assert(supplierClosed.supplierExceptionBy);
 for(const scenario of ['CLIENT','AUTHORITY'] as const){const x=await create(scenario);await assert.rejects(issueAuditReport(x.id,{actor}),/no se emite informe COVEX/);const received=await registerAuditAttachment(x.id,pdf(),{type:'AUDIT_RECEIVED',reference:`${marker}-acta`,date:'2096-10-07',externalVersion:'Rev-external-7',observations:'Acta recibida ficticia',actor,documentName:'Acta externa'});const receivedObs=await saveAuditFinding(x.id,{actor,findingType:scenario==='CLIENT'?'CLIENT_OBSERVATION':'AUTHORITY_OBSERVATION',description:'Observación del acta',treatment:'Respuesta COVEX'});const receivedAction=await saveAuditFindingAction(x.id,receivedObs.id,{actor,description:'Corrección COVEX',status:'OPEN'});await assert.rejects(issueAuditReport(x.id,{actor}),/no se emite informe COVEX/);await prisma.audit.update({where:{id:x.id},data:{conclusion:'Conclusión previa conservada',reportDate:new Date('2096-10-08T00:00:00.000Z')}});await saveAuditReport(x.id,{actor,responseRequired:true,internalObservations:'Observación interna R5D',conclusion:'Ignorada'});{const kept=await prisma.audit.findUniqueOrThrow({where:{id:x.id}});assert.equal(kept.conclusion,'Conclusión previa conservada');assert.equal(kept.reportDate?.toISOString().slice(0,10),'2096-10-08');assert.equal(kept.internalObservations,'Observación interna R5D');assert(kept.responseRequired);}await assert.rejects(closeAudit(x.id,{actor,closedAt:'2096-10-12'}),/respuesta requerida/);await saveAuditReport(x.id,{actor,responseRequired:true,responseSentAt:'2096-10-10'});await assert.rejects(closeAudit(x.id,{actor,closedAt:'2096-10-12'}),/acción pendiente/);await saveAuditFindingAction(x.id,receivedObs.id,{actor,description:'Corrección COVEX',status:'CLOSED',closedAt:'2096-10-11',evidence:'Ejecución documentada, sin regla universal de eficacia local'},receivedAction.id);await assert.rejects(closeAudit(x.id,{actor,closedAt:'2096-10-12'}),/Establece el CAPA plan/);await establishCapaPlan(x.id,{actor,requestId:randomUUID(),capaPlanDate:'2096-10-11'});await closeAudit(x.id,{actor,closedAt:'2096-10-12'});assert((await getAuditDocument(x.id,received.id)).fileData);}
 const concurrent=await Promise.all([issueAuditReport(other.id,{actor,reason:'Emisión concurrente A'}),issueAuditReport(other.id,{actor,reason:'Emisión concurrente B'})]);assert.deepEqual(concurrent.map(v=>v.sequenceNumber).sort(),[0,1]);
 const view=await getAuditReportView(a.id);assert.deepEqual(view!.versions.map(v=>v.sequenceNumber),[2,1,0]);assert(auditClosureChecklist(view!.closure).partial);
 assert((await getAuditList({q:marker,report:'issued'})).rows.some(r=>r.id===a.id));assert(!(await getAuditList({q:marker,signedPdf:'yes'})).rows.some(r=>r.id===a.id));assert((await getAuditList({q:marker,signedPdf:'no'})).rows.some(r=>r.id===a.id));assert((await getAuditList({q:marker,review:'ACTIVE'})).rows.some(r=>r.id===a.id));
 await prisma.qmsRecord.update({where:{id:other.qmsRecordId},data:{isActive:false}});await assert.rejects(issueAuditReport(other.id,{actor,reason:'Anulado'}),/Reactiva/);await assert.rejects(generateAuditDocument(other.id,DocumentType.AUDIT_CAPA_PLAN,0,actor),/Reactiva/);
 console.log(`R3C PostgreSQL OK: versiones 00/01+, motivo/concurrencia/snapshot/retirados, documentos ${process.env.R3C_OFFICIAL_TEMPLATES==='1'?'con binarios oficiales verificados':'con fixtures sintéticos'}, PDF independiente/no sobrescritura, Review UUID/histórico, cierre interno/CAPA y proveedor/excepción/crítico, cliente/autoridad, filtros/anulación.`);
}
main().finally(async()=>{await cleanupAuditR3cFixtures(records,templates);await prisma.$disconnect();}).catch(e=>{console.error(e);process.exitCode=1;});
