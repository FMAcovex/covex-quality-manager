import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { dashboardStatus, dashboardTasks } from "@/modules/dashboard/queries";
import { taskPage } from "@/modules/dashboard/domain";

const tag = "D1B-" + randomUUID();
const asOf = new Date("2097-01-10T12:00:00Z");
const due = new Date("2097-01-09T00:00:00Z");
const recordIds: string[] = [];
const auditIds: string[] = [];
const deviationIds: string[] = [];
const masterIds: string[] = [];

async function main() {
  if (process.env.APP_ENV !== "test") throw new Error("Only APP_ENV=test with an isolated PostgreSQL database.");
  const dept = await prisma.department.findUniqueOrThrow({ where: { code: "GC-00" } });
  const secondDept = await prisma.department.findUniqueOrThrow({ where: { code: "PA-20" } });
  const before = await dashboardStatus("");
  const beforeGc = await dashboardStatus(dept.id);
  const baseline = new Map(before.grouped.map(x => [x.module, x]));
  const createRecord = async (type: "DEVIATION" | "CAPA" | "CHANGE_CONTROL" | "COMPLAINT" | "RETURN" | "AUDIT", active = true) => {
    const q = await prisma.qmsRecord.create({ data: {
      recordType: type, businessCode: tag + "-" + type + "-" + recordIds.length, year: 2097, isActive: active,
    } });
    recordIds.push(q.id);
    return q;
  };

  try {
    const devQ = await createRecord("DEVIATION");
    const dev = await prisma.deviation.create({ data: {
      qmsRecordId: devQ.id, status: "OPEN", departmentId: dept.id,
    } }); deviationIds.push(dev.id);
    await prisma.deviationFollowup.create({ data: {
      deviationId: dev.id, followupDate: due, nextFollowupDate: due,
      completedByText: "CI", comment: "Vencimiento de prueba",
    } });

    const capaQ = await createRecord("CAPA");
    await prisma.capa.create({ data: {
      qmsRecordId: capaQ.id, status: "CLOSED", actionType: "CORRECTIVE",
      departmentId: dept.id, effectivenessStatus: "PENDING",
      operationalClosedAt: new Date("2097-01-05T00:00:00Z"),
    } });
    const ccQ = await createRecord("CHANGE_CONTROL");
    await prisma.changeControl.create({ data: {
      qmsRecordId: ccQ.id, departmentId: dept.id, finalStatus: "OPEN",
      executionStatus: "EXECUTED", effectivenessStatus: "PENDING",
    } });
    const recQ = await createRecord("COMPLAINT");
    await prisma.complaint.create({ data: {
      qmsRecordId: recQ.id, status: "OPEN", complaintType: "CUSTOMER", departmentId: dept.id,
    } });
    const retQ = await createRecord("RETURN");
    await prisma.returnRecord.create({ data: {
      qmsRecordId: retQ.id, status: "OPEN", returnType: "COMMERCIAL", departmentId: dept.id,
    } });
    const auditQ = await createRecord("AUDIT");
    const audit = await prisma.audit.create({ data: {
      qmsRecordId: auditQ.id, status: "OPEN", auditType: "INTERNAL", scenario: "INTERNAL_COVEX",
    } }); auditIds.push(audit.id);
    for (const d of [dept, secondDept]) {
      await prisma.auditDepartment.create({ data: {
        auditId: audit.id, departmentId: d.id, departmentCodeSnapshot: d.code, departmentNameSnapshot: d.name,
      } });
    }
    await prisma.auditFollowup.create({ data: {
      auditId: audit.id, followupDate: due, nextReviewDate: due,
      completedByText: "CI", createdByText: "CI", description: "Revisión vencida",
    } });

    const inactiveQ = await createRecord("DEVIATION", false);
    await prisma.deviation.create({ data: { qmsRecordId: inactiveQ.id, status: "OPEN", departmentId: dept.id } });

    const master = await prisma.controlledDocument.create({ data: {
      baseCode: null, title: tag, departmentId: dept.id, administrativeStatus: "ACTIVE", createdByText: "CI",
    } }); masterIds.push(master.id);
    await prisma.controlledDocumentRevision.create({ data: {
      documentId: master.id, revisionCode: "00", status: "IN_FORCE",
      reviewDueAt: due, registeredByText: "CI",
    } });
    await prisma.controlledDocumentRevision.create({ data: {
      documentId: master.id, revisionCode: "01", status: "DRAFT", registeredByText: "CI",
    } });

    const after = await dashboardStatus("");
    const gc = await dashboardStatus(dept.id);
    for (const type of ["DEVIATION", "CAPA", "CHANGE_CONTROL", "COMPLAINT", "RETURN", "AUDIT"] as const) {
      assert.equal(after.grouped.find(x => x.module === type)!.total - baseline.get(type)!.total, 1,
        type + " counted by unique record and excludes administratively inactive records");
    }
    assert.equal(after.grouped.find(x => x.module === "PNT")!.total - baseline.get("PNT")!.total, 1,
      "A PNT with two revisions must count as one master");
    assert.equal(after.pnt.revisions - before.pnt.revisions, 2);
    assert.equal(after.pnt.inForce - before.pnt.inForce, 1);
    assert.equal(after.capaEfficacy - before.capaEfficacy, 1);
    assert.equal(after.changeEfficacy - before.changeEfficacy, 1);
    assert.equal(gc.grouped.find(x => x.module === "AUDIT")!.total -
      beforeGc.grouped.find(x => x.module === "AUDIT")!.total, 1, "Multi-area audit counted once");

    const tasks = await dashboardTasks(dept.id, asOf);
    const markerTasks = tasks.filter(t => t.code.includes(tag) || t.href === "/controlled-documents/" + master.id);
    const expected = new Set(["DEVIATION", "AUDIT", "PNT"]);
    for (const t of markerTasks) {
      // CAPA efficacy can have a configured future due date; only these
      // three explicit dated fixtures are expected to be overdue.
      if (expected.has(t.module)) {
        assert.equal(t.state, "OVERDUE");
        expected.delete(t.module);
      }
      assert(t.href.startsWith("/"), "only internal links");
    }
    assert.equal(expected.size, 0, "all three new followup sources must appear");
    const page = taskPage(tasks, { module: "AUDIT", taskView: "overdue", page: 1 });
    assert(page.total >= 1);
    assert(tasks.some(t => t.code === auditQ.businessCode));
    assert.equal(tasks.filter(t => t.code === auditQ.businessCode).length, 1);
    console.log("D1B PG OK: seven modules, active/inactive, efficacy, two revisions/one master, audit multi-department, dated tasks and links.");
  } finally {
    // Only fixtures created above; no seeds, imports or user/demo records removed.
    await prisma.auditFollowup.deleteMany({ where: { auditId: { in: auditIds } } });
    await prisma.auditDepartment.deleteMany({ where: { auditId: { in: auditIds } } });
    await prisma.controlledDocumentRevision.deleteMany({ where: { documentId: { in: masterIds } } });
    await prisma.controlledDocument.deleteMany({ where: { id: { in: masterIds } } });
    await prisma.deviationFollowup.deleteMany({ where: { deviationId: { in: deviationIds } } });
    await prisma.deviation.deleteMany({ where: { qmsRecordId: { in: recordIds } } });
    await prisma.capa.deleteMany({ where: { qmsRecordId: { in: recordIds } } });
    await prisma.changeControl.deleteMany({ where: { qmsRecordId: { in: recordIds } } });
    await prisma.complaint.deleteMany({ where: { qmsRecordId: { in: recordIds } } });
    await prisma.returnRecord.deleteMany({ where: { qmsRecordId: { in: recordIds } } });
    await prisma.audit.deleteMany({ where: { qmsRecordId: { in: recordIds } } });
    await prisma.qmsRecord.deleteMany({ where: { id: { in: recordIds } } });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
