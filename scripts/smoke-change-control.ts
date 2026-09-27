import assert from "node:assert/strict";
import { PrismaClient, QmsRecordType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const department = await prisma.department.findUniqueOrThrow({ where: { code: "GC-00" } });
  const qmsRecord = await prisma.qmsRecord.create({
    data: {
      recordType: QmsRecordType.CHANGE_CONTROL,
      businessCode: "C/GC-00/SMOKE/2099",
      year: 2099,
    },
  });

  try {
    const change = await prisma.changeControl.create({
      data: {
        qmsRecordId: qmsRecord.id,
        departmentId: department.id,
        departmentCodeSnapshot: department.code,
        departmentNameSnapshot: department.name,
        requestDate: new Date("2099-01-02"),
        requesterName: "CI",
        requesterPosition: "QA",
        scope: ["DOCUMENTATION"],
        description: "Cambio ficticio de documentación",
        justification: "Smoke test",
        requestDecision: "ACCEPTED",
        requestDecisionResponsible: "QA",
        requestDecisionDate: new Date("2099-01-03"),
        evaluation: "Impacto documental controlado",
        classification: "MINOR",
        plannedImplementationDate: new Date("2099-01-20"),
        dictamenResult: "APPROVED",
        dictamenDate: new Date("2099-01-04"),
        followupResponsible: "CI",
        tasks: {
          create: [
            {
              departmentId: department.id,
              departmentCodeSnapshot: department.code,
              departmentNameSnapshot: department.name,
              description: "Actualizar procedimiento",
              responsible: "CI",
              plannedDate: new Date("2099-01-15"),
              origin: "DICTAMEN",
              sortOrder: 0,
            },
          ],
        },
      },
      include: { tasks: true },
    });

    const followup00 = await prisma.changeControlFollowup.create({
      data: {
        changeControlId: change.id,
        sequenceNumber: 0,
        followupDate: new Date("2099-01-15"),
        responsible: "CI",
        executionStatus: "NOT_EXECUTED",
        effectivenessStatus: "PENDING",
        nextFollowupDate: new Date("2099-01-30"),
        remainOpenReason: "Pendiente acción adicional",
      },
    });

    const newTask = await prisma.changeControlTask.create({
      data: {
        changeControlId: change.id,
        departmentId: department.id,
        departmentCodeSnapshot: department.code,
        departmentNameSnapshot: department.name,
        description: "Formar al personal afectado",
        responsible: "CI",
        plannedDate: new Date("2099-01-25"),
        origin: "FOLLOWUP",
        introducedInFollowup: 0,
        sortOrder: 1,
      },
    });

    await prisma.changeControlTaskState.createMany({
      data: [
        {
          followupId: followup00.id,
          taskId: change.tasks[0].id,
          status: "COMPLETED",
          actualDate: new Date("2099-01-15"),
          evidenceComment: "PNT actualizado",
        },
        {
          followupId: followup00.id,
          taskId: newTask.id,
          status: "PENDING",
          evidenceComment: "Formación programada",
        },
      ],
    });

    const followup01 = await prisma.changeControlFollowup.create({
      data: {
        changeControlId: change.id,
        sequenceNumber: 1,
        followupDate: new Date("2099-01-30"),
        responsible: "CI",
        executionStatus: "EXECUTED",
        executionDate: new Date("2099-01-25"),
        effectivenessStatus: "PENDING",
        nextFollowupDate: new Date("2099-02-28"),
        remainOpenReason: "Pendiente eficacia",
      },
    });

    await prisma.changeControlTaskState.createMany({
      data: [
        {
          followupId: followup01.id,
          taskId: change.tasks[0].id,
          status: "COMPLETED",
          actualDate: new Date("2099-01-15"),
          evidenceComment: "PNT actualizado",
        },
        {
          followupId: followup01.id,
          taskId: newTask.id,
          status: "COMPLETED",
          actualDate: new Date("2099-01-25"),
          evidenceComment: "Registro de formación",
        },
      ],
    });

    await prisma.changeControl.update({
      where: { id: change.id },
      data: {
        executionStatus: "EXECUTED",
        executionDate: new Date("2099-01-25"),
        operationalClosedAt: new Date("2099-01-30"),
        effectivenessStatus: "PENDING",
      },
    });

    const followup02 = await prisma.changeControlFollowup.create({
      data: {
        changeControlId: change.id,
        sequenceNumber: 2,
        followupDate: new Date("2099-02-28"),
        responsible: "CI",
        executionStatus: "EXECUTED",
        executionDate: new Date("2099-01-25"),
        effectivenessStatus: "ACCEPTABLE",
        effectivenessObservations: "Sin incidencias tras implantación",
        closeChange: true,
        conclusion: "Cambio eficaz",
        approvalByText: "QA",
      },
    });

    await prisma.changeControlTaskState.createMany({
      data: [
        {
          followupId: followup02.id,
          taskId: change.tasks[0].id,
          status: "COMPLETED",
          actualDate: new Date("2099-01-15"),
          evidenceComment: "PNT actualizado",
        },
        {
          followupId: followup02.id,
          taskId: newTask.id,
          status: "COMPLETED",
          actualDate: new Date("2099-01-25"),
          evidenceComment: "Registro de formación",
        },
      ],
    });

    await prisma.changeControl.update({
      where: { id: change.id },
      data: {
        effectivenessStatus: "ACCEPTABLE",
        finalStatus: "CLOSED",
        effectiveClosedAt: new Date("2099-02-28"),
        closureConclusion: "Cambio eficaz",
      },
    });

    await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: qmsRecord.id,
        sequenceNumber: 0,
        kind: "FOLLOWUP",
        snapshot: { recordType: "CHANGE_CONTROL", followup: 0 },
        frozenAt: new Date(),
      },
    });
    await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: qmsRecord.id,
        sequenceNumber: 1,
        kind: "FOLLOWUP",
        snapshot: { recordType: "CHANGE_CONTROL", followup: 1 },
        frozenAt: new Date(),
      },
    });
    await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: qmsRecord.id,
        sequenceNumber: 2,
        kind: "FOLLOWUP",
        snapshot: { recordType: "CHANGE_CONTROL", followup: 2 },
      },
    });

    const stored = await prisma.changeControl.findUniqueOrThrow({
      where: { id: change.id },
      include: {
        tasks: { include: { states: true } },
        followups: { orderBy: { sequenceNumber: "asc" }, include: { taskStates: true } },
        qmsRecord: { include: { versions: { orderBy: { sequenceNumber: "asc" } } } },
      },
    });

    assert.equal(stored.tasks.length, 2);
    assert.equal(stored.tasks[1].origin, "FOLLOWUP");
    assert.equal(stored.tasks[1].introducedInFollowup, 0);
    assert.deepEqual(stored.followups.map((item) => item.sequenceNumber), [0, 1, 2]);
    assert.equal(stored.followups[1].executionStatus, "EXECUTED");
    assert.equal(stored.followups[1].effectivenessStatus, "PENDING");
    assert.equal(stored.followups[2].effectivenessStatus, "ACCEPTABLE");
    assert.equal(stored.finalStatus, "CLOSED");
    assert.deepEqual(stored.qmsRecord.versions.map((item) => item.sequenceNumber), [0, 1, 2]);

    console.log("Change Control lifecycle PostgreSQL smoke test passed.");
  } finally {
    await prisma.qmsRecordVersion.deleteMany({ where: { qmsRecordId: qmsRecord.id } });
    await prisma.changeControl.deleteMany({ where: { qmsRecordId: qmsRecord.id } });
    await prisma.qmsRecord.delete({ where: { id: qmsRecord.id } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
