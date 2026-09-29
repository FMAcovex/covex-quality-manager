import assert from "node:assert/strict";
import {
  CapaActionType,
  CapaProposalStatus,
  PrismaClient,
  QmsRecordType,
} from "@prisma/client";
import {
  getDeviationCapaPlanOrigin,
  registerDeviationCapaPlan,
} from "../src/modules/capa/deviation-origin";
import { capaPlanNavigation } from "../src/modules/deviations/capa-plan-ui";
import { createQmsRelation } from "../src/lib/qms/relation-service";
import { qmsRecordHref } from "../src/lib/qms/record-links";

const prisma = new PrismaClient();

const deviationCode = "D/B23/001/2097";
const capaCodes = ["AC/B23/001/2097", "AP/B23/002/2097"] as const;
const allCodes = [deviationCode, ...capaCodes];

async function cleanup() {
  const records = await prisma.qmsRecord.findMany({
    where: { businessCode: { in: [...allCodes] } },
    select: { id: true, recordType: true },
  });
  if (!records.length) return;

  const ids = records.map((record) => record.id);
  const capaIds = records
    .filter((record) => record.recordType === QmsRecordType.CAPA)
    .map((record) => record.id);
  const deviationIds = records
    .filter((record) => record.recordType === QmsRecordType.DEVIATION)
    .map((record) => record.id);

  await prisma.qmsRelation.deleteMany({
    where: {
      OR: [
        { sourceRecordId: { in: ids } },
        { targetRecordId: { in: ids } },
      ],
    },
  });
  await prisma.capa.deleteMany({ where: { qmsRecordId: { in: capaIds } } });
  await prisma.deviation.deleteMany({ where: { qmsRecordId: { in: deviationIds } } });
  await prisma.qmsRecord.deleteMany({ where: { id: { in: ids } } });
}

async function createCapaFromPlan(input: {
  planId: string;
  businessCode: string;
  actionType: CapaActionType;
  department: { id: string; code: string; name: string };
}) {
  return prisma.$transaction(async (tx) => {
    const origin = await getDeviationCapaPlanOrigin(tx, input.planId);
    const qmsRecord = await tx.qmsRecord.create({
      data: {
        recordType: QmsRecordType.CAPA,
        businessCode: input.businessCode,
        year: 2097,
      },
    });
    const capa = await tx.capa.create({
      data: {
        qmsRecordId: qmsRecord.id,
        actionType: input.actionType,
        departmentId: input.department.id,
        departmentCodeSnapshot: input.department.code,
        departmentNameSnapshot: input.department.name,
        openedAt: new Date("2097-06-02"),
        createdByText: "CI B2.3",
        originType: "Desviación",
        originCode: origin.deviationBusinessCode,
        defectDescription: `CAPA ficticia creada desde ${input.planId}.`,
        rootCause: "Causa ficticia para B2.3.",
        status: "OPEN",
        effectivenessStatus: "PENDING",
        dataQualityStatus: "REVIEW_REQUIRED",
        plannedActions: {
          create: {
            description: `Acción ficticia para ${input.businessCode}.`,
            responsible: "CI",
            plannedExecutionDate: new Date("2097-06-30"),
            sortOrder: 0,
          },
        },
      },
    });

    await registerDeviationCapaPlan(tx, {
      planId: origin.planId,
      capaQmsRecordId: qmsRecord.id,
      capaBusinessCode: input.businessCode,
      actor: "CI B2.3",
    });

    return { qmsRecord, capa };
  });
}

async function main() {
  await cleanup();

  const department = await prisma.department.findUniqueOrThrow({
    where: { code: "GC-00" },
  });

  const deviationRecord = await prisma.qmsRecord.create({
    data: {
      recordType: QmsRecordType.DEVIATION,
      businessCode: deviationCode,
      year: 2097,
    },
  });

  try {
    const deviation = await prisma.deviation.create({
      data: {
        qmsRecordId: deviationRecord.id,
        departmentId: department.id,
        departmentCodeSnapshot: department.code,
        departmentNameSnapshot: department.name,
        issueDate: new Date("2097-06-01"),
        createdByText: "CI B2.3",
        whatHappened: "Desviación ficticia con dos propuestas CAPA para prueba transversal B2.3.",
      },
    });

    const plan1 = await prisma.deviationCapaPlan.create({
      data: {
        deviationId: deviation.id,
        actionType: CapaActionType.CORRECTIVE,
        description: "Primera propuesta CAPA de la desviación.",
        responsible: "QA",
        plannedExecutionDate: new Date("2097-06-20"),
      },
    });
    const plan2 = await prisma.deviationCapaPlan.create({
      data: {
        deviationId: deviation.id,
        actionType: CapaActionType.PREVENTIVE,
        description: "Segunda propuesta CAPA de la desviación.",
        responsible: "Producción",
        plannedExecutionDate: new Date("2097-06-25"),
      },
    });

    assert.equal(plan1.proposalStatus, CapaProposalStatus.PROPOSED);
    assert.equal(plan2.proposalStatus, CapaProposalStatus.PROPOSED);

    const created1 = await createCapaFromPlan({
      planId: plan1.id,
      businessCode: capaCodes[0],
      actionType: CapaActionType.CORRECTIVE,
      department,
    });
    const created2 = await createCapaFromPlan({
      planId: plan2.id,
      businessCode: capaCodes[1],
      actionType: CapaActionType.PREVENTIVE,
      department,
    });

    await createQmsRelation(prisma, {
      sourceRecordId: deviationRecord.id,
      targetRecordId: created1.qmsRecord.id,
      createdByText: "CI B2.3 duplicate attempt",
    });
    await createQmsRelation(prisma, {
      sourceRecordId: deviationRecord.id,
      targetRecordId: created2.qmsRecord.id,
      createdByText: "CI B2.3 duplicate attempt",
    });

    const storedDeviation = await prisma.deviation.findUniqueOrThrow({
      where: { id: deviation.id },
      include: {
        capaPlans: {
          orderBy: { createdAt: "asc" },
          include: { linkedCapaRecord: true },
        },
        qmsRecord: {
          include: {
            sourceRelations: {
              where: { isActive: true, relationType: "GENERATES" },
              include: { targetRecord: true },
            },
            targetRelations: { where: { isActive: true } },
          },
        },
      },
    });

    assert.equal(storedDeviation.capaPlans.length, 2);
    assert.deepEqual(
      storedDeviation.capaPlans.map((plan) => plan.proposalStatus),
      [CapaProposalStatus.REGISTERED, CapaProposalStatus.REGISTERED],
    );
    assert.deepEqual(
      storedDeviation.capaPlans.map((plan) => plan.businessCapaCode),
      [...capaCodes],
    );
    assert.deepEqual(
      storedDeviation.capaPlans.map((plan) => plan.linkedCapaRecordId),
      [created1.qmsRecord.id, created2.qmsRecord.id],
    );

    assert.equal(storedDeviation.qmsRecord.sourceRelations.length, 2);
    assert.deepEqual(
      storedDeviation.qmsRecord.sourceRelations
        .map((relation) => relation.targetRecord.businessCode)
        .sort(),
      [...capaCodes].sort(),
    );
    assert.equal(storedDeviation.qmsRecord.targetRelations.length, 0);

    const exactRelations = await prisma.qmsRelation.findMany({
      where: {
        sourceRecordId: deviationRecord.id,
        targetRecordId: { in: [created1.qmsRecord.id, created2.qmsRecord.id] },
        relationType: "GENERATES",
      },
    });
    assert.equal(exactRelations.length, 2);

    const reverseRelations = await prisma.qmsRelation.count({
      where: {
        sourceRecordId: { in: [created1.qmsRecord.id, created2.qmsRecord.id] },
        targetRecordId: deviationRecord.id,
      },
    });
    assert.equal(reverseRelations, 0);

    const storedCapas = await prisma.capa.findMany({
      where: { qmsRecordId: { in: [created1.qmsRecord.id, created2.qmsRecord.id] } },
      include: {
        qmsRecord: {
          include: {
            targetRelations: {
              where: { isActive: true, relationType: "GENERATES" },
              include: { sourceRecord: true },
            },
          },
        },
      },
      orderBy: { qmsRecord: { businessCode: "asc" } },
    });
    assert.equal(storedCapas.length, 2);
    for (const capa of storedCapas) {
      assert.equal(capa.qmsRecord.targetRelations.length, 1);
      assert.equal(capa.qmsRecord.targetRelations[0].sourceRecordId, deviationRecord.id);
      assert.equal(
        capa.qmsRecord.targetRelations[0].sourceRecord.recordType,
        QmsRecordType.DEVIATION,
      );
      assert.equal(
        capa.qmsRecord.targetRelations[0].sourceRecord.businessCode,
        deviationCode,
      );
    }

    for (const plan of storedDeviation.capaPlans) {
      const navigation = capaPlanNavigation({
        proposalStatus: plan.proposalStatus,
        linkedCapaRecordId: plan.linkedCapaRecordId,
      });
      assert.equal(navigation.kind, "OPEN");
      if (navigation.kind === "OPEN") {
        assert.equal(
          qmsRecordHref(QmsRecordType.CAPA, navigation.recordId),
          `/qms/${navigation.recordId}`,
        );
      }
    }

    assert.equal(
      qmsRecordHref(QmsRecordType.DEVIATION, deviationRecord.id),
      `/qms/${deviationRecord.id}`,
    );

    console.log(
      "B2.3 transversal smoke passed: 1 desviación, 2 propuestas, 2 CAPA, 2 relaciones, navegación ida/vuelta y 0 duplicados.",
    );
  } finally {
    await cleanup();
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
