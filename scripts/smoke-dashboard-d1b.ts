import "server-only";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { getDashboardData } from "../src/modules/dashboard/queries";
import type { DashboardFilters } from "../src/modules/dashboard/domain";

const prefix = "D1B-" + randomUUID();
const ids: string[] = [];
const today = new Date("2026-10-11T12:00:00.000Z");
const flags: DashboardFilters = {
  year: 2098, department: "", module: "ALL", state: "ALL", taskView: "all", page: 1, asOf: today,
};
type RecordType = "DEVIATION" | "CAPA" | "RETURN" | "AUDIT";

async function addRecord(recordType: RecordType, create: (qmsId: string) => Promise<{ id: string }>, active = true) {
  const qms = await prisma.qmsRecord.create({
    data: { recordType, year: 2098, isActive: active, businessCode: prefix + "-" + recordType + "-" + ids.length },
  });
  ids.push(qms.id);
  return create(qms.id);
}
function activeCount(result: Awaited<ReturnType<typeof getDashboardData>>, module: RecordType) {
  return result.metrics.find(x => x.module === module)?.open ?? 0;
}

async function main() {
  if (process.env.APP_ENV !== "test") throw new Error("D1B smoke requiere APP_ENV=test y PostgreSQL de pruebas.");
  const departments = await prisma.department.findMany({ where: { isActive: true }, take: 2, orderBy: { code: "asc" } });
  if (departments.length < 2) throw new Error("D1B requiere dos departamentos del seed de pruebas.");
  const dep = departments[0].id;
  const dep2 = departments[1].id;
  const scoped = { ...flags, department: dep };
  let auditId: string | null = null;
  let documentId: string | null = null;
  try {
    const before = await getDashboardData(scoped);
    const beforeDep2 = await getDashboardData({ ...scoped, department: dep2, module: "AUDIT" });
    const first = await addRecord("DEVIATION", id => prisma.deviation.create({
      data: { qmsRecordId: id, departmentId: dep, status: "OPEN", whatHappened: prefix },
    }));
    const second = await addRecord("DEVIATION", id => prisma.deviation.create({
      data: { qmsRecordId: id, departmentId: dep, status: "OPEN", whatHappened: prefix },
    }));
    await addRecord("DEVIATION", id => prisma.deviation.create({
      data: { qmsRecordId: id, departmentId: dep, status: "OPEN", whatHappened: prefix },
    }), false);
    const capa = await addRecord("CAPA", id => prisma.capa.create({
      data: { qmsRecordId: id, departmentId: dep, actionType: "CORRECTIVE", status: "OPEN" },
    }));
    const deviations = await prisma.deviation.findMany({
      where: { id: { in: [first.id, second.id] } }, select: { qmsRecordId: true },
    });
    const capaRow = await prisma.capa.findUniqueOrThrow({ where: { id: capa.id }, select: { qmsRecordId: true } });
    await prisma.qmsRelation.createMany({ data: deviations.map(d => ({
      sourceRecordId: d.qmsRecordId, targetRecordId: capaRow.qmsRecordId,
      relationType: "GENERATES" as const, isActive: true, createdByText: "Prueba D1B",
    })) });
    const returned = await addRecord("RETURN", id => prisma.returnRecord.create({
      data: { qmsRecordId: id, departmentId: dep, returnType: "COMMERCIAL", status: "OPEN", customerEntity: prefix },
    }));
    await prisma.returnProduct.createMany({ data: [
      { returnRecordId: returned.id, productType: "API", productNameCode: prefix + "-1" },
      { returnRecordId: returned.id, productType: "API", productNameCode: prefix + "-2" },
    ] });
    const audit = await addRecord("AUDIT", id => prisma.audit.create({
      data: { qmsRecordId: id, status: "OPEN", title: prefix, auditType: "INTERNAL", scenario: "INTERNAL_COVEX" },
    }));
    auditId = audit.id;
    await prisma.auditDepartment.createMany({ data: [
      { auditId: audit.id, departmentId: dep, departmentCodeSnapshot: departments[0].code, departmentNameSnapshot: departments[0].name },
      { auditId: audit.id, departmentId: dep2, departmentCodeSnapshot: departments[1].code, departmentNameSnapshot: departments[1].name },
    ] });
    await prisma.auditFollowup.create({
      data: { auditId: audit.id, followupDate: new Date("2026-10-01T00:00:00Z"),
        nextReviewDate: new Date("2026-10-10T00:00:00Z"),
        description: "Revisión pendiente", completedByText: "Prueba D1B", createdByText: "Prueba D1B" },
    });

    // A later draft must not hide the revision still in force.
    // Respect the PNT base-code format and use a free synthetic code for this department.
    const codePrefix = departments[0].code + "/";
    assert.match(codePrefix, /^[A-Z]{2}-[0-9]{2}\/$/, "Se requiere departamento PNT válido");
    const occupied = new Set((await prisma.controlledDocument.findMany({
      where: { baseCode: { startsWith: codePrefix } }, select: { baseCode: true },
    })).map(r => r.baseCode));
    const code = Array.from({ length: 1000 }, (_, i) => codePrefix + String(999 - i).padStart(3, "0"))
      .find(candidate => !occupied.has(candidate));
    assert(code, "Sin códigos PNT libres para la prueba D1B");
    const document = await prisma.controlledDocument.create({ data: {
      baseCode: code, title: prefix,
      documentType: "PNT", administrativeStatus: "ACTIVE", departmentId: dep, createdByText: "Prueba D1B",
    } });
    documentId = document.id;
    await prisma.controlledDocumentRevision.createMany({ data: [
      { documentId, revisionCode: "00", status: "IN_FORCE", registeredByText: "Prueba D1B",
        effectiveFrom: new Date("2025-01-01T00:00:00Z"), reviewDueAt: new Date("2026-10-10T00:00:00Z") },
      { documentId, revisionCode: "01", status: "DRAFT", registeredByText: "Prueba D1B" },
    ] });
    const after = await getDashboardData(scoped);
    assert.equal(activeCount(after, "DEVIATION") - activeCount(before, "DEVIATION"), 2, "Inactiva excluida");
    assert.equal(activeCount(after, "CAPA") - activeCount(before, "CAPA"), 1, "Dos relaciones no duplican CAPA");
    assert.equal(activeCount(after, "RETURN") - activeCount(before, "RETURN"), 1, "Dos productos no duplican devolución");
    assert.equal(activeCount(after, "AUDIT") - activeCount(before, "AUDIT"), 1, "Dos áreas no duplican auditoría");
    const dept2Result = await getDashboardData({ ...scoped, department: dep2, module: "AUDIT" });
    assert.equal(activeCount(dept2Result, "AUDIT") - activeCount(beforeDep2, "AUDIT"), 1, "Multiárea permite filtrar por ambos departamentos sin duplicar la auditoría");
    const auditTask = after.tasks.find(t => t.code.startsWith(prefix) && t.module === "AUDIT");
    assert(auditTask && auditTask.state === "OVERDUE", "La revisión de auditoría de ayer debe vencer");
    assert(after.taskCounts.overdue >= before.taskCounts.overdue + 2, "Auditoría y PNT vencidos");
    assert.equal(after.pnt.masters - before.pnt.masters, 1, "Dos revisiones no duplican maestro PNT");
    assert.equal(after.pnt.revisions - before.pnt.revisions, 2, "Las revisiones constan por separado");
    assert.equal(after.pnt.overdue - before.pnt.overdue, 1, "Borrador nuevo no oculta vencimiento en vigor");
    assert(after.tasks.some(t => t.module === "PNT" && t.code === document.baseCode && t.state === "OVERDUE"),
      "La bandeja debe mostrar la revisión en vigor vencida");

    const draft = await addRecord("CAPA", id => prisma.capa.create({
      data: { qmsRecordId: id, departmentId: dep, actionType: "PREVENTIVE", status: "DRAFT" },
    }));
    const withDraft = await getDashboardData({ ...scoped, state: "DRAFT", module: "CAPA" });
    assert(withDraft.metrics[0].draft >= 1);
    assert(withDraft.metrics[0].open === activeCount(after, "CAPA"));
    console.log("D1B PostgreSQL OK: anulados, borradores, CAPA de dos orígenes, devolución multiproducto, auditoría multidpto y revisión vencida.");
    void draft;
  } finally {
    if (documentId) {
      await prisma.controlledDocumentRevision.deleteMany({ where: { documentId } });
      await prisma.controlledDocument.delete({ where: { id: documentId } });
    }
    await prisma.qmsRelation.deleteMany({ where: { OR: [
      { sourceRecordId: { in: ids } }, { targetRecordId: { in: ids } },
    ] } });
    if (auditId) {
      await prisma.auditFollowup.deleteMany({ where: { auditId } });
      await prisma.auditDepartment.deleteMany({ where: { auditId } });
    }
    await prisma.audit.deleteMany({ where: { qmsRecordId: { in: ids } } });
    await prisma.returnProduct.deleteMany({ where: { returnRecord: { qmsRecordId: { in: ids } } } });
    await prisma.returnRecord.deleteMany({ where: { qmsRecordId: { in: ids } } });
    await prisma.capa.deleteMany({ where: { qmsRecordId: { in: ids } } });
    await prisma.deviation.deleteMany({ where: { qmsRecordId: { in: ids } } });
    await prisma.qmsRecord.deleteMany({ where: { id: { in: ids } } });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
