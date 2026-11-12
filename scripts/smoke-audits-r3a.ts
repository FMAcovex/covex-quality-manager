import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { saveAudit, auditDefaults } from "../src/modules/audits/service";
import { getAuditList } from "../src/modules/audits/queries";
import { changeAdministrativeStatus } from "../src/lib/qms/administrative-status";
import { suggestOperationalBusinessCode } from "../src/lib/qms/business-code";
import { qmsRecordHref } from "../src/lib/qms/record-links";
import { seedAuditDemo } from "../src/modules/audits/seed-demo";
import { addPlanEntry, createAnnualPlan } from "../src/modules/audits/plans";

if (process.env.APP_ENV !== "test") throw new Error("Ejecuta este smoke exclusivamente con APP_ENV=test en una BD aislada.");
const marker = `R3A-${randomUUID()}`, records: string[] = [];
async function create(raw: unknown) { const audit = await saveAudit(raw); records.push(audit.qmsRecordId); return audit; }
async function main() {
  const department = await prisma.department.findUniqueOrThrow({where:{code:"GC-00"}});
  const other = await prisma.department.findUniqueOrThrow({where:{code:"DT-00"}});
  let audit = await create({actor:"Smoke R3A"});
  assert.equal(audit.status,"DRAFT"); assert.equal(audit.qmsRecord.businessCode,null);
  audit = await saveAudit({...auditDefaults(audit), title:marker, auditType:"INTERNAL",scenario:"INTERNAL_COVEX",departmentIds:[department.id,other.id],codingDepartmentId:department.id,participants:[{displayName:"Auditor ficticio",role:"LEAD_AUDITOR",sortOrder:0},{displayName:"Segundo auditor ficticio",role:"AUDITOR",sortOrder:10},{displayName:"Interlocutor ficticio",role:"AUDITEE",sortOrder:20}]},audit.id);
  const participantIds = audit.participants.map(p => p.id), departmentIds = audit.departments.map(d => d.id), stale = auditDefaults(audit);
  await assert.rejects(saveAudit({...stale,status:"OPEN"},audit.id), /alcance|prevista/);
  audit = await saveAudit({...stale,status:"OPEN",scope:`Alcance ${marker}`,plannedDate:"2097-11-10"},audit.id);
  assert.match(audit.qmsRecord.businessCode!,/^AI\/GC-00\/\d{2}\/2097$/);
  assert.deepEqual(audit.participants.map(p=>p.id).sort(),participantIds.sort());
  assert.deepEqual(audit.departments.map(d=>d.id).sort(),departmentIds.sort());
  const originalCode = audit.qmsRecord.businessCode;
  audit = await saveAudit({...auditDefaults(audit),plannedDate:"2099-11-10",performedDate:"2098-01-10",participants:auditDefaults(audit).participants.reverse()},audit.id);
  assert.equal(audit.qmsRecord.businessCode,originalCode); assert.equal(audit.qmsRecord.year,2097);
  await assert.rejects(saveAudit(stale,audit.id), /cambió/);
  await assert.rejects(saveAudit({...auditDefaults(audit),status:"DRAFT"},audit.id), /Borrador/);
  await assert.rejects(saveAudit({...auditDefaults(audit),departmentIds:[other.id]},audit.id), /codificación/);
  await assert.rejects(saveAudit({...auditDefaults(audit),status:"CLOSED"},audit.id), /Informe y cierre/);
  await assert.rejects(saveAudit({...auditDefaults(audit),businessCode:"AI/GC-00/99/2097"},audit.id), /modificar/);
  for (const filters of [{q:marker},{q:"Auditor ficticio",year:["2097"],type:["INTERNAL"]},{q:marker,department:[other.id]},{q:marker,scenario:["INTERNAL_COVEX"],status:["OPEN"]},{q:marker,plannedFrom:"2099-01-01",performedTo:"2098-12-31"}]) assert((await getAuditList(filters)).rows.some(r=>r.id===audit.id));
  assert.equal((await getAuditList({q:marker,type:["EXTERNAL"]})).total,0);
  assert.equal(qmsRecordHref("AUDIT",audit.qmsRecordId),`/qms/${audit.qmsRecordId}`);
  assert(await prisma.changeHistory.count({where:{qmsRecordId:audit.qmsRecordId,fieldPath:"audit.participants"}}));
  await changeAdministrativeStatus(audit.qmsRecordId,"ANNUL","Anulación smoke","Smoke R3A");
  assert.equal((await getAuditList({q:marker})).total,0);
  assert.equal((await getAuditList({q:marker,administrative:"ANNULLED"})).total,1);
  const next = await suggestOperationalBusinessCode(prisma,{recordType:"AUDIT",auditType:"INTERNAL",auditScenario:"INTERNAL_COVEX",departmentCode:department.code,year:2097});
  // D-133: el código anulado queda libre; si era el último activo de la serie, se vuelve a sugerir.
  const sequence = (code: string | null) => Number(/^AI\/GC-00\/(\d{2})\/2097$/.exec(code ?? "")?.[1] ?? 0);
  const activeMax = Math.max(0, ...(await prisma.qmsRecord.findMany({where:{recordType:"AUDIT",businessCode:{startsWith:"AI/GC-00/"}},select:{businessCode:true}})).map(r=>sequence(r.businessCode)));
  assert.equal(sequence(next), activeMax + 1);
  if (sequence(originalCode) > activeMax) assert.equal(next, originalCode);
  await changeAdministrativeStatus(audit.qmsRecordId,"REACTIVATE","Reactivación smoke","Smoke R3A");
  const internal = {...auditDefaults(audit),expectedUpdatedAt:"",title:`Concurrencia ${marker}`,plannedDate:"2097-11-11",performedDate:"",businessCode:"",participants:[{displayName:"Auditor",role:"AUDITOR",sortOrder:0}]};
  const parallel = await Promise.all([create(internal),create(internal)]);
  assert.notEqual(parallel[0].qmsRecord.businessCode,parallel[1].qmsRecord.businessCode);
  const entityCode = `T${randomUUID().replaceAll("-","").slice(0,12).toUpperCase()}`;
  const supplier = {...internal,auditType:"EXTERNAL",scenario:"SUPPLIER",departmentIds:[],codingDepartmentId:"",entityCode,auditedEntityName:"Proveedor ficticio",title:`Proveedor ${marker}`};
  const external = await Promise.all([create(supplier),create(supplier)]);
  assert.deepEqual(external.map(a=>a.qmsRecord.businessCode).sort(),[`AE/${entityCode}/01/2097`,`AE/${entityCode}/02/2097`]);
  await assert.rejects(saveAudit({...auditDefaults(external[0]),participants:[{...auditDefaults(audit).participants[0]}]},external[0].id),/pertenece/);
  for (const scenario of ["CLIENT","AUTHORITY"]) {
    const received = await create({...supplier,scenario,entityCode:"",externalReference:`REF-${marker}`,businessCode:""});
    assert.equal(received.qmsRecord.businessCode,null);
    await changeAdministrativeStatus(received.qmsRecordId,"ANNUL","Anulación sin código","Smoke");
    await changeAdministrativeStatus(received.qmsRecordId,"REACTIVATE","Reactivar sin código","Smoke");
    // D-137 (R6): código libre, el del informe del cliente o el expediente de la agencia; editable y en el historial.
    const freeCode=`${scenario==="CLIENT"?"CLI":"AGENCIA"} ${marker}/2097`;
    const coded=await saveAudit({...auditDefaults(received),businessCode:`  ${freeCode}  `},received.id);
    assert.equal(coded.qmsRecord.businessCode,freeCode);
    // Revisión m3: corregir un código ya asignado exige motivo.
    await assert.rejects(saveAudit({...auditDefaults(coded),businessCode:`${freeCode}-B`},received.id),/motivo/);
    const recoded=await saveAudit({...auditDefaults(coded),businessCode:`${freeCode}-B`,changeReason:"Código corregido"},received.id);
    assert.equal(recoded.qmsRecord.businessCode,`${freeCode}-B`);
    assert(await prisma.changeHistory.count({where:{qmsRecordId:received.qmsRecordId,fieldPath:"businessCode"}})>=2);
    const twin=await create({...supplier,scenario,entityCode:"",externalReference:`REF2-${marker}`,businessCode:""});
    await assert.rejects(saveAudit({...auditDefaults(twin),businessCode:`${freeCode}-B`},twin.id),/ya lo usa otra auditoría/);
    await assert.rejects(saveAudit({...auditDefaults(twin),businessCode:"Código\u0007raro"},twin.id),/caracteres/);
    // Revisión m4: espacios internos unificados y sin caracteres de formato invisibles.
    assert.equal((await saveAudit({...auditDefaults(twin),businessCode:`ESP  ${marker}   ${scenario}`},twin.id)).qmsRecord.businessCode,`ESP ${marker} ${scenario}`);
    await assert.rejects(saveAudit({...auditDefaults(await prisma.audit.findUniqueOrThrow({where:{id:twin.id},include:{qmsRecord:true,departments:true,participants:true}})),businessCode:"INV\u200BISIBLE",changeReason:"Prueba"},twin.id),/caracteres/);
    // Revisión m7: un código libre que empieza por «DEMO-» no se pierde al editar el borrador.
    const demoDraft=await create({...supplier,scenario,status:"DRAFT",entityCode:"",externalReference:`DEMO-${marker}`,businessCode:`DEMO-${marker}-${scenario}`});
    assert.equal(auditDefaults(demoDraft).businessCode,`DEMO-${marker}-${scenario}`);
    // Revisión I-3: los formatos de las series de COVEX quedan reservados.
    await assert.rejects(saveAudit({...auditDefaults(recoded),businessCode:`AI/GC-00/99/2097`,changeReason:"Prueba"},received.id),/reservado/);
    // Revisión I-2: dos guardados a la vez con el mismo código: uno se guarda y el otro recibe el aviso en el campo.
    const [p1,p2]=await Promise.all([create({...supplier,scenario,entityCode:"",externalReference:`P1-${marker}`,businessCode:""}),create({...supplier,scenario,entityCode:"",externalReference:`P2-${marker}`,businessCode:""})]);
    const race=await Promise.allSettled([saveAudit({...auditDefaults(p1),businessCode:`RACE ${marker} ${scenario}`},p1.id),saveAudit({...auditDefaults(p2),businessCode:`RACE ${marker} ${scenario}`},p2.id)]);
    assert.equal(race.filter(r=>r.status==="fulfilled").length,1);
    const lost=race.find(r=>r.status==="rejected") as PromiseRejectedResult;
    assert.match(String(lost.reason?.message),/ya lo usa otra auditoría/);assert.equal((lost.reason as {fields?:Record<string,string>}).fields?.businessCode,"Ese código ya lo usa otra auditoría.");
    // GC-00/034/05 §3: las auditorías e inspecciones recibidas no forman parte del programa anual.
    await assert.rejects(saveAudit({...auditDefaults(await prisma.audit.findUniqueOrThrow({where:{id:twin.id},include:{qmsRecord:true,departments:true,participants:true}})),planningStatus:"PLANNED",planEntryId:randomUUID()},twin.id),/programa anual/);
  }
  // Revisión I-1: un borrador incluido en el plan como proveedor no conserva la entrada al pasar a cliente.
  {const occupied=await prisma.auditAnnualPlan.findMany({where:{auditType:"EXTERNAL"},select:{year:true}});
   const year=Array.from({length:101},(_,i)=>2100-i).find(y=>!occupied.some(p=>p.year===y))!;
   const plan=await createAnnualPlan({year,auditType:"EXTERNAL",title:`Plan ${marker}`,notes:"",actor:"Smoke"});
   const {entry}=await addPlanEntry(plan.id,{subject:"Entrada ficticia",targetName:"Entidad",departmentId:"",plannedDate:"",notes:"",actor:"Smoke",reason:""});
   const planned=await create({...supplier,status:"DRAFT",entityCode:"",title:`Plan ${marker}`,planningStatus:"PLANNED",planEntryId:entry.id});
   await assert.rejects(saveAudit({...auditDefaults(planned),scenario:"CLIENT",changeReason:"Era de cliente"},planned.id),/programa anual/);
   // Una recibida abierta que ya estaba en el plan (antes de D-137) se conserva al editarla.
   const legacy=await create({...supplier,scenario:"CLIENT",entityCode:"",externalReference:`LEG-${marker}`,businessCode:""});
   const {entry:legacyEntry}=await addPlanEntry(plan.id,{subject:"Entrada histórica",targetName:"Cliente",departmentId:"",plannedDate:"",notes:"",actor:"Smoke",reason:""});
   await prisma.audit.update({where:{id:legacy.id},data:{planningStatus:"PLANNED",planEntryId:legacyEntry.id}});
   const kept=await saveAudit({...auditDefaults(await prisma.audit.findUniqueOrThrow({where:{id:legacy.id},include:{qmsRecord:true,departments:true,participants:true}})),title:"Edición conservando el plan"},legacy.id);
   assert.equal(kept.planEntryId,legacyEntry.id);}
  const draft = await create({actor:"Smoke",title:`Identidad ${marker}`,departmentIds:[department.id],participants:[{displayName:"Persistente",role:"AUDITOR",sortOrder:0}]});
  const removed = await saveAudit({...auditDefaults(draft),departmentIds:[],participants:[]},draft.id);
  const restored = await saveAudit({...auditDefaults(removed),departmentIds:[department.id],participants:auditDefaults(draft).participants},draft.id);
  assert.equal(restored.departments[0].id,draft.departments[0].id); assert.equal(restored.participants[0].id,draft.participants[0].id);
  await changeAdministrativeStatus(draft.qmsRecordId,"ANNUL","Borrador incompleto","Smoke");
  await changeAdministrativeStatus(draft.qmsRecordId,"REACTIVATE","Reactivar borrador","Smoke");
  await assert.rejects(prisma.audit.update({where:{id:audit.id},data:{auditType:"EXTERNAL"}}));
  for (let i=0;i<27;i++) await create({actor:"Smoke",title:`Paginación ${marker}`});
  const page1 = await getAuditList({q:`Paginación ${marker}`}), page2 = await getAuditList({q:`Paginación ${marker}`,page:"2"});
  assert.equal(page1.total,27); assert.equal(page1.rows.length,25); assert.equal(page2.rows.length,2);
  assert(!page1.rows.some(r=>page2.rows.some(s=>s.id===r.id)));
  assert.equal(await prisma.qmsRecordVersion.count({where:{qmsRecordId:{in:records}}}),0);
  assert.equal(await prisma.qmsRelation.count({where:{sourceRecordId:{in:records}}}),0);
  assert.equal(await prisma.reviewThread.count({where:{qmsRecordId:{in:records}}}),0);
  const demoBefore = await prisma.qmsRecord.findFirst({where:{recordType:"AUDIT",businessCode:"DEMO-AUD-001-2026"}});
  const demo1 = await seedAuditDemo(prisma), demo2 = await seedAuditDemo(prisma);
  if (!demoBefore) records.push(demo1.qmsRecordId);
  assert.equal(demo1.id,demo2.id); assert.equal(await prisma.auditParticipant.count({where:{auditId:demo1.id}}),3);
  console.log("R3A PostgreSQL: borrador, apertura, UUID, multiárea, concurrencia AI/AE, filtros/búsqueda/paginación, historial, administración y seed idempotente OK.");
}
main().finally(async()=>{
  const audits = await prisma.audit.findMany({where:{qmsRecordId:{in:records}},select:{id:true}}), ids=audits.map(a=>a.id);
  await prisma.auditFollowup.deleteMany({where:{auditId:{in:ids}}}); await prisma.auditFindingAction.deleteMany({where:{finding:{auditId:{in:ids}}}}); await prisma.auditFindingRelation.deleteMany({where:{finding:{auditId:{in:ids}}}}); await prisma.auditFinding.deleteMany({where:{auditId:{in:ids}}});
  await prisma.auditParticipant.deleteMany({where:{auditId:{in:ids}}}); await prisma.auditDepartment.deleteMany({where:{auditId:{in:ids}}});
  await prisma.changeHistory.deleteMany({where:{qmsRecordId:{in:records}}}); await prisma.audit.deleteMany({where:{id:{in:ids}}}); await prisma.qmsRecord.deleteMany({where:{id:{in:records}}});
  // El plan de la prueba del programa anual (revisión I-1) no deja el año ocupado para otras pruebas.
  const plans=(await prisma.auditAnnualPlan.findMany({where:{title:{startsWith:"Plan R3A-"}},select:{id:true}})).map(p=>p.id);
  await prisma.auditPlanChange.deleteMany({where:{planId:{in:plans}}}); await prisma.auditPlanEntry.deleteMany({where:{planId:{in:plans}}}); await prisma.auditAnnualPlan.deleteMany({where:{id:{in:plans}}}); await prisma.$disconnect();
}).catch(error=>{console.error(error);process.exitCode=1;});
