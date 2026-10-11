import "server-only";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { getDashboardData } from "../src/modules/dashboard/queries";
import type { DashboardFilters } from "../src/modules/dashboard/domain";

const marker = "D1B-SMOKE-" + randomUUID();
const ids: string[] = [];
let documentId = "";
let deviationId = "";
let auditId = "";
let returnId = "";
const filters: DashboardFilters = { module: "DEVIATION", year: 2026, taskView: "all", page: 1 };
const date = (days: number) => { const d = new Date(); d.setUTCHours(0,0,0,0); d.setUTCDate(d.getUTCDate() + days); return d; };
const count = (data: Awaited<ReturnType<typeof getDashboardData>>, module: string) => data.cards.find(c => c.module === module)!.total;

async function main() {
  if (process.env.APP_ENV !== "test") throw new Error("Usar solo con APP_ENV=test y base de datos aislada.");
  const departments = await prisma.department.findMany({ where: { code: { in: ["GC-00","LG-20"] } }, select: { id: true, code: true, name: true } });
  const gc = departments.find(d => d.code === "GC-00");
  const lg = departments.find(d => d.code === "LG-20");
  assert(gc && lg, "Faltan departamentos de fixtures");
  const baseline = await getDashboardData(filters);
  try {
    const createRecord = async (recordType: "DEVIATION"|"CAPA"|"RETURN"|"AUDIT", active = true) => {
      const r = await prisma.qmsRecord.create({ data: {
        recordType, year: 2026, businessCode: marker + "-" + recordType + "-" + ids.length, isActive: active,
      } });
      ids.push(r.id);
      return r;
    };
    const dev = await createRecord("DEVIATION");
    const deviation = await prisma.deviation.create({ data: { qmsRecordId: dev.id, status: "OPEN", departmentId: gc.id, issueDate: date(-9), whatHappened: marker } });
    deviationId = deviation.id;
    await prisma.deviationFollowup.create({ data: { deviationId, followupDate: date(-5), nextFollowupDate: date(-1), completedByText: marker, comment: marker } });
    const annulled = await createRecord("DEVIATION", false);
    await prisma.deviation.create({ data: { qmsRecordId: annulled.id, status: "OPEN", departmentId: gc.id } });
    const draftRecord = await createRecord("DEVIATION");
    await prisma.deviation.create({ data: { qmsRecordId: draftRecord.id, status: "DRAFT", departmentId: gc.id } });

    const capaRec = await createRecord("CAPA");
    await prisma.capa.create({ data: { qmsRecordId: capaRec.id, status: "OPEN", actionType: "CORRECTIVE", departmentId: gc.id } });
    const ret = await createRecord("RETURN");
    const returnRecord = await prisma.returnRecord.create({ data: { qmsRecordId: ret.id, status: "OPEN", returnType: "COMMERCIAL", departmentId: lg.id } });
    returnId = returnRecord.id;
    await prisma.returnProduct.createMany({ data: [
      { returnRecordId: returnId, productType: "API", productNameCode: marker + "A" },
      { returnRecordId: returnId, productType: "MEDICINE", productNameCode: marker + "B" },
    ] });
    const auditRec = await createRecord("AUDIT");
    const audit = await prisma.audit.create({ data: { qmsRecordId: auditRec.id, status: "OPEN", auditType: "INTERNAL", scenario: "INTERNAL_COVEX", title: marker } });
    auditId = audit.id;
    await prisma.auditDepartment.createMany({ data: [
      { auditId, departmentId: gc.id, departmentCodeSnapshot: gc.code, departmentNameSnapshot: gc.name },
      { auditId, departmentId: lg.id, departmentCodeSnapshot: lg.code, departmentNameSnapshot: lg.name },
    ] });
    await prisma.auditFollowup.create({ data: { auditId, followupDate: date(-6), nextReviewDate: date(-1), completedByText: marker, createdByText: marker, description: marker } });
    const code = "GC-00/" + String(900 + (Number.parseInt(marker.slice(-4), 16) % 100));
    const document = await prisma.controlledDocument.create({ data: { baseCode: code, title: marker, documentType: "PNT", administrativeStatus: "ACTIVE", departmentId: gc.id, createdByText: marker } });
    documentId = document.id;
    await prisma.controlledDocumentRevision.create({ data: { documentId, revisionCode: "00", status: "IN_FORCE", registeredByText: marker, effectiveFrom: date(-80), reviewDueAt: date(-1) } });
    await prisma.controlledDocumentRevision.create({ data: { documentId, revisionCode: "01", status: "DRAFT", registeredByText: marker } });

    const after = await getDashboardData(filters);
    assert.equal(count(after,"DEVIATION")-count(baseline,"DEVIATION"),2,"Solo registro activo operativo y borrador; no el anulado");
    assert.equal(after.cards.find(c=>c.module==="DEVIATION")!.open-baseline.cards.find(c=>c.module==="DEVIATION")!.open,1);
    assert.equal(after.cards.find(c=>c.module==="DEVIATION")!.draft-baseline.cards.find(c=>c.module==="DEVIATION")!.draft,1);
    assert.equal(count(after,"CAPA")-count(baseline,"CAPA"),1);
    assert.equal(count(after,"RETURN")-count(baseline,"RETURN"),1,"Dos productos no generan dos devoluciones");
    assert.equal(count(after,"AUDIT")-count(baseline,"AUDIT"),1,"Dos departamentos no generan dos auditorías");
    assert.equal(count(after,"PNT")-count(baseline,"PNT"),1,"Dos revisiones no generan dos maestros");
    assert.equal(after.pntRevisionsInForce-baseline.pntRevisionsInForce,1);

    assert(after.totals.overdue - baseline.totals.overdue >= 3,"Faltan fechas vencidas de Desviación, Auditoría o PNT");
    assert.equal(after.tasks.total - baseline.tasks.total,3,"Las tres tareas propias deben contarse una vez");
    assert(!after.tasks.items.some(t => t.businessCode === annulled.businessCode),"No mostrar expediente anulado");
    const gcView = await getDashboardData({ ...filters, departmentId: gc.id });
    assert(gcView.cards.find(c=>c.module==="AUDIT")!.total>=1,"Auditoría multiárea visible en GC");
    const lgView = await getDashboardData({ ...filters, departmentId: lg.id });
    assert(lgView.cards.find(c=>c.module==="AUDIT")!.total>=1,"Auditoría multiárea visible en LG");
    assert(!lgView.tasks.items.some(t=>t.key==="DEV-F-"+deviationId),"Filtro departamento oculta desviación GC");
    const overdue = await getDashboardData({...filters,taskView:"overdue"});
    assert(overdue.tasks.items.every(t=>t.state==="OVERDUE"));
    console.log("D1B PostgreSQL OK: activo/anulado/borrador, multiárea, productos/revisiones, seguimiento, filtros y fechas");
  } finally {
    if (documentId) {
      await prisma.controlledDocumentRevision.deleteMany({where:{documentId}});
      await prisma.controlledDocument.delete({where:{id:documentId}});
    }
    if (auditId) { await prisma.auditFollowup.deleteMany({where:{auditId}}); await prisma.auditDepartment.deleteMany({where:{auditId}}); }
    if (deviationId) await prisma.deviationFollowup.deleteMany({where:{deviationId}});
    await prisma.audit.deleteMany({ where: { qmsRecordId: { in: ids } } });
    await prisma.deviation.deleteMany({ where: { qmsRecordId: { in: ids } } });
    await prisma.capa.deleteMany({ where: { qmsRecordId: { in: ids } } });
    await prisma.returnRecord.deleteMany({ where: { qmsRecordId: { in: ids } } });
    await prisma.qmsRecord.deleteMany({ where: { id: { in: ids } } });
  }
}
main().catch(e=>{ console.error(e); process.exitCode=1; }).finally(()=>prisma.$disconnect());
