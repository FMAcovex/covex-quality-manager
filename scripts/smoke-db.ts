import assert from "node:assert/strict";
import {
  PrismaClient,
  QmsRecordType,
  QmsRelationType,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const department = await prisma.department.findUniqueOrThrow({
    where: { code: "GC-00" },
  });

  const deviationRecord = await prisma.qmsRecord.create({
    data: {
      recordType: QmsRecordType.DEVIATION,
      businessCode: "D/TEST/001/2099",
      year: 2099,
    },
  });

  const capaRecord = await prisma.qmsRecord.create({
    data: {
      recordType: QmsRecordType.CAPA,
      businessCode: "AC/TEST/001/2099",
      year: 2099,
    },
  });

  const deviation = await prisma.deviation.create({
    data: {
      qmsRecordId: deviationRecord.id,
      departmentId: department.id,
      departmentCodeSnapshot: department.code,
      departmentNameSnapshot: department.name,
      issueDate: new Date("2099-01-10"),
      createdByText: "CI smoke test",
      materialProcessAffected: "Proceso de prueba",
      provenance: "Prueba CI",
      whatHappened: "Evento ficticio utilizado exclusivamente para validar la persistencia.",
      immediateActions: {
        create: {
          description: "Contención ficticia",
          executedBy: "CI",
          executedAt: new Date("2099-01-10"),
        },
      },
      capaPlans: {
        create: {
          actionType: "CORRECTIVE",
          description: "CAPA ficticia",
          responsible: "CI",
          plannedExecutionDate: new Date("2099-01-20"),
        },
      },
    },
  });

  await prisma.deviationFollowup.create({
    data: {
      deviationId: deviation.id,
      followupDate: new Date("2099-01-11"),
      completedByText: "CI",
      followupType: "Prueba",
      comment: "Seguimiento ficticio",
      nextFollowupDate: new Date("2099-01-15"),
    },
  });

  await prisma.qmsRelation.create({
    data: {
      sourceRecordId: deviationRecord.id,
      targetRecordId: capaRecord.id,
      relationType: QmsRelationType.GENERATES,
      createdByText: "CI",
    },
  });

  const stored = await prisma.deviation.findUniqueOrThrow({
    where: { id: deviation.id },
    include: {
      qmsRecord: { include: { sourceRelations: true } },
      immediateActions: true,
      capaPlans: true,
      followups: true,
    },
  });

  assert.equal(stored.qmsRecord.businessCode, "D/TEST/001/2099");
  assert.equal(stored.departmentCodeSnapshot, "GC-00");
  assert.equal(stored.immediateActions.length, 1);
  assert.equal(stored.capaPlans.length, 1);
  assert.equal(stored.followups.length, 1);
  assert.equal(stored.qmsRecord.sourceRelations.length, 1);

  const sameVisibleCodeDifferentType = await prisma.qmsRecord.create({
    data: {
      recordType: QmsRecordType.COMPLAINT,
      businessCode: "D/TEST/001/2099",
      year: 2099,
    },
  });
  assert.equal(sameVisibleCodeDifferentType.businessCode, stored.qmsRecord.businessCode);

  console.log("Database smoke test passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
