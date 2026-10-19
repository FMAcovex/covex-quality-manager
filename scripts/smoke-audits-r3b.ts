import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { saveAudit, auditDefaults } from "../src/modules/audits/service";
import { saveAuditFinding, saveAuditFindingAction, saveAuditFollowup, retireAuditElement, linkAuditFinding, retireAuditAttribution, unlinkAuditRecord } from "../src/modules/audits/finding-service";
import { getAuditWork, getAuditOrigins } from "../src/modules/audits/finding-queries";
import { getAuditList } from "../src/modules/audits/queries";
import { getCapaList } from "../src/modules/capa/queries";
import { createQmsRelation, syncOperationalOriginRelations } from "../src/lib/qms/relation-service";
import { changeAdministrativeStatus } from "../src/lib/qms/administrative-status";
import { serializeCapaVersion, ensureInitialVersion, startNextVersion, snapshotJson } from "../src/lib/qms/versioning";
import { seedAuditDemo } from "../src/modules/audits/seed-demo";
if (process.env.APP_ENV !== "test") throw new Error("Usar APP_ENV=test y una BD aislada.");
const marker = `R3B-${randomUUID()}`, actor = "Smoke R3B", records:string[]=[];
export async function cleanupAuditR3bFixtures(recordIds:string[]) {
  const ids = (await prisma.audit.findMany({where:{qmsRecordId:{in:recordIds}},select:{id:true}})).map(a=>a.id);
  await prisma.auditFindingRelation.deleteMany({where:{OR:[{finding:{auditId:{in:ids}}},{qmsRelation:{OR:[{sourceRecordId:{in:recordIds}},{targetRecordId:{in:recordIds}}]}}]}});
  await prisma.auditFollowup.deleteMany({where:{auditId:{in:ids}}}); await prisma.auditFindingAction.deleteMany({where:{finding:{auditId:{in:ids}}}}); await prisma.auditFinding.deleteMany({where:{auditId:{in:ids}}});
  await prisma.qmsRelation.deleteMany({where:{OR:[{sourceRecordId:{in:recordIds}},{targetRecordId:{in:recordIds}}]}});
  await prisma.changeHistory.deleteMany({where:{qmsRecordId:{in:recordIds}}}); await prisma.qmsRecordVersion.deleteMany({where:{qmsRecordId:{in:recordIds}}});
  await prisma.auditParticipant.deleteMany({where:{auditId:{in:ids}}}); await prisma.auditDepartment.deleteMany({where:{auditId:{in:ids}}}); await prisma.audit.deleteMany({where:{id:{in:ids}}});
  await prisma.deviation.deleteMany({where:{qmsRecordId:{in:recordIds}}}); await prisma.capa.deleteMany({where:{qmsRecordId:{in:recordIds}}}); await prisma.qmsRecord.deleteMany({where:{id:{in:recordIds}}});
}
async function createAudit(status:"DRAFT"|"OPEN"="OPEN") {
  const department = await prisma.department.findUniqueOrThrow({where:{code:"GC-00"}});
  const audit=await saveAudit({actor,status,auditType:"INTERNAL",scenario:"INTERNAL_COVEX",title:marker,scope:"Ficticio",plannedDate:"2096-10-07",codingDepartmentId:department.id,departmentIds:[department.id],participants:[{displayName:actor,role:"AUDITOR",sortOrder:0}]}); records.push(audit.qmsRecordId); return audit;
}
async function main() {
  const draft=await createAudit("DRAFT"); const audit=await saveAudit({...auditDefaults(draft),status:"OPEN"},draft.id), other=await createAudit();
  const target=async(type:"DEVIATION"|"CAPA",status:"DRAFT"|"OPEN"="OPEN") => {
    const q=await prisma.qmsRecord.create({data:{recordType:type,businessCode:`${marker}-${type}-${status}`}}); records.push(q.id);
    if(type==="DEVIATION") await prisma.deviation.create({data:{qmsRecordId:q.id,status,whatHappened:"Ficticio"}});
    else await prisma.capa.create({data:{qmsRecordId:q.id,status,defectDescription:"Ficticio",actionType:"CORRECTIVE"}});
    return q;
  };
  const deviation=await target("DEVIATION"), capa=await target("CAPA"), draftCapa=await target("CAPA","DRAFT");
  const capaSource=await prisma.capa.findUniqueOrThrow({where:{qmsRecordId:capa.id},include:{qmsRecord:{include:{targetRelations:{include:{sourceRecord:true}}}},plannedActions:true,actionFollowups:true,followups:true,formVersion:true,annexIIITemplateVersion:true}});
  await prisma.$transaction(tx=>ensureInitialVersion(tx,capa.id,snapshotJson(serializeCapaVersion(capaSource)),actor));
  const obs=await saveAuditFinding(audit.id,{actor,findingType:"FINDING",criticality:"MAJOR",description:`Descripción ${marker}`});
  const rk=await saveAuditFinding(audit.id,{actor,findingType:"RECOMMENDATION",description:"Recomendación libre"});
  assert.equal(obs.reference,"OBS 01"); assert.equal(rk.reference,"Rk 01"); assert.equal(rk.criticality,"NA");
  const edited=await saveAuditFinding(audit.id,{actor,findingType:obs.findingType,criticality:obs.criticality,sortOrder:90,description:`Editada ${marker}`,expectedUpdatedAt:obs.updatedAt.toISOString()},obs.id); assert.equal(edited.id,obs.id); assert.equal(edited.reference,obs.reference);
  await assert.rejects(saveAuditFinding(audit.id,{actor,findingType:obs.findingType,description:obs.description,expectedUpdatedAt:obs.updatedAt.toISOString()},obs.id),/cambió/);
  const foreign=await saveAuditFinding(other.id,{actor,findingType:"CLIENT_OBSERVATION",description:"Otro expediente"});
  await assert.rejects(saveAuditFinding(audit.id,{actor,findingType:"FINDING",description:"Ajeno"},foreign.id),/pertenece/);
  const [parallel1,parallel2]=await Promise.all([saveAuditFinding(audit.id,{actor,findingType:"FINDING",description:"Concurrencia A"}),saveAuditFinding(audit.id,{actor,findingType:"AUTHORITY_OBSERVATION",description:"Concurrencia B"})]); assert.deepEqual([parallel1.reference,parallel2.reference].sort(),["OBS 02","OBS 03"]);
  const action1=await saveAuditFindingAction(audit.id,obs.id,{actor,description:`Acción ${marker}`,responsible:"Ficticio",targetDate:"2026-11-01",status:"OPEN"});
  const action2=await saveAuditFindingAction(audit.id,obs.id,{actor,description:"Acción segunda",status:"IN_PROGRESS",sortOrder:10});
  const changed=await saveAuditFindingAction(audit.id,obs.id,{actor,description:action1.description,status:"PENDING_VERIFICATION",sortOrder:20},action1.id); assert.equal(changed.id,action1.id);
  await assert.rejects(saveAuditFindingAction(audit.id,rk.id,{actor,description:"Ajeno"},action1.id),/pertenece/);
  await assert.rejects(saveAuditFindingAction(audit.id,obs.id,{actor,description:"Cerrar",status:"CLOSED"},action2.id),/fecha/);
  await saveAuditFindingAction(audit.id,obs.id,{actor,description:"Cerrada",status:"CLOSED",closedAt:"2026-10-07",evidenceReference:"REF-DEMO",verificationComment:"Verificación ficticia"},action2.id);
  await saveAuditFindingAction(audit.id,obs.id,{actor,description:"Reabierta",status:"OPEN"},action2.id);
  const general=await saveAuditFollowup(audit.id,{actor,followupDate:"2026-10-07",completedByText:actor,description:"General",nextReviewDate:"2026-11-05"});
  const specific=await saveAuditFollowup(audit.id,{actor,findingId:obs.id,followupDate:"2026-10-08",completedByText:actor,description:"OBS",nextReviewDate:"2026-11-10",evidenceReference:"Referencia textual"});
  const updatedSpecific=await saveAuditFollowup(audit.id,{actor,findingId:obs.id,followupDate:"2026-10-08",completedByText:actor,description:"OBS editado",nextReviewDate:"2026-11-10"},specific.id); assert.equal(updatedSpecific.id,specific.id);
  assert.equal(general.findingId,null); assert.equal(specific.findingId,obs.id);
  await assert.rejects(saveAuditFollowup(audit.id,{actor,findingId:foreign.id,followupDate:"2026-10-07",completedByText:actor,description:"Ajeno"}),/pertenece/);
  assert.equal((await getAuditWork(audit.id))!.followups[0].id,specific.id);
  await linkAuditFinding(audit.id,obs.id,deviation.id,actor);
  const attr1=await linkAuditFinding(audit.id,obs.id,capa.id,actor), attr2=await linkAuditFinding(audit.id,rk.id,capa.id,actor);
  assert.equal(attr1.qmsRelationId,attr2.qmsRelationId); assert.equal(await prisma.qmsRelation.count({where:{sourceRecordId:audit.qmsRecordId,targetRecordId:capa.id}}),1);
  await assert.rejects(linkAuditFinding(audit.id,obs.id,capa.id,actor),/ya está/);
  await assert.rejects(linkAuditFinding(audit.id,foreign.id,capa.id,actor),/pertenece/);
  // R5B1 (D-110): un borrador de CAPA se puede atribuir; se retira para no alterar el resto del recorrido.
  const draftAttr=await linkAuditFinding(audit.id,rk.id,draftCapa.id,actor); assert.equal(draftAttr.isActive,true);
  await retireAuditAttribution(audit.id,rk.id,draftAttr.id,{actor,reason:"Retirada del borrador vinculado"}); await unlinkAuditRecord(audit.id,draftCapa.id,{actor,reason:"Limpieza del borrador vinculado"});
  await assert.rejects(linkAuditFinding(audit.id,obs.id,audit.qmsRecordId,actor),/existente y activa/);
  assert.equal((await getAuditOrigins(capa.id))[0].auditFindingRelations.length,2); assert.equal((await getAuditOrigins(deviation.id))[0].sourceRecordId,audit.qmsRecordId);
  const snapshot=await prisma.qmsRecordVersion.findFirstOrThrow({where:{qmsRecordId:capa.id}});
  const origin=((snapshot.snapshot as {capa:{origins:{recordType:string;findings:{reference:string}[]}[]}}).capa.origins).find(o=>o.recordType==="AUDIT")!; assert.deepEqual(origin.findings.map(f=>f.reference).sort(),["OBS 01","Rk 01"]);
  await prisma.$transaction(tx=>startNextVersion(tx,capa.id,"FOLLOWUP",snapshotJson(snapshot.snapshot),actor,"Seguimiento fixture"));
  await assert.rejects(unlinkAuditRecord(audit.id,capa.id,{actor,reason:"Aún atribuido"}),/atribuciones/);
  await assert.rejects(prisma.$transaction(tx=>syncOperationalOriginRelations(tx,{capaRecordId:capa.id,originRecordIds:[],changedByText:actor})),/atribuciones/);
  for(const filters of [{q:marker,findings:"yes"},{q:marker,criticality:["MAJOR"]},{q:marker,pendingActions:"yes"},{q:marker,relatedDeviation:"yes",relatedCapa:"yes"},{q:obs.reference,year:["2096"]},{q:action1.description},{q:capa.businessCode!},{q:marker,nextReviewFrom:"2026-11-08",nextReviewTo:"2026-11-12"}]) assert((await getAuditList(filters)).rows.some(r=>r.id===audit.id));
  // A pending OBS review remains visible even when a later general followup has no date.
  assert((await getAuditList({q:marker,nextReviewTo:"2026-11-08"})).rows.some(r=>r.id===audit.id));
  assert((await getCapaList({q:marker,origin:["Auditoría"]})).rows.some(r=>r.qmsRecordId===capa.id));
  await retireAuditAttribution(audit.id,obs.id,attr1.id,{actor,reason:"Retirada de una atribución"}); assert((await prisma.qmsRelation.findUniqueOrThrow({where:{id:attr1.qmsRelationId}})).isActive);
  assert.equal((await getAuditOrigins(capa.id))[0].auditFindingRelations.length,1);
  await retireAuditAttribution(audit.id,rk.id,attr2.id,{actor,reason:"Retirada de segunda atribución"}); await unlinkAuditRecord(audit.id,capa.id,{actor,reason:"Solicitud global explícita"}); assert.equal((await getAuditOrigins(capa.id)).length,0);
  assert.deepEqual((await prisma.qmsRecordVersion.findUniqueOrThrow({where:{id:snapshot.id}})).snapshot,snapshot.snapshot);
  const restored=await linkAuditFinding(audit.id,obs.id,capa.id,actor); assert.equal(restored.id,attr1.id);
  await retireAuditElement(audit.id,obs.id,{actor,reason:"Retirada lógica ficticia"}); assert(!(await prisma.auditFinding.findUniqueOrThrow({where:{id:obs.id}})).isActive); assert.equal(await prisma.auditFindingAction.count({where:{findingId:obs.id}}),2);
  const after=await saveAuditFinding(audit.id,{actor,findingType:"FINDING",description:"No reutilizar OBS"}); assert.equal(after.reference,"OBS 04");
  assert.equal((await getAuditOrigins(capa.id))[0].auditFindingRelations[0].finding.reference,"OBS 01");
  await assert.rejects(retireAuditElement(audit.id,rk.id,{actor,reason:""}),/motivo/);
  await changeAdministrativeStatus(capa.id,"ANNUL","Smoke",actor); await assert.rejects(linkAuditFinding(audit.id,rk.id,capa.id,actor),/activa/); assert.equal((await getAuditWork(audit.id))!.findings.find(f=>f.id===obs.id)!.relations.find(r=>r.qmsRelation.targetRecordId===capa.id)!.qmsRelation.targetRecord.isActive,false);
  for(const type of ["COMPLAINT","RETURN","CHANGE_CONTROL","AUDIT"] as const) {
    const q=await prisma.qmsRecord.create({data:{recordType:type,businessCode:`${marker}-${type}`}}); records.push(q.id);
    await assert.rejects(prisma.$transaction(tx=>createQmsRelation(tx,{sourceRecordId:audit.qmsRecordId,targetRecordId:q.id})),/permitida/);
  }
  await assert.rejects(prisma.$transaction(tx=>createQmsRelation(tx,{sourceRecordId:deviation.id,targetRecordId:audit.qmsRecordId})),/permitida/);
  assert.equal(await prisma.qmsRecordVersion.count({where:{qmsRecordId:audit.qmsRecordId}}),0); assert.equal(await prisma.reviewThread.count({where:{qmsRecordId:audit.qmsRecordId}}),0);
  assert((await prisma.changeHistory.count({where:{qmsRecordId:audit.qmsRecordId}}))>12);
  const demo=await seedAuditDemo(prisma); await seedAuditDemo(prisma); assert.equal(await prisma.auditFinding.count({where:{auditId:demo.id}}),2);
  console.log("R3B PostgreSQL OK: UUID/OBS/Rk, concurrencia, acciones/cierre/evidencia, seguimientos, matriz, atribución compartida, navegación inversa, CAPA snapshots, historial, SQL filtros y seed.");
}
main().finally(async()=>{await cleanupAuditR3bFixtures(records);await prisma.$disconnect();}).catch(e=>{console.error(e);process.exitCode=1;});
